/**
 * @fileoverview Bitcoin inscription envelope encode/decode helpers.
 *
 * Handles `ord`-style tapscript envelopes for common inscription fields
 * (`mimetype`, `pointer`, `parent`, `protocol`, `delegate`, `rune`, `content`).
 */

import { Buff, Stream }      from '@vbyte/buff'
import { Assert }            from '@vbyte/util'
import { INSCRIPTION_MAGIC } from '@/const.js'

import {
  decode_script,
  encode_script
} from '@vbyte/btc-dev/script'

import type { InscriptionData } from '../types/index.js'

/* ===== [ Constants ] ====================================================== */

const _0N  = BigInt(0)
const _1N  = BigInt(1)
const _26N = BigInt(26)

// The 'ord' magic as it appears in a decoded data word (3 bytes,
// without the leading push opcode). INSCRIPTION_MAGIC is the raw-byte
// form '036f7264' (PUSHBYTES_3 + 'ord'); the decoded word drops the
// push opcode.
const ENVELOPE_MAGIC_WORD = INSCRIPTION_MAGIC.slice(2)

/* ===== [ Public API ] ===================================================== */

/**
 * Return true when a script contains an inscription envelope opening
 * (`OP_0 OP_IF <magic>`).
 *
 * Decodes the script into words first so the detection is independent
 * of how the magic was pushed — PUSHBYTES, PUSHDATA1, and PUSHDATA2
 * encodings of the same envelope all normalize to the same decoded
 * word sequence (Codex finding #20). The previous raw-byte substring
 * check (`0063` + the PUSHBYTES_3 magic) missed non-PUSHBYTES encodings
 * and silently dropped the witness, causing commit-data loss that
 * diverged from `decode_inscriptions` (which decodes the script).
 */
export function has_inscription (script : string) : boolean {
  let words : string[]
  try {
    words = decode_script(script)
  } catch {
    return false
  }
  for (let i = 0; i + 2 < words.length; i++) {
    if (
      words[i]     === 'OP_0'  &&
      words[i + 1] === 'OP_IF' &&
      words[i + 2] === ENVELOPE_MAGIC_WORD
    ) {
      return true
    }
  }
  return false
}

/** Decode all inscription envelopes embedded in a script. */
export function decode_inscriptions (script : string) : InscriptionData[] {
  const envelopes = parse_envelopes(script)
  return envelopes.map(parse_inscription)
}

/** Encode inscription records into concatenated script envelope hex. */
export function encode_inscriptions (data : InscriptionData[]) : string {
  return data.map(create_envelope).join('')
}

/* ===== [ Tag & Opcode Constants ] ========================================= */

// Tag bytes are pushed as single-byte data pushes (OP_PUSHBYTES_1 <tag>) to
// match the `ord` reference writer. See:
// https://github.com/ordinals/ord/blob/master/src/inscriptions/tag.rs
//
// `encode_script` would rewrite any single-byte data push with value ≤ 16
// into the equivalent OP_N opcode ("minimal push"), so we emit the raw
// bytes directly for tag fields.
const TAG_CONTENT_TYPE = 0x01
const TAG_POINTER      = 0x02
const TAG_PARENT       = 0x03
const TAG_METAPROTOCOL = 0x07
const TAG_DELEGATE     = 0x0b
const TAG_RUNE         = 0x0d

// Bitcoin script data-push opcodes.
const OP_PUSHDATA1 = 0x4c
const OP_PUSHDATA2 = 0x4d
// Standardness limit for a single data push.
const MAX_SCRIPT_ELEMENT_SIZE = 520

/* ===== [ Envelope Encoding ] ============================================== */

// Envelope layout: OP_0 OP_IF "ord", zero or more tag/value pushes,
// optional OP_0 body separator plus <=520-byte content pushes, then OP_ENDIF.

/**
 * Encode a byte string as a Bitcoin data push, selecting the correct
 * push opcode for the length (Codex finding #3):
 *   - 1..=75:    OP_PUSHBYTES_N <data>
 *   - 76..=255:  OP_PUSHDATA1 (0x4c) <len:1>      <data>
 *   - 256..=520: OP_PUSHDATA2 (0x4d) <len:2 LE>   <data>
 *   - > 520:     throw (exceeds the standardness push limit)
 *
 * The previous implementation always emitted a single length byte,
 * which produced a malformed script at exactly 76 bytes (0x4c is read
 * as OP_PUSHDATA1, consuming the next byte as a length prefix).
 */
function encode_data_push (bytes : Buff) : Buff {
  const len = bytes.length
  if (len <= 75) {
    return Buff.join([ Buff.num(len, 1), bytes ])
  }
  if (len <= 255) {
    return Buff.join([ Buff.num(OP_PUSHDATA1, 1), Buff.num(len, 1), bytes ])
  }
  if (len <= MAX_SCRIPT_ELEMENT_SIZE) {
    // PUSHDATA2 length is a 2-byte little-endian prefix.
    return Buff.join([ Buff.num(OP_PUSHDATA2, 1), Buff.num(len, 2, 'le'), bytes ])
  }
  throw new Error(`inscription tag value exceeds ${MAX_SCRIPT_ELEMENT_SIZE}-byte push limit: ${len} bytes`)
}

