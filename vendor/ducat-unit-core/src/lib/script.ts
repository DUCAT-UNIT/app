/**
 * @fileoverview Parse vault-specific Bitcoin scripts into structured data.
 *
 * Supported script types:
 * - Cosigner script:    client and guard pubkeys for vault authorization
 * - Liquidation script: liquid hash and guard pubkey for liquidation paths
 *
 * Formats are fixed-position opcode/pubkey/hash patterns extracted by regex.
 */

import { PATTERNS }             from '@/const.js'
import { assert_bip340_pubkey } from '@/validate/assert.js'

import type {
  VaultCosignerScript,
  VaultLiquidationScript
} from '@/types/index.js'

// The cosigner spend script is `20<client_pk>ad20<guard_pk>ac`, OPTIONALLY
// followed by an inert ordinals inscription envelope (`OP_FALSE OP_IF ...
// OP_ENDIF`) that DUCAT vaults commit on the cosign leaf. `OP_FALSE OP_IF`
// is never executed, so the envelope cannot affect the signature checks.
//
// Codex finding #11: *executable* trailing bytes ARE a signature-bypass —
// e.g. a `7551` suffix (OP_DROP OP_TRUE) after the final OP_CHECKSIG drops
// the checksig result and leaves OP_TRUE, passing a failed check. So trailing
// data is permitted ONLY when it is exactly one inert inscription envelope
// (data pushes between OP_IF and a single final OP_ENDIF, nothing executable);
// `is_inert_inscription_suffix` enforces this and rejects everything else.
// (Note: no trailing `$` — the regex matches the cosigner prefix, then the
// remainder is validated explicitly below.)
const COSIGN_SCRIPT_REGEX = /^(20)(?<client_pubkey>[a-f0-9]{64})(ad20)(?<guard_pubkey>[a-f0-9]{64})(ac)/
const LIQUID_SCRIPT_REGEX = /^(a914)(?<liquid_hash>[a-f0-9]{40})(8820)(?<guard_pubkey>[a-f0-9]{64})(ac)$/

/**
 * Validates that a hex string represents a plausible x-only public key (32 bytes).
 * Checks that the value is non-zero and not a trivially invalid key.
 */
function validate_pubkey_format (hex : string, label : string) : void {
  if (/^0+$/.test(hex)) {
    throw new Error(`${label} is all zeros`)
  }
}

/**
 * Whether `hex` is exactly one inert ordinals inscription envelope:
 * `OP_FALSE OP_IF <data pushes only> OP_ENDIF`, with the OP_ENDIF as the
 * final byte and no executable opcodes anywhere.
 *
 * Security (Codex #11): `OP_FALSE OP_IF` means the branch is never executed,
 * so the envelope cannot alter the cosigner signature checks. By permitting
 * ONLY data pushes between OP_IF and a single closing OP_ENDIF (no OP_IF /
 * OP_NOTIF / OP_ELSE / OP_DROP / OP_TRUE / etc., and nothing after OP_ENDIF),
 * a sig-bypass suffix (e.g. `...ac7551`) cannot masquerade as trailing data:
 * the first OP_ENDIF is unambiguously the match and is the last byte, so no
 * opcode can ever execute after the cosigner checks.
 */
function is_inert_inscription_suffix (hex : string) : boolean {
  // Must begin with OP_FALSE (0x00) OP_IF (0x63).
  if (!/^0063/.test(hex)) return false
  const len  = hex.length / 2
  const byte = (i : number) : number => parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  let p = 2 // byte index, past the leading 00 63
  while (p < len) {
    const op = byte(p)
    if (op === 0x68) {            // OP_ENDIF — only valid as the final byte
      return p === len - 1
    } else if (op === 0x00) {     // OP_0 / push-empty (inscription body separator)
      p += 1
    } else if (op >= 0x01 && op <= 0x4b) {
      p += 1 + op                 // direct push of `op` bytes
    } else if (op === 0x4c) {     // OP_PUSHDATA1
      if (p + 1 >= len) return false
      p += 2 + byte(p + 1)
    } else if (op === 0x4d) {     // OP_PUSHDATA2 (little-endian length)
      if (p + 2 >= len) return false
      p += 3 + (byte(p + 1) | (byte(p + 2) << 8))
    } else if (op === 0x4e) {     // OP_PUSHDATA4 (little-endian length)
      if (p + 4 >= len) return false
      p += 5 + (byte(p + 1) | (byte(p + 2) << 8) | (byte(p + 3) << 16) | (byte(p + 4) * 0x1000000))
    } else {
      return false                // any control / executable opcode -> reject
    }
    if (p > len) return false      // a push declared data past the end
  }
  return false                     // ran to the end without a closing OP_ENDIF
}

