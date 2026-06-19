/**
 * @fileoverview PSBT input finalization helpers by lock-script type.
 */

import { Assert }               from '@vbyte/util'
import { get_lock_script_type } from '@vbyte/btc-dev/script'

import type { PSBTData } from '../types/index.js'

/** Finalize spendable PSBT inputs based on recognized lock script types. */
export function finalize_spending_inputs (pdata : PSBTData) : void {
  // For each input in the PSBT,
  for (let i = 0; i < pdata.inputsLength; i++) {
    // Extract the input.
    const pvin = pdata.getInput(i)
    // If the input does not have a witness UTXO, skip it.
    if (!pvin.witnessUtxo) continue
    // Get the prevout script.
    const script = pvin.witnessUtxo.script
    // Get the script type.
    const type = get_lock_script_type(script)
    // If the script type is null, skip it.
    if (type === null) continue
    // If the script type is a P2SH, P2WPKH, or P2WSH,
    if (type === 'p2sh') {
      finalize_legacy_input(pdata, i)
    // Else, if the script type is a P2WPKH,
    } else if (type === 'p2wpkh') {
      finalize_p2wpkh_input(pdata, i)
    // Else, if the script type is a P2TR,
    } else if (type === 'p2tr') {
      // If the input has a tap leaf script, skip it.
      if (pvin.tapLeafScript !== undefined) continue
      // Finalize the input.
      finalize_p2tr_input(pdata, i)
    }
  }
}

/** Finalize a legacy-compatible input when redeem script/signature are present. */
export function finalize_legacy_input (
  pdata : PSBTData,
  index : number
) : void {
  // Extract the input.
  const pvin   = pdata.getInput(index)
  // Assert that the input has a witness UTXO.
  Assert.exists(pvin.witnessUtxo, 'input has no witness UTXO')
  // Extract the redeem script and partial signature.
  const script = pvin.redeemScript
  const psig   = pvin.partialSig?.at(0)
  // If the parameters are defined,
  if (script !== undefined && psig !== undefined) {
    // Finalize the input.
    pdata.finalizeIdx(index)
  }
}

/** Finalize native segwit key-path input when partial signature exists. */
export function finalize_p2wpkh_input (
  pdata : PSBTData,
  index : number
) : void {
  // Extract the input.
  const pvin = pdata.getInput(index)
  // Assert that the input has a witness UTXO.
  Assert.exists(pvin.witnessUtxo,     'input has no witness UTXO')
  // Assert that the input has no witness script.
  Assert.is_empty(pvin.witnessScript, 'input has witness script')
  // If a partial signature is defined,
  if (pvin.partialSig?.at(0) !== undefined) {
    // Finalize the input.
    pdata.finalizeIdx(index)
  }
}

/** Finalize taproot key-path input when taproot key signature exists. */
export function finalize_p2tr_input (
  pdata : PSBTData,
  index : number
) : void {
  // Extract the input.
  const pvin = pdata.getInput(index)
  // Assert that the input has a witness UTXO.
  Assert.exists(pvin.witnessUtxo, 'input has no witness UTXO')
  // Assert that the input has no tap leaf script.
  Assert.is_empty(pvin.tapLeafScript, 'input has tap leaf script')
  // If a partial signature is defined,
  if (pvin.tapKeySig?.at(0) !== undefined) {
    // Finalize the input.
    pdata.finalizeIdx(index)
  }
}
