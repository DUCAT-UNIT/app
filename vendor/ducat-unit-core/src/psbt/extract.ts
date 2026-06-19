
/**
 * @fileoverview PSBT extraction helpers for UTXOs, normalized inputs, and sighashes.
 */

import { Buff }                 from '@vbyte/buff'
import { Assert }               from '@vbyte/util'
import { get_psbt_prevouts }    from './getter.js'
import { decode_psbt, parse_psbt } from './parse.js'

import { finalize_spending_inputs } from './finalize.js'
import { get_lock_script_type }     from '@vbyte/btc-dev/script'

import {
  decode_tx,
  get_txid,
} from '@vbyte/btc-dev/tx'

import {
  assert_psbt_input,
  assert_psbt_output
} from './assert.js'

import type {
  CoinInput,
  CoinUtxo,
  PSBTData
} from '../types/index.js'

/**
 * Extract one output from a PSBT as a canonical UTXO model.
 *
 * @param psbt - PSBT object/serialized payload.
 * @param index - Output index.
 * @returns Coin UTXO representation for the selected output.
 */
export function extract_utxo (
  psbt  : PSBTData,
  index : number
) : CoinUtxo {
  const pdata = parse_psbt(psbt)
  const txout = pdata.getOutput(index)
  assert_psbt_output(txout)
  // Finalize BEFORE decoding the tx for txid computation (Codex #23).
  // Finalization adds finalScriptSig for P2SH-wrapped inputs, which is
  // part of the txid preimage. Decoding pre-finalization (as the prior
  // code did) computes a txid from the unsigned template that does not
  // match the broadcast transaction — the wallet would record a UTXO
  // under a txid that never lands on-chain.
  finalize_spending_inputs(pdata)
  const txdata = decode_tx(pdata.hex)
  return {
    txid      : get_txid(txdata),
    vout      : index,
    value     : Number(txout.amount),
    script_pk : new Buff(txout.script).hex
  }
}

/**
 * Extract one input from a PSBT as a normalized coin input descriptor.
 *
 * @param psbt - PSBT object/serialized payload.
 * @param index - Input index.
 * @returns Coin input representation with prevout metadata.
 */
export function extract_txinput (
  psbt  : PSBTData,
  index : number
) : CoinInput {
  const pdata   = parse_psbt(psbt)
  const txinput = pdata.getInput(index)
  assert_psbt_input(txinput)
  return {
    txid      : new Buff(txinput.txid).hex,
    vout      : txinput.index,
    value     : Number(txinput.witnessUtxo.amount),
    script_pk : new Buff(txinput.witnessUtxo.script).hex,
    sequence  : txinput.sequence ?? 0xFFFFFFFF,
    witness   : []
  }
}

/**
 * Compute the spend preimage hash for a finalized PSBT input.
 *
 * Selects the correct sighash preimage path by input script type
 * (`p2sh-p2wpkh`, `p2wpkh`, `p2tr`).
 *
 * @param pdata - Parsed PSBT data.
 * @param index - Input index.
 * @returns Hex-encoded sighash preimage.
 */
export function extract_spend_sighash (
  pdata : PSBTData,
  index : number
) : string {
  const prevouts = get_psbt_prevouts(pdata)
  const script   = prevouts.scripts.at(index)
  const amount   = prevouts.amounts.at(index)
  Assert.exists(script, `prevout script not found for index: ${index}`)
  Assert.exists(amount, `prevout amount not found for index: ${index}`)
  const txinput  = pdata.getInput(index)
  assert_psbt_input(txinput)
  const script_type = get_lock_script_type(Buff.bytes(script).hex)
  if (script_type === 'p2sh') {
    Assert.ok(txinput.finalScriptSig?.at(1) === 20, 'invalid scriptsig for wrapped segwit')
    const pk_hash   = new Buff(txinput.finalScriptSig.slice(2)).hex
    const sigscript = Buff.hex(`76a914${pk_hash}88ac`)
    return new Buff(pdata.preimageWitnessV0(index, sigscript, 1, amount)).hex
  } else if (script_type === 'p2wpkh') {
    const pk_hash   = new Buff(script.slice(2)).hex
    const sigscript = Buff.hex(`76a914${pk_hash}88ac`)
    return new Buff(pdata.preimageWitnessV0(index, sigscript, 1, amount)).hex
  } else if (script_type === 'p2tr') {
    return new Buff(pdata.preimageWitnessV1(index, prevouts.scripts, 0, prevouts.amounts)).hex
  } else {
    throw new Error(`invalid input type: ${script_type}`)
  }
}

/**
 * Decode a PSBT, extract the finalized tx hex, and compute its txid.
 * @param psbt - Encoded PSBT string.
 * @returns Tuple of `[txid, txHex]`.
 */
export function extract_psbt_tx (psbt : string) : [string, string] {
  const pdata = decode_psbt(psbt)
  const txid  = get_txid(pdata.hex)
  return [ txid, pdata.hex ]
}
