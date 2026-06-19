/**
 * @fileoverview PSBT getter helpers for inputs, outputs, prevouts, and sequence metadata.
 */

import { Assert }          from '@vbyte/util'
import { parse_psbt }      from './parse.js'
import { decode_sequence } from '../lib/sequence.js'

import type {
  PSBTData,
  PSBTInput,
  PSBTOutput,
  PSBTPrevouts,
  SequenceData
} from '../types/index.js'

/**
 * Get all inputs from a PSBT.
 *
 * @param psbt - PSBT object or serialized payload.
 * @returns PSBT input array.
 */
export function get_psbt_vin (psbt : string | Uint8Array | PSBTData) : PSBTInput[] {
  const pdata = parse_psbt(psbt)
  const count = pdata.inputsLength
  const vins : PSBTInput[] = []
  for (let i = 0; i < count; i++) {
    const vin = pdata.getInput(i)
    vins.push(vin)
  }
  return vins
}

/** Sum witness UTXO input amounts across all PSBT inputs. */
export function get_psbt_vin_total (psbt : string | Uint8Array | PSBTData) : bigint {
  const pdata = parse_psbt(psbt)
  const count = pdata.inputsLength
  let total = BigInt(0)
  for (let i = 0; i < count; i++) {
    const vin = pdata.getInput(i)
    if (vin.witnessUtxo) {
      total += vin.witnessUtxo.amount
    }
  }
  return total
}

/**
 * Get all outputs from a PSBT.
 *
 * @param psbt - PSBT object or serialized payload.
 * @returns PSBT output array.
 */
export function get_psbt_vout (psbt : string | Uint8Array | PSBTData) : PSBTOutput[] {
  const pdata = parse_psbt(psbt)
  const count = pdata.outputsLength
  const vouts : PSBTOutput[] = []
  for (let i = 0; i < count; i++) {
    const vout = pdata.getOutput(i)
    vouts.push(vout)
  }
  return vouts
}

/**
 * Get prevout scripts/amounts for all PSBT inputs.
 *
 * @param psbt - PSBT object or serialized payload.
 * @returns Prevout arrays aligned to input order.
 */
export function get_psbt_prevouts (psbt : string | Uint8Array | PSBTData) : PSBTPrevouts {
  const pdata = parse_psbt(psbt)
  const count = pdata.inputsLength
  const amounts : bigint[]     = []
  const scripts : Uint8Array[] = []
  for (let i = 0; i < count; i++) {
    const vin = pdata.getInput(i)
    Assert.exists(vin.witnessUtxo, `no witness utxo found for PSBT input: ${i}`)
    amounts.push(vin.witnessUtxo.amount)
    scripts.push(vin.witnessUtxo.script)
  }
  return { amounts, scripts }
}

/**
 * Get one PSBT input by index.
 *
 * @param psbt - PSBT object or serialized payload.
 * @param index - Input index.
 * @returns PSBT input entry.
 */
export function get_psbt_input (
  psbt  : string | Uint8Array | PSBTData,
  index : number
) : PSBTInput {
  const pdata = parse_psbt(psbt)
  return pdata.getInput(index)
}

/**
 * Get one PSBT output by index.
 *
 * @param psbt - PSBT object or serialized payload.
 * @param index - Output index.
 * @returns PSBT output entry.
 */
export function get_psbt_output (
  psbt  : string | Uint8Array | PSBTData,
  index : number
) : PSBTOutput {
  const pdata = parse_psbt(psbt)
  return pdata.getOutput(index)
}

/** Decode sequence metadata for a PSBT input when sequence is set. */
export function get_psbt_input_sequence (
  psbt  : string | Uint8Array | PSBTData,
  index : number
) : SequenceData | null {
  // Parse the PSBT object.
  const pdata = parse_psbt(psbt)
  // Get the input.
  const pvin  = pdata.getInput(index)
  // Return the sequence data, or null if unset.
  return (typeof pvin.sequence === 'number')
    ? decode_sequence(pvin.sequence)
    : null
}

/** Read metadata action code from a PSBT input sequence, if present. */
export function get_psbt_input_code (input : PSBTInput) : number | null {
  // Skip if the input sequence is not set.
  if (!input.sequence) return null
  // Decode the sequence data.
  const sdata = decode_sequence(input.sequence)
  // Skip if the sequence data is not a metadata input.
  if (sdata.type !== 'metadata') return null
  // Return the sequence data.
  return sdata.code
}