/**
 * Encode a tag/value pair as raw bytes:
 *   OP_PUSHBYTES_1 <tag> <value-push>
 *
 * The tag push uses the literal opcode/byte pair (not OP_N) so the tapleaf
 * hash matches the ord reference writer. The value is interpreted as hex
 * when `value` is a valid hex string, otherwise as UTF-8, and is pushed
 * with the correct push opcode for its length.
 */
function encode_tag_field (tag : number, value : string) : string {
  const tag_part = Buff.join([ Buff.num(1, 1), Buff.num(tag, 1) ])
  const value_bytes = Buff.is_hex(value) ? Buff.hex(value) : Buff.str(value)
  const value_part = encode_data_push(value_bytes)
  return Buff.join([ tag_part, value_part ]).hex
}

function create_envelope (data : InscriptionData) : string {
  // Opening: OP_FALSE OP_IF 'ord'
  const prefix = encode_script([ 'OP_0', 'OP_IF', '6f7264' ]).hex
  let body_hex = ''

  if (typeof data.mimetype === 'string') {
    const label = encode_label(data.mimetype)
    body_hex += encode_tag_field(TAG_CONTENT_TYPE, label)
  }

  if (typeof data.pointer === 'number') {
    const ptr = encode_pointer(data.pointer)
    body_hex += encode_tag_field(TAG_POINTER, ptr)
  }

  if (typeof data.parent === 'string') {
    const id = encode_id(data.parent)
    body_hex += encode_tag_field(TAG_PARENT, id)
  }

  if (typeof data.protocol === 'string') {
    body_hex += encode_tag_field(TAG_METAPROTOCOL, data.protocol)
  }

  if (typeof data.delegate === 'string') {
    const id = encode_id(data.delegate)
    body_hex += encode_tag_field(TAG_DELEGATE, id)
  }

  if (typeof data.rune === 'string') {
    const label = encode_rune_label(data.rune)
    body_hex += encode_tag_field(TAG_RUNE, label)
  }

  if (typeof data.content === 'string') {
    // Body separator is OP_0 (zero-length push) followed by content chunks.
    const chunks = encode_content(data.content)
    body_hex += encode_script([ 'OP_0', ...chunks ]).hex
  }

  // Closing: OP_ENDIF
  const suffix = encode_script([ 'OP_ENDIF' ]).hex
  return prefix + body_hex + suffix
}

/* ===== [ Envelope Parsing ] =============================================== */

// Parsed envelope words omit push opcodes for data values. Decoding walks the
// same tag/value layout and treats OP_0 as the content-body boundary.

function parse_envelopes (
  script : string
) : string[][] {
  // Decode the script into words.
  const words     = decode_script(script)
  // Find the index of the first data word.
  const data_idx  = words.indexOf('OP_0')
  // If the data index is not found, throw an error.
  Assert.ok(data_idx !== -1, 'inscription envelope not found')
  // Initialize an array to store the envelopes.
  const envelopes = []
  // Iterate through the words array starting from the data index.
  for (let idx = data_idx; idx < words.length; idx++) {
    // If the next word is not OP_IF, throw an error.
    Assert.ok(words[idx + 1] === 'OP_IF',  'OP_IF missing from envelope')
    // If the next word is not the magic bytes, throw an error.
    Assert.ok(words[idx + 2] === '6f7264', 'magic bytes missing from envelope')
    // Find the index of the OP_ENDIF word.
    const stop_idx = words.indexOf('OP_ENDIF')
    // If the OP_ENDIF word is not found, throw an error.
    Assert.ok(stop_idx !== -1, 'inscription envelope missing END_IF statement')
    // Get the envelope from the words array.
    const envelope = words.slice(idx + 3, stop_idx)
    // Add the author's public key and envelope to the envelopes array.
    envelopes.push(envelope)
    // Increment the index by the stop index.
    idx += stop_idx
  }
  // Return the envelopes array.
  return envelopes
}

// Normalize an envelope word to a canonical tag number. Accepts both the
// data-push form (1-byte hex like '01', '07') and the legacy OP_N opcodes
// for backward compatibility with pre-fix envelopes.
function normalize_tag (word : string) : number | null {
  switch (word) {
    case 'OP_1':  return TAG_CONTENT_TYPE
    case 'OP_2':  return TAG_POINTER
    case 'OP_3':  return TAG_PARENT
    case 'OP_7':  return TAG_METAPROTOCOL
    case 'OP_11': return TAG_DELEGATE
    case 'OP_13': return TAG_RUNE
  }
  // Data-push form: single-byte hex value.
  if (/^[0-9a-f]{2}$/.test(word)) {
    return parseInt(word, 16)
  }
  return null
}

