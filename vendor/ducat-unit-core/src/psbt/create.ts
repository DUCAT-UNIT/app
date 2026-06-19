/**
 * @fileoverview PSBT creation helpers and taproot script-path builders.
 */

import { Transaction }     from '@scure/btc-signer'
import { Buff, Bytes }     from '@vbyte/buff'
import { UNSPENDABLE_KEY } from '../const.js'

import {
  create_taproot,
  encode_tapscript
} from '@vbyte/btc-dev/taproot'

import type { TxOpts }           from '@scure/btc-signer/transaction.js'
import type { TransactionInput } from '@scure/btc-signer/psbt.js'

import type {
  CoinInput,
  CoinOutput,
  CoinUtxo,
  PSBTData,
  PSBTInput,
  PSBTOutput,
} from '../types/index.js'

interface TapScriptControlBlock {
  version     : number
  internalKey : Uint8Array
  merklePath  : Uint8Array[]
}

interface TapScriptConfig {
  index       : number
  version     : number
  internalKey : Uint8Array
}

type TapScriptEntry = [
  cblock : TapScriptControlBlock,
  script : Uint8Array
]

const DEFAULT_CONFIG : (() => TapScriptConfig) = () => ({
  index       : 0,
  version     : 0xc0,
  internalKey : Buff.hex(UNSPENDABLE_KEY)
})

export interface PSBTPrevout {
  amount : bigint
  script : Uint8Array
}

type PSBTInputMetadata = Pick<PSBTInput, 'tapInternalKey' | 'tapMerkleRoot' | 'tapLeafScript'>

/** Create a new empty PSBT transaction object. */
export function create_psbt (opts ?: TxOpts) : PSBTData {
  return new Transaction(opts)
}

/**
 * Convert an internal coin output model into PSBT output format.
 *
 * @param txoutput - Internal output descriptor.
 * @returns PSBT output entry with bigint amount and script bytes.
 */
export function create_psbt_output (
  txoutput : CoinOutput
) : PSBTOutput {
  return {
    amount : BigInt(txoutput.value),
    script : Buff.bytes(txoutput.script_pk)
  }
}

/**
 * Convert a UTXO/input template into PSBT input format.
 *
 * @param txinput - UTXO template with optional sequence/witness overrides.
 * @returns PSBT input entry.
 */
export function create_psbt_input (
  txinput : (CoinUtxo & Partial<CoinInput>) & Partial<PSBTInputMetadata>
) : PSBTInput {
  const pvin : TransactionInput = {
    txid        : Buff.bytes(txinput.txid),
    index       : txinput.vout,
    sequence    : txinput.sequence ?? 0xFFFFFFFF,
    witnessUtxo : {
      amount : BigInt(txinput.value),
      script : Buff.bytes(txinput.script_pk)
    }
  }
  if (Array.isArray(txinput.witness) && txinput.witness.length > 0) {
    pvin.finalScriptWitness = txinput.witness.map(w => Buff.bytes(w))
  }
  if (txinput.tapInternalKey !== undefined) {
    pvin.tapInternalKey = txinput.tapInternalKey
  }
  if (txinput.tapMerkleRoot !== undefined) {
    pvin.tapMerkleRoot = txinput.tapMerkleRoot
  }
  if (txinput.tapLeafScript !== undefined) {
    pvin.tapLeafScript = txinput.tapLeafScript
  }
  return pvin
}

/**
 * Build one tapscript leaf proof entry for PSBT `tapLeafScript`.
 *
 * @param scripts - Candidate tapleaf scripts for the same taproot tree.
 * @param options - Tapleaf selection/configuration.
 * @returns Tuple of control block and serialized redeem script.
 */
export function create_psbt_tapscript_entry (
  scripts : (string | Uint8Array)[],
  options : Partial<TapScriptConfig> = {}
) : TapScriptEntry {
  // Merge the default config with the options.
  const config = { ...DEFAULT_CONFIG(), ...options }
  // Get the config values.
  const { index, internalKey } = config
  // Get the leaf version.
  const leaf_version = config.version
  // Convert the array of scripts into tapleaves.
  const leaves  = scripts.map(e => encode_tapscript(e, leaf_version))
  // Select the target tapleaf for the merkle proof.
  const target  = leaves[index]
  // Get the context of the taproot tree and pubkey.
  const tap_ctx = create_taproot({ target, leaves, pubkey: internalKey })
  // Get the version parity byte.
  const cblock_version = leaf_version | tap_ctx.parity
  // Serialize the redeem script.
  const redeem_script = Buff.join([ scripts[index], Buff.num(leaf_version, 1) ])
  // Serialize the merkle path segments.
  const merkle_path = tap_ctx.path.map(e => new Buff(e))
  // Return all data in the scure PSBT format.
  return [ { version: cblock_version, internalKey, merklePath: merkle_path }, redeem_script ]
}

/**
 * Build a taproot hashlock tuple `[hash, preimage]` for PSBT fields.
 *
 * @param thold_hash - Threshold hash lock.
 * @param thold_key - Threshold preimage key.
 * @returns Hash/preimage byte tuple.
 */
export function create_psbt_hashlock_entry (
  thold_hash : Bytes,
  thold_key  : Bytes
) : [ Uint8Array, Uint8Array ] {
  const hash = Buff.bytes(thold_hash)
  const pimg = Buff.bytes(thold_key)
  return [ hash, pimg ]
}

/**
 * Create a PSBT input configured for taproot script-path spending.
 *
 * @param scripts - Taproot script tree leaves.
 * @param txinput - Funding input.
 * @param options - Tapleaf selection/configuration.
 * @returns PSBT input with `tapLeafScript` and `tapInternalKey` metadata.
 */
export function create_psbt_tapscript_input (
  scripts : (string | Uint8Array)[],
  txinput : CoinInput,
  options : Partial<TapScriptConfig> = {}
) : PSBTInput {
  const config = { ...DEFAULT_CONFIG(), ...options }
  return {
    ...create_psbt_input(txinput),
    tapLeafScript  : [ create_psbt_tapscript_entry(scripts, config) ],
    tapInternalKey : config.internalKey
  }
}
