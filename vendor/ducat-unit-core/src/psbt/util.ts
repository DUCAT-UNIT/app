/**
 * @fileoverview PSBT utility helpers for taproot control block encoding/decoding.
 */

import { TaprootControlBlock } from '@scure/btc-signer/psbt.js'

import type { ControlBlock } from '@/types/index.js'

/**
 * Encode a structured Taproot control block into PSBT wire bytes.
 */
export function encode_psbt_cblock (
  cblock : ControlBlock
) : Uint8Array {
  return TaprootControlBlock.encode(cblock)
}

/**
 * Decode Taproot control block bytes from PSBT into a structured object.
 */
export function decode_psbt_cblock (
  buffer : Uint8Array
) : ControlBlock {
  return TaprootControlBlock.decode(buffer)
}