/**
 * Parse and validate a vault cosigner taproot script (trust boundary).
 *
 * Matches the `20<client_pk>ad20<guard_pk>ac` shape, rejects any executable
 * trailing bytes (only an inert inscription envelope is permitted), and checks
 * both pubkeys are well-formed.
 *
 * @param script - The cosigner leaf script as a hex string.
 * @returns The extracted `{ client_pubkey, guard_pubkey }`.
 * @throws {Error} When the script shape is invalid, carries executable trailing
 *   bytes, or either pubkey is malformed.
 */
export function parse_cosigner_script (
  script : string
) : VaultCosignerScript {
  const match = script.match(COSIGN_SCRIPT_REGEX)
  if (!match?.groups) {
    // Surface the offending script so failures are inspectable (the script is
    // public taproot data, not secret). Expected: 20<client_pk>ad20<guard_pk>ac.
    throw new Error(`invalid vault cosigner script (${script.length / 2} bytes): ${script}`)
  }
  const { client_pubkey, guard_pubkey } = match.groups
  // Any bytes after the cosigner script must be an inert inscription envelope
  // (never executable) — see is_inert_inscription_suffix / Codex #11.
  const trailing = script.slice(match[0].length)
  if (trailing.length > 0 && !is_inert_inscription_suffix(trailing)) {
    throw new Error(`invalid vault cosigner script: trailing bytes are not an inert inscription envelope (${script.length / 2} bytes): ${script}`)
  }
  // Validate pubkey format.
  validate_pubkey_format(client_pubkey, 'client pubkey')
  validate_pubkey_format(guard_pubkey, 'guard pubkey')
  return { client_pubkey, guard_pubkey }
}

/**
 * Parse and validate a vault liquidation taproot script (trust boundary).
 *
 * Matches the `a914<liquid_hash>8820<guard_pk>ac` shape, validates the guard
 * pubkey, and rejects an all-zero liquidation hash.
 *
 * @param script - The liquidation leaf script as a hex string.
 * @returns The extracted `{ guard_pubkey, liquid_hash }`.
 * @throws {Error} When the script shape is invalid, the pubkey is malformed, or
 *   the liquidation hash is all zeros.
 */
export function parse_liquidation_script (
  script : string
) : VaultLiquidationScript {
  const match = script.match(LIQUID_SCRIPT_REGEX)
  if (!match?.groups) {
    // Expected: a914<liquid_hash>8820<guard_pk>ac.
    throw new Error(`invalid vault liquidation script (${script.length / 2} bytes): ${script}`)
  }
  const { guard_pubkey, liquid_hash } = match.groups
  // Validate pubkey format.
  validate_pubkey_format(guard_pubkey, 'guard pubkey')
  // Validate liquid hash is not all zeros.
  if (/^0+$/.test(liquid_hash)) {
    throw new Error('liquid hash is all zeros')
  }
  return { guard_pubkey, liquid_hash }
}

/**
 * Parse all embedded BIP340 (x-only) pubkeys from a script string.
 *
 * Scans the script with the shared `SCRIPT_PUBKEYS` pattern, extracts every
 * matched pubkey, and asserts each is a valid BIP340 pubkey before returning.
 * @param script - Hex-encoded script string to scan
 * @returns Array of extracted BIP340 pubkey hex strings, in match order
 * @throws If any extracted pubkey fails BIP340 validation
 */
export function parse_script_pubkeys (script : string) : string[] {
  // Define the regex for searching the script pubkeys.
  const regex   = new RegExp(PATTERNS.SCRIPT_PUBKEYS, 'gi')
  // Find the matches in the script.
  const matches = [ ...script.matchAll(regex) ]
  // Extract the pubkeys from the matches.
  const pubkeys = matches.map(match => match[1])
  // Assert that the pubkeys are valid.
  for (const pubkey of pubkeys) {
    assert_bip340_pubkey(pubkey)
  }
  // Return the pubkeys.
  return pubkeys
}
