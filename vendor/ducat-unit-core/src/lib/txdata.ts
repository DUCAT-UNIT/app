/**
 * @fileoverview Raw transaction normalization helpers for protocol txdata types.
 */

import { parse_witness }   from '@vbyte/btc-dev/witness'
import { decode_locktime } from '@vbyte/btc-dev/meta'
import { encode_coin_id }  from './pointer.js'
import { decode_sequence } from './sequence.js'

import {
  get_lock_script_type,
  get_lock_script_version
} from '@vbyte/btc-dev/script'

import {
  encode_tx,
  get_tx_value,
  get_txid,
  get_txsize,
  parse_tx
} from '@vbyte/btc-dev/tx'

import type {
  TxData,
  TxInput,
  TxOutput
} from '@vbyte/btc-dev'

import type {
  ProtoTxCoinbase,
  ProtoTxData,
  ProtoTxInput,
  ProtoTxOutput
} from '../types/index.js'

/** Find first metadata input matching a specific sequence code. */
export function find_tx_input (
  inputs : ProtoTxInput[],
  code   : number
) : ProtoTxInput | null {
  for (const input of inputs) {
    if (input.coinbase) continue
    if (input.sequence.type !== 'metadata') continue
    if (input.sequence.code === code) return input
  }
  return null
}

/** Parse raw tx data into normalized protocol transaction structure. */
export function parse_tx_data (
  txdata : string | Uint8Array | TxData
) : ProtoTxData {
  const tx = parse_tx(txdata)
  return {
    locktime : decode_locktime(tx.locktime),
    txhex    : encode_tx(tx).hex,
    txid     : get_txid(tx),
    txsize   : get_txsize(tx),
    txtotal  : get_tx_value(tx),
    version  : tx.version,
    vin      : tx.vin
      .map(parse_tx_input)
      .filter((input): input is ProtoTxInput => input.coinbase === null),
    vout     : tx.vout.map(parse_tx_output),
  }
}

/** Normalize raw tx output into protocol output shape. */
export function parse_tx_output (
  txout : TxOutput
) : ProtoTxOutput {
  const lock_type = get_lock_script_type(txout.script_pk)
  // Finding #7: an unrecognized scriptPubKey must not throw — that
  // would let a single non-standard output DoS parsing of the entire
  // transaction. Preserve the output with type 'unknown' (and null
  // version); vault-scanning consumers filter for the types they need
  // and skip the rest.
  if (lock_type === null) {
    return {
      script_pk : txout.script_pk,
      type      : 'unknown',
      value     : Number(txout.value),
      version   : null,
    }
  }
  return {
    script_pk : txout.script_pk,
    type      : lock_type,
    value     : Number(txout.value),
    version   : get_lock_script_version(txout.script_pk),
  }
}

/** Normalize raw tx input into protocol input or coinbase representation. */
export function parse_tx_input (
  txin : TxInput
) : ProtoTxInput | ProtoTxCoinbase {
  if (txin.coinbase) {
    return txin
  } else {
    return {
      coinbase   : null,
      coin_id    : encode_coin_id(txin.txid, txin.vout),
      prevout    : txin.prevout ? parse_tx_output(txin.prevout) : null,
      sequence   : decode_sequence(txin.sequence),
      script_sig : txin.script_sig,
      txid       : txin.txid,
      vout       : txin.vout,
      witness    : parse_witness(txin.witness),
    }
  }
}
