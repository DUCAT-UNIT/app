/**
 * @fileoverview PSBT parse/encode normalization helpers.
 */

import { Transaction }  from '@scure/btc-signer'
import { Buff }         from '@vbyte/buff'
import { Test }         from '@vbyte/util'
import { Base64 }       from '@vbyte/crypto/encode'

import type { PSBTData } from '../types/index.js'

/**
 * Decode serialized PSBT input into a `Transaction`/`PSBTData` object.
 *
 * Accepts:
 * - raw PSBT bytes
 * - hex-encoded PSBT string
 * - base64-encoded PSBT string
 *
 * @param encoded_psbt - Encoded PSBT payload.
 * @returns Parsed PSBT transaction object.
 */
export function decode_psbt (encoded_psbt : string | Uint8Array) : PSBTData {
  if (encoded_psbt instanceof Uint8Array) {
    return Transaction.fromPSBT(encoded_psbt, { allowUnknownOutputs: true })
  } else if (Test.is_hex(encoded_psbt)) {
    const bytes = Buff.hex(encoded_psbt)
    return Transaction.fromPSBT(bytes, { allowUnknownOutputs: true })
  } else if (Test.is_base64(encoded_psbt)) {
    const bytes = Base64.decode(encoded_psbt)
    return Transaction.fromPSBT(bytes, { allowUnknownOutputs: true })
  } else {
    throw new Error(`invalid psbt string: ${encoded_psbt}`)
  }
}

/**
 * Encode a PSBT object into a base64 string.
 *
 * @param psbt - PSBT object.
 * @param version - PSBT serialization version.
 * @returns Base64-encoded PSBT string.
 */
export function encode_psbt (
  psbt    : PSBTData,
  version : number = 0
) : string {
  const bytes = psbt.toPSBT(version)
  return Base64.encode(bytes)
}

/**
 * Normalize mixed PSBT input types into a `PSBTData` instance.
 *
 * @param psbt - PSBT as object, bytes, hex string, or base64 string.
 * @returns Parsed PSBT transaction object.
 */
export function parse_psbt (psbt : string | Uint8Array | PSBTData) : PSBTData {
  if (psbt instanceof Transaction) {
    return psbt
  } else if (psbt instanceof Uint8Array || typeof psbt === 'string') {
    return decode_psbt(psbt)
  } else {
    throw new Error(`invalid psbt input: ${psbt}`)
  }
}
