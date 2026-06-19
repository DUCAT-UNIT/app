/**
 * @fileoverview Vault txdata extraction — pull vault context, config, return-data, and liquidation inputs from raw transactions.
 */

import { Buff }                     from '@vbyte/buff'
import { Assert }                   from '@vbyte/util'
import { hash160 }                  from '@vbyte/crypto/hash'
import { decode_vault_commit_data } from './commit.js'

import { OP_RETURN_CODE, OP_RETURN_TYPE, SYMBOLS } from '@/const.js'

import {
  calc_collateral_ratio,
  parse_cosigner_script,
  get_coin_utxo,
  get_vault_action_vout_idx,
  parse_witness_commits,
  parse_tx_data,
  get_vault_action_label,
  decode_vault_return_script,
  parse_liquidation_script,
  encode_coin_id,
  get_vault_terms,
  get_adjusted_unit_price,
  get_asset_profile
} from '@/lib/index.js'

import {
  ProtoTxData,
  VaultTxData,
  VaultTxContext,
  VaultConfigData,
  CoinUtxo,
  ProtoTxInput,
  LiquidTxInput,
  VaultReturnData,
  ProtoProfile
} from '@/types/index.js'

const ACTION_CODES = Object.values(SYMBOLS.CODE.VAULT)
const CONNECT_CODE = SYMBOLS.CODE.INPUT.CONNECT
const LIQUID_CODE  = SYMBOLS.CODE.INPUT.LIQUID
const RETURN_MAGIC = Buff.join([ OP_RETURN_CODE, OP_RETURN_TYPE.VAULT ]).hex

/** Extract first vault-action input context from transaction inputs. */
export function extract_vault_ctx (
  txdata : ProtoTxData
) : VaultTxContext | null {
  // Iterate over the transaction inputs.
  for (const [ idx, input ] of txdata.vin.entries()) {
    // If the witness script is not present, skip.
    if (!input.witness.script) continue
    // If the sequence type is not metadata, skip.
    if (input.sequence.type !== 'metadata') continue
    // If the sequence code is not a vault action, skip.
    if (!ACTION_CODES.includes(input.sequence.code)) continue
    // Extract the vault input data.
    const coin_id       = encode_coin_id(txdata.txid, idx)
    const spend_id      = input.coin_id
    const vault_action  = get_vault_action_label(input.sequence.code)
    const vault_config  = extract_vault_config(txdata)
    const vault_signers = parse_cosigner_script(input.witness.script)
    const vault_vout    = get_vault_action_vout_idx(vault_action)
    const vault_utxo    = (vault_vout >= 0) ? get_coin_utxo(txdata, vault_vout) : null
    const vault_version = input.sequence.version
    // Non-terminal actions must produce a continuation vault output.
    if (vault_action !== 'close') {
      Assert.exists(vault_utxo, 'vault utxo is null')
    }
    // Return the vault input data.
    return { coin_id, spend_id, vault_action, vault_config, vault_input : input, vault_signers, vault_utxo, vault_version }
  }
  // Return null if no vault input is found.
  return null
}

/** Decode vault configuration commit payload, if present in witness commits. */
export function extract_vault_config (
  txdata : ProtoTxData
) : VaultConfigData | null {
  const wit_commits  = parse_witness_commits(txdata)
  // Find the vault commit within the transaction.
  const vault_commit = wit_commits.find(c => ACTION_CODES.includes(c.seq_code)) ?? null
  // If no vault commit is found, return null.
  if (!vault_commit?.content) return null
  // Return the vault config data.
  return decode_vault_commit_data(vault_commit.content)
}

/** Find connector input (`CONNECT_CODE`) used alongside vault transitions. */
export function extract_vault_connector_input (
  txdata : ProtoTxData
) : ProtoTxInput | null {
  // Iterate over the transaction inputs.
  for (const input of txdata.vin) {
    // If the sequence type is not metadata, skip.
    if (input.sequence.type !== 'metadata') continue
    // If the sequence code is not a connect code, skip.
    if (input.sequence.code !== CONNECT_CODE) continue
    // Return the connector input.
    return input
  }
  // Return null if no connector input is found.
  return null
}

/** Compute collateral ratio from vault return data and resolved vault UTXO. */
export function extract_vault_ratio (
  proto_profile : ProtoProfile,
  vault_return  : VaultReturnData | null,
  vault_utxo    : CoinUtxo | null
) : number | null {
  // If the vault return or utxo is null, return null.
  if (!vault_return || !vault_utxo) return null
  // If the unit price is null, return null.
  if (vault_return.unit_price === null) return null
  // Get the vault terms.
  const vault_terms   = get_vault_terms(proto_profile.proto_terms)
  // Get the unit asset profile.
  const unit_profile  = get_asset_profile(proto_profile, vault_terms.unit_asset_id)
  // Unpack the vault return data.
  const { unit_balance, unit_price } = vault_return
  // Calculate the vault balance.
  const vault_balance = vault_utxo.value - vault_terms.vault_value_min
  // Calculate the adjusted unit price.
  const adj_price     = get_adjusted_unit_price(unit_price, unit_profile.div)
  // Return the calculated collateral ratio.
  return calc_collateral_ratio(vault_balance, unit_balance, adj_price)
}

