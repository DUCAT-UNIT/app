/**
 * @fileoverview Bitcoin transaction sequence encoding/decoding helpers.
 *
 * Supports:
 * - BIP-68 relative timelocks (`height` and `stamp` variants)
 * - Protocol metadata tags encoded in sequence bits
 * - Raw/null sequence passthrough modes
 */

import { Assert } from '@vbyte/util'

import type {
  SequenceData,
  SequenceMetaData,
  SequenceNumber,
  SequenceTimelock
} from '../types/index.js'

/* ===== [ Constants ] ===================================================== */

const TIMELOCK_DISABLE     = 0x80000000  // Bit 31: When set, disables relative timelock per BIP-68.
const TIMELOCK_TYPE        = 0x00400000  // Bit 22: When set, indicates timestamp-based lock; when clear, indicates block-height-based lock.
const TIMELOCK_VALUE_MASK  = 0x0000FFFF  // Bits 0-15: Mask for extracting timelock value (16 bits).
const TIMELOCK_VALUE_MAX   = 0xFFFF      // Maximum value for timelock (2^16 - 1).
const TIMELOCK_GRANULARITY = 512         // Seconds per timestamp unit (BIP-68 specification).
const METADATA_SIGNAL      = 0x40000000  // Bit 30: When set, indicates custom protocol data is present.
const METADATA_DISABLE     = 0x20000000  // Bit 29: When unset, confirms protocol signal is valid (prevents 0xFFFFFFFF false positive).
const METADATA_SHORT_MASK  = 0xFFFF      // Bits 0-15: Mask for code value.
const METADATA_BYTE_MASK   = 0xFF        // Bits 0-7: Mask for version number.

/* ===== [ Main API ] ======================================================= */

// Sequence bit layout: bit 31 disables BIP-68 timelocks, bit 30 signals
// protocol metadata, bit 22 selects timestamp locks, and bits 0-15 carry values.

/**
 * Encodes a SequenceData object into a 32-bit integer sequence value
 * 
 * @param data - The sequence data to encode
 * @returns A 32-bit integer representing the encoded sequence
 * @throws Error if the input data is invalid or exceeds maximum values
 */
export function encode_sequence (data : SequenceData): number {
  // Assert the sequence data is valid.
  Assert.exists(data.type, 'must specify sequence type')
  // Encode the sequence data based on the type.
  switch (data.type) {
    case 'timelock':
      return encode_timelock(data)
    case 'metadata':
      return encode_metadata(data)
    case 'number':
      return encode_number(data)
    case 'null':
      return encode_nullified()
    default:
      throw new Error(`invalid sequence data:${String(data)}`)
  }
}

/**
 * Decodes a 32-bit sequence value into a SequenceData object
 * 
 * @param sequence - The 32-bit sequence value to decode
 * @returns A SequenceData object representing the decoded sequence
 * @throws Error if the sequence value is invalid or exceeds maximum values
 */
export function decode_sequence (sequence : number | string) : SequenceData {
  // Parse and validate the sequence value.
  const seq = parse_sequence(sequence)
  
  // Check for metadata (TIMELOCK_DISABLE bit is set AND METADATA_SIGNAL bit is set AND METADATA_DISABLE bit is unset).
  if ((seq & TIMELOCK_DISABLE) && (seq & METADATA_SIGNAL) && !(seq & METADATA_DISABLE)) {
    return decode_metadata(seq)
  }
  
  // Check for timelock (TIMELOCK_DISABLE bit is clear).
  if (!(seq & TIMELOCK_DISABLE)) {
    return decode_timelock(seq)
  }

  // Check for nullified (sequence value is 0xFFFFFFFF).
  if (seq === 0xFFFFFFFF) {
    return { type: 'null' }
  }
  
  // Fallback to number for all other cases.
  return decode_number(seq)
}

/* ===== [ Internal Encoders ] ============================================== */

// Encode blocks preserve the 32-bit layout: timelocks use bits 0-15 plus the
// optional timestamp flag; metadata uses flags plus version[0..7]/code[8..23].

/**
 * Encodes a timelock sequence into a 32-bit integer
 * 
 * @param data - The timelock data to encode
 * @returns A 32-bit integer representing the encoded timelock sequence
 * @throws Error if the input data is invalid or exceeds maximum values
 */
function encode_timelock (data : SequenceTimelock): number {
  // If the timelock is based on a block height,
  if (data.format === 'height') {
    // Validate the height value.
    const height = parse_height(data.value)
    // For heightlock, only encode the height value (TIMELOCK_TYPE bit remains clear)
    const sequence = (height & TIMELOCK_VALUE_MASK) >>> 0
    return parse_sequence(sequence)
  }
  // If the timelock is based on a timestamp,
  if (data.format === 'stamp') {
    // Convert timestamp to 512-second granularity units as per BIP-68.
    const stamp = parse_stamp(data.value)
    // Set the TIMELOCK_TYPE bit and encode the timestamp value.
    const sequence = (TIMELOCK_TYPE | (stamp & TIMELOCK_VALUE_MASK)) >>> 0
    return parse_sequence(sequence)
  }
  // Throw an error if the format is unrecognized.
  throw new Error(`invalid timelock format: ${String(data.format)}`)
}

/**
 * Encodes a metadata sequence into a 32-bit integer
 * 
 * @param data - The metadata data to encode
 * @returns A 32-bit integer representing the encoded metadata sequence
 * @throws Error if the input data is invalid or exceeds maximum values
 */
function encode_metadata (data : SequenceMetaData): number {
  // Set base flags for metadata type.
  const base_seq = TIMELOCK_DISABLE | METADATA_SIGNAL
  // Encode version in lowest 8 bits.
  const version  = parse_byte(data.version) & METADATA_BYTE_MASK
  // Encode the code value in the next 16 bits.
  const code     = (parse_short(data.code) & METADATA_SHORT_MASK) << 8
  // Return the encoded tag.
  const sequence = (base_seq | version | code) >>> 0
  return parse_sequence(sequence)
}

