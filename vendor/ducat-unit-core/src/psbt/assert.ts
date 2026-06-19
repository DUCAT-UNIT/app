/**
 * @fileoverview Assertion helpers for required PSBT fields and funding checks.
 */

import { Assert } from '@vbyte/util'

import {
  get_psbt_vin,
  get_psbt_vout
} from './getter.js'

import type {
  PSBTData,
  PSBTFullInput,
  PSBTFullOutput,
  PSBTInput,
  PSBTOutput,
  PSBTPrevouts
} from '../types/index.js'

/**
 * Asserts the PSBT output exists with base transaction data.
 * @param psbt_out : PSBT Output object.
 */
export function assert_psbt_output (
  psbt_output : PSBTOutput
) : asserts psbt_output is PSBTFullOutput {
  Assert.exists(psbt_output)
  Assert.exists(psbt_output.amount)
  Assert.exists(psbt_output.script)
}

/**
 * Asserts the PSBT input exists with base transaction data.
 * @param psbt_vin : PSBT Input object.
 */
export function assert_psbt_input (
  psbt_input : PSBTInput
) : asserts psbt_input is PSBTFullInput {
  Assert.exists(psbt_input)
  Assert.exists(psbt_input.txid)
  Assert.exists(psbt_input.index)
  Assert.exists(psbt_input.witnessUtxo)
}

/**
 * Ensures a PSBT input has a prevout.
 * @param pvin - PSBT input.
 * @param idx - Index of the PSBT input.
 */
export function assert_has_prevout (
  pvin : PSBTInput,
  idx  : number
) : asserts pvin is PSBTInput & { witnessUtxo : PSBTPrevouts } {
  Assert.exists(pvin.witnessUtxo, `no witness utxo found for PSBT input: ${idx}`)
}

/**
 * Ensures a PSBT has all prevouts defined.
 * @param vins - PSBT input list.
 */
export function assert_has_prevouts (
  vins : PSBTInput[]
) : asserts vins is (PSBTInput & { witnessUtxo : PSBTPrevouts })[] {
  vins.forEach((vin, idx) => {
    assert_has_prevout(vin, idx)
  })
}

/**
 * Ensure total input value is at least total output value.
 *
 * @param pdata - Parsed PSBT object.
 */
export function assert_is_funded (pdata : PSBTData) : void {
  const prevouts = get_psbt_vin(pdata)
  const outputs  = get_psbt_vout(pdata)
  assert_has_prevouts(prevouts)
  const vin_amt  = prevouts.reduce((p, n) => p + Number(n.witnessUtxo.amount), 0)
  const out_amt  = outputs.reduce((p, n) => p + Number(n.amount), 0)
  Assert.ok(vin_amt >= out_amt, `transaction under-funded: ${vin_amt} sats < ${out_amt} sats`)
}