/** Parse and decode vault OP_RETURN payload from transaction outputs. */
export function extract_vault_return_data (
  proto_profile : ProtoProfile,
  proto_txdata  : ProtoTxData
) : VaultReturnData | null {
  // Iterate over the transaction outputs.
  for (const output of proto_txdata.vout) {
    // If the output type is not an OP_RETURN, skip.
    if (output.type !== 'opreturn')                 continue
    // If the output script does not start with the return magic, skip.
    if (!output.script_pk.startsWith(RETURN_MAGIC)) continue
    // Return the decoded vault return data.
    return decode_vault_return_script(proto_profile, output.script_pk)
  }
  // Return null if no vault return data is found.
  return null
}

/** Build normalized vault transaction data from raw tx input/output structure. */
export function extract_vault_txdata (
  proto_profile : ProtoProfile,
  proto_txdata  : ProtoTxData | string
) : VaultTxData | null {
  // Parse the transaction data if it is a string.
  const txdata = (typeof proto_txdata === 'string')
    ? parse_tx_data(proto_txdata)
    : proto_txdata
  // Extract the vault input.
  const vault_ctx = extract_vault_ctx(txdata)
  // If no vault input is found, return null.
  if (!vault_ctx) return null
  // Extract the connector input.
  const conn_input = extract_vault_connector_input(txdata)
  // Extract the vault return data from the transaction.
  const vault_return = extract_vault_return_data(proto_profile, txdata)
  // Finding #10: only the terminal `close` action may omit the vault
  // OP_RETURN payload. Every other action MUST carry return data — a
  // missing OP_RETURN on a non-close action means the transaction is
  // malformed or the return data was stripped/substituted, and the
  // downstream profile would silently fall back to DEFAULT_RETURN_DATA
  // (cleared state), masking the real vault state.
  if (vault_return === null && vault_ctx.vault_action !== 'close') {
    throw new Error(
      `extract_vault_txdata: missing vault return data for non-close action '${vault_ctx.vault_action}'`
    )
  }
  // Extract the vault ratio.
  const vault_ratio  = extract_vault_ratio(proto_profile, vault_return, vault_ctx.vault_utxo)
  // Return the vault context.
  return { ...vault_ctx, conn_input, vault_ratio, vault_return }
}

/** Extract liquidation inputs and parsed liquidation scripts from a tx. */
export function extract_liquid_inputs (
  proto_txdata : ProtoTxData | string
) : LiquidTxInput[] {
  // Ensure the transaction data is a ProtoTxData object.
  const txdata = (typeof proto_txdata === 'string')
    ? parse_tx_data(proto_txdata)
    : proto_txdata
  // Define the liquid inputs array.
  const liquid_inputs : LiquidTxInput[] = []
  // Iterate over the transaction inputs.
  for (const [ idx, input ] of txdata.vin.entries()) {
    // If the witness script is not present, skip.
    if (!input.witness.script) continue
    // If the sequence type is not metadata, skip.
    if (input.sequence.type !== 'metadata')  continue
    // If the sequence code is not a liquid code, skip.
    if (input.sequence.code !== LIQUID_CODE) continue
    // Parse the liquidation script.
    const liquid_script  = parse_liquidation_script(input.witness.script)
    // Extract the liquid utxo.
    const liquid_utxo    = get_coin_utxo(txdata, idx)
    // Extract the liquid version.
    const liquid_version = input.sequence.version
    // Assert that the liquid utxo is present.
    Assert.exists(liquid_utxo, 'liquid utxo is null')
    // Add the liquid input to the array.
    liquid_inputs.push({ liquid_input: input, liquid_script, liquid_utxo, liquid_version })
  }
  // Return the liquid inputs.
  return liquid_inputs
}

/**
 * Extract the revealed threshold key (`thold_key`) from a liquidation
 * input's witness.
 *
 * The liquidation tapleaf is `OP_HASH160 <liquid_hash> OP_EQUALVERIFY
 * <guard_pubkey> OP_CHECKSIG`, so spending it reveals the `thold_key` as
 * the hash160 preimage among the witness data pushes. We locate it by
 * matching `hash160(element) === liquid_script.liquid_hash` rather than by
 * position — self-validating and independent of stack layout.
 *
 * `validator-ts` calls this when indexing a liquidation to populate the
 * liquid vault's `liquid_key`; the authorizing breach contract is then
 * re-derivable from the vault's committed price contracts + this key.
 *
 * @throws If no witness element hashes to the script's `liquid_hash`.
 */
export function extract_liquid_thold_key (
  liquid : LiquidTxInput
) : string {
  const { liquid_input, liquid_script } = liquid
  // Witness data pushes (the elements before script + control block).
  const params    = liquid_input.witness.params
  // The thold_key is the push whose hash160 equals the committed hash.
  const thold_key = params.find(el => hash160(el).hex === liquid_script.liquid_hash)
  Assert.exists(
    thold_key,
    `extract_liquid_thold_key: no witness element hashes to liquid_hash (${liquid_script.liquid_hash})`
  )
  return thold_key
}
