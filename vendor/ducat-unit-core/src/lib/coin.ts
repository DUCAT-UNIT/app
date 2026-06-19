/**
 * @fileoverview Coin/utxo helpers — total value, coin selection, and utxo/input construction.
 */

import { Assert }      from '@vbyte/util/assert'
import { RANDOM_SORT } from './random.js'
import { DUST_LIMIT }  from '@/const.js'

import type {
  CoinInput,
  CoinUtxo,
  ProtoTxData,
} from '@/types/index.js'

const MAX_SEQUENCE = 0xFFFFFFFF

/** Sum satoshi value across a list of UTXOs. */
export function get_coin_total_value (
  coin_utxos : CoinUtxo[]
) : number {
  // Tally the total amount of funding inputs.
  return coin_utxos.reduce((prev, curr) => prev + curr.value, 0)
}

/** Select enough coins to cover a target amount. */
export function select_coins (
  coins  : CoinUtxo[],
  amount : number
) : CoinUtxo[] {
  // Initialize the selected coins array.
  const selected : CoinUtxo[] = []
  // Initialize the total amount value.
  let total = 0
  // Sort the coins randomly.
  coins.sort(RANDOM_SORT)
  // For each coin,
  for (const coin of coins) {
    // Add the coin to the selected coins array.
    selected.push(coin)
    // Add the coin value to the total amount.
    total += coin.value
    // If the total is greater than
    // or equal to the amount, break.
    if (total >= amount) break
  }
  // Assert that the total is greater than or equal to the amount.
  Assert.ok(total >= amount,     `insufficient funds: ${total} < ${amount}`)
  // Assert that the total is less than or equal to the dust limit.
  Assert.ok(total >= DUST_LIMIT, `funds below dust limit: ${total} < ${DUST_LIMIT}`)
  // Return the selected coins.
  return selected
}

/** Resolve coin UTXO by output index from parsed transaction data. */
export function get_coin_utxo (
  txdata : ProtoTxData,
  index  : number
) : CoinUtxo | null {
  // Return null for negative indices.
  if (index < 0) return null
  // Get the utxo from the txdata.
  const utxo = txdata.vout.at(index)
  // If the utxo is null, return null.
  if (utxo === undefined) return null
  // Return the utxo.
  return {
    script_pk : utxo.script_pk,
    txid      : txdata.txid,
    value     : utxo.value,
    vout      : index
  }
}

/** Normalize UTXO-like template into a complete coin input object. */
export function get_coin_input (
  template : CoinUtxo & Partial<CoinInput>
) : CoinInput {
  // Return the coin input.
  return {
    ...template,
    sequence : template.sequence ?? MAX_SEQUENCE,
    witness  : template.witness  ?? []
  }
}