/**
 * Encodes a number sequence into a 32-bit integer
 * 
 * @param data - The number data to encode
 * @returns A 32-bit integer representing the encoded number sequence
 */
function encode_number (data : SequenceNumber): number {
  // Return the number value.
  const sequence = data.value ?? 0xFFFFFFFF
  return parse_sequence(sequence)
}

/**
 * Encodes a nullified sequence into a 32-bit integer
 * 
 * @returns A 32-bit integer representing the encoded nullified sequence
 */
function encode_nullified (): number {
  return parse_sequence(0xFFFFFFFF)
}

/* ===== [ Internal Decoders ] ============================================== */

// Decode blocks mirror the encoder masks: classify by high-bit flags first,
// then unpack timelock values or metadata version/code from the lower bits.

/**
 * Decodes a timelock sequence from a 32-bit integer
 * 
 * @param sequence - The 32-bit sequence value to decode
 * @returns A SequenceTimeLock object
 * @throws Error if the sequence value is invalid or exceeds maximum values
 */
function decode_timelock (sequence : number): SequenceTimelock {
  // Extract the value.
  const value = sequence & TIMELOCK_VALUE_MASK
  // Check for timestamp-based lock (TIMELOCK_TYPE bit is set).
  if (sequence & TIMELOCK_TYPE) {
    // Convert granularity units back to seconds for timestamp.
    const stamp = value * TIMELOCK_GRANULARITY
    // Validate the timestamp value.
    if (stamp > 0xFFFFFFFF) {
      throw new Error('decoded timestamp exceeds 32-bit limit')
    }
    // Return the decoded timelock.
    return { type: 'timelock', format: 'stamp', value: stamp }
  } else {
    // Assign the value to the height variable (for readability).
    const height = value
    // Validate the height value.
    if (height > TIMELOCK_VALUE_MAX) {
      throw new Error('decoded height exceeds maximum')
    }
    // Return the decoded heightlock.
    return { type: 'timelock', format: 'height', value: height }
  }
}

/**
 * Decodes a metadata sequence from a 32-bit integer
 * 
 * @param sequence - The 32-bit sequence value to decode
 * @returns A SequenceMetaData object
 */
function decode_metadata (sequence : number): SequenceMetaData {
  // Extract the version number.
  const version = sequence & METADATA_BYTE_MASK
  // Extract the code value.
  const code    = (sequence >>> 8) & METADATA_SHORT_MASK
  // Return the tag type.
  return { code, type: 'metadata', version }
}

/**
 * Decodes a number sequence from a 32-bit integer
 * 
 * @param sequence - The 32-bit sequence value to decode
 * @returns A SequenceNumber object
 */
function decode_number (sequence : number): SequenceNumber {
  // Return the number value.
  return { type: 'number', value: sequence }
}

/* ===== [ Helpers ] ========================================================= */

/**
 * Parses a sequence value into a number.
 * 
 * @param sequence - The sequence value to parse.
 * @returns The parsed sequence value.
 * @throws Error if the sequence value is invalid.
 */
function parse_sequence (sequence : number | string): number {
  const seq = (typeof sequence === 'string')
    ? parseInt(sequence, 16)
    : sequence
  if (!Number.isInteger(seq) || seq < 0 || seq > 0xFFFFFFFF) {
    throw new Error(`invalid sequence value: ${seq}`)
  }
  return seq
}

/**
 * Parses a timestamp value into a 512-second granularity units.
 * 
 * @param stamp - The timestamp value to parse.
 * @returns The parsed timestamp value.
 * @throws Error if the timestamp value is invalid.
 */
function parse_stamp (stamp? : number) : number {
  if (stamp === undefined || !Number.isInteger(stamp)) {
    throw new Error(`timestamp must be a number`)
  }
  // Convert timestamp to 512-second granularity units as per BIP-68.
  const ts = Math.floor(stamp / TIMELOCK_GRANULARITY)
  // Validate the timestamp value.
  if (!Number.isInteger(ts) || ts < 0 || ts > TIMELOCK_VALUE_MAX) {
    throw new Error(`timelock value must be an integer between 0 and ${TIMELOCK_VALUE_MAX} (in 512-second increments)`)
  }
  return ts
}

/**
 * Parses a height value into a number.
 * 
 * @param height - The height value to parse.
 * @returns The parsed height value.
 * @throws Error if the height value is invalid.
 */
function parse_height (height? : number) : number {
  if (height === undefined || !Number.isInteger(height) || height < 0 || height > TIMELOCK_VALUE_MAX) {
    throw new Error(`Heightlock value must be an integer between 0 and ${TIMELOCK_VALUE_MAX}`)
  }
  return height
}

/**
 * Parses a code value into a number.
 * 
 * @param value - The value to parse.
 * @returns The parsed value.
 * @throws Error if the value is invalid.
 */
function parse_short (value: number = 0) : number {
  // Validate the value.
  if (!Number.isInteger(value) || value > METADATA_SHORT_MASK) {
    throw new Error(`Value must be an integer between 0 and ${METADATA_SHORT_MASK}`)
  }
  return value
}

/**
 * Parses a version value into a number.
 * 
 * @param value - The value to parse.
 * @returns The parsed value.
 * @throws Error if the value is invalid.
 */
function parse_byte (value: number = 0) : number {
  // Validate the value.
  if (!Number.isInteger(value) || value < 0 || value > METADATA_BYTE_MASK) {
    throw new Error(`Value must be an integer between 0 and ${METADATA_BYTE_MASK}`)
  }
  return value
}
