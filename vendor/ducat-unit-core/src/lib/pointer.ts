/**
 * @fileoverview Encode/decode protocol identifiers referencing on-chain data.
 *
 * Identifier formats:
 * - Commit ID: '{txid}i{index}' — a specific commit/inscription
 * - Block ID:  '{height}:{tx_index}' — a transaction by block position
 * - Coin ID:   '{txid}:{vout}' — a specific UTXO (outpoint format)
 */

import type { CoinUtxo } from '../types/index.js'

// Import validators for local use
import {
  is_commit_id,
  is_block_id,
  is_coin_id,
  assert_commit_id,
  assert_block_id,
  assert_coin_id
} from '@/validate/pointer.js'

// Re-export validators
export {
  is_commit_id,
  is_block_id,
  is_coin_id,
  assert_commit_id,
  assert_block_id,
  assert_coin_id
}

/** Encode a commit pointer from txid and inscription index. */
export function encode_commit_id (
  txid  : string,
  index : number
) : string {
  return `${txid}i${index}`
}

/** Decode and validate a commit pointer into structured fields. */
export function decode_commit_id (
  commit_id : string
) : { txid : string, index : number } {
  assert_commit_id(commit_id)
  const [ txid, index_str ] = commit_id.split('i')
  const index = parseInt(index_str, 10)
  if (!Number.isSafeInteger(index)) {
    throw new Error(`commit id index exceeds safe integer range: ${index_str}`)
  }
  return { txid, index }
}

/** Encode a block pointer from block height and tx index. */
export function encode_block_id (
  block_height : number,
  txid_index   : number
) : string {
  return `${block_height}:${txid_index}`
}

/** Decode and validate a block pointer into structured fields. */
export function decode_block_id (
  block_id : string
) : { block_height : number, txid_index : number } {
  assert_block_id(block_id)
  const [ height_str, index_str ] = block_id.split(':')
  const block_height = parseInt(height_str, 10)
  const txid_index   = parseInt(index_str, 10)
  if (!Number.isSafeInteger(block_height)) {
    throw new Error(`block height exceeds safe integer range: ${height_str}`)
  }
  if (!Number.isSafeInteger(txid_index)) {
    throw new Error(`txid index exceeds safe integer range: ${index_str}`)
  }
  return { block_height, txid_index }
}

/** Encode an outpoint-style coin id (`txid:vout`). */
export function encode_coin_id (
  txid  : string,
  vout  : number
) : string {
  return `${txid}:${vout}`
}

/** Derive canonical coin id from a coin UTXO object. */
export function get_coin_id (
  utxo : CoinUtxo
) : string {
  return encode_coin_id(utxo.txid, utxo.vout)
}

/** Decode and validate an outpoint-style coin id. */
export function decode_coin_id (
  coin_id : string
) : { txid : string, vout : number } {
  assert_coin_id(coin_id)
  const [ txid, vout_str ] = coin_id.split(':')
  const vout = parseInt(vout_str, 10)
  if (!Number.isSafeInteger(vout)) {
    throw new Error(`coin vout exceeds safe integer range: ${vout_str}`)
  }
  return { txid, vout }
}