function parse_inscription (envelope : string[]) {
  const record : InscriptionData = {}

  for (let i = 0; i < envelope.length; i++) {
    // Body separator: OP_0 signals the start of content pushes.
    if (envelope[i] === 'OP_0') {
      record.content = decode_content(envelope.slice(i+1))
      return record
    }
    const tag = normalize_tag(envelope[i])
    switch (tag) {
      case TAG_CONTENT_TYPE:
        record.mimetype = decode_label(envelope[i+1])
        i += 1
        break
      case TAG_POINTER:
        record.pointer = decode_pointer(envelope[i+1])
        i += 1
        break
      case TAG_PARENT:
        record.parent = decode_id(envelope[i+1])
        i += 1
        break
      case TAG_METAPROTOCOL:
        record.protocol = envelope[i+1]
        i += 1
        break
      case TAG_DELEGATE:
        record.delegate = decode_id(envelope[i+1])
        i += 1
        break
      case TAG_RUNE:
        record.rune = decode_rune_label(envelope[i+1])
        i += 1
        break
    }
  }
  return record
}

/* ===== [ Field Codecs ] =================================================== */

// Field byte layout: inscription IDs store reversed txid bytes plus optional
// index byte; pointers and runes are little-endian integers; content is chunked.

function encode_id (
  identifier : string
) : string {
  Assert.ok(identifier.includes('i'), 'identifier must include an index')
  const parts = identifier.split('i')
  const bytes = Buff.hex(parts[0])
  const idx   = Number(parts[1])
  const txid  = bytes.reverse().hex
  return (idx !== 0) ? txid + Buff.num(idx).hex : txid
}

function decode_id (
  hexstr : string
) : string {
  const bytes = Buff.hex(hexstr)
  const idx   = bytes.at(-1) ?? 0
  const txid  = bytes.slice(0, -1).reverse().hex
  return `${txid}i${String(idx)}`
}

function encode_pointer (
  pointer : number
) : string {
  return Buff.num(pointer).reverse().hex
}

// Exact whitelist of numeric push opcodes a pointer word may use.
// decode_script may render small-number pushes as either OP_N or
// OP_PUSHNUM_N depending on version, so both forms are accepted.
const POINTER_OPCODES : ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>([['OP_0', 0]])
  for (let n = 1; n <= 16; n++) {
    m.set(`OP_${n}`, n)
    m.set(`OP_PUSHNUM_${n}`, n)
  }
  return m
})()

function decode_pointer (
  word : string
) : number {
  // Opcode form: match against the exact whitelist. The previous
  // `parseInt(word.slice(3), 10)` was lenient — e.g. 'OP_1NEGATE'
  // parsed to 1 because parseInt stops at the first non-digit,
  // silently accepting a non-numeric opcode as pointer value 1
  // (Codex finding #17).
  if (word.startsWith('OP_')) {
    const num = POINTER_OPCODES.get(word)
    if (num === undefined) throw new Error(`Invalid pointer opcode: ${word}`)
    return num
  }
  // Handle hex string format.
  return Buff.hex(word).reverse().num
}

function encode_label (
  label : string
) : string {
  return Buff.str(label).hex
}

function decode_label (
  hexstr : string
) : string {
  return Buff.hex(hexstr).str
}

function encode_content (
  content : string
) : string[] {
  const stream = Buff.is_hex(content)
    ? new Stream(Buff.hex(content))
    : new Stream(Buff.str(content))
  const chunks : string[]= []
  while (stream.size > 0) {
    if (stream.size > 520) {
      const chunk = stream.read(520)
      chunks.push(chunk.hex)
    } else {
      const chunk = stream.read(stream.size)
      chunks.push(chunk.hex)
    }
  }
  return chunks
}

function decode_content (
  hexstrs : string[],
  type    : 'hex' | 'utf8' = 'hex'
) : string {
  const data = Buff.join(hexstrs)
  return (type === 'hex')
    ? data.hex
    : data.str
}

function encode_rune_label (label : string) : string {
  const str = label.toUpperCase()
  let big = _0N
  for (const char of str) {
    if (char >= 'A' && char <= 'Z') {
        big = big * _26N + BigInt(char.charCodeAt(0) - ('A'.charCodeAt(0) - 1))
    } else { }
  }
  big = big - _1N
  return Buff.big(big).reverse().hex
}

function decode_rune_label (hex: string): string {
  // Convert hex to BigInt, with byte order reversed
  let big = Buff.hex(hex).reverse().big
  // Add 1 as per the encoding algorithm
  big = big + _1N
  // Initialize result string
  let result = ''
  // Convert the BigInt back to a string of alphabet characters
  while (big > _0N) {
    // Get remainder after division by 26
    const mod = big % _26N
    // Convert remainder to character (0 maps to 'Z', 1 to 'A', 2 to 'B', etc.)
    if (mod === _0N) {
      result = `Z${result}`
      big = big / _26N - _1N // Adjust for special case of 'Z'
    } else {
      // Map 1 to 'A', 2 to 'B', etc.
      const char_code = Number(mod) + 'A'.charCodeAt(0) - 1
      result = String.fromCharCode(char_code) + result
      big = big / _26N
    }
  }
  return result
}
