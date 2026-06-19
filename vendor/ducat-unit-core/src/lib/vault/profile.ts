/**
 * @fileoverview Vault profile builders and accessors — create/update profiles and read price/ratio data.
 */

import { Assert } from '@vbyte/util'

import {
  calc_collateral_ratio,
  extract_vault_price_contracts,
  DEFAULT_RETURN_DATA,
  decode_coin_id,
  get_adjusted_unit_price,
  get_asset_profile,
  get_vault_terms
} from '@/lib/index.js'

import { verify_vault_balance } from './validate.js'

import type {
  VaultTxData,
  ProtoProfile,
  VaultProfile,
  CoinUtxo,
  PriceContract
} from '@/types/index.js'

/** Convert vault profile coin fields into a spendable UTXO object. */
export function get_vault_profile_utxo (
  vault_profile : VaultProfile
) : CoinUtxo {
  // Unpack the vault profile.
  const { coin_id, vault_script: script_pk, vault_value: value } = vault_profile
  Assert.exists(coin_id, 'vault profile has no active coin_id')
  Assert.exists(script_pk, 'vault profile has no active vault_script')
  Assert.exists(value, 'vault profile has no active vault_value')
  // Decode the coin ID.
  const { txid, vout } = decode_coin_id(coin_id)
  // Return the vault profile utxo.
  return { txid, vout, value, script_pk }
}

/** Collect unique price contracts referenced by a list of vault profiles. */
export function collect_vault_price_contracts (
  proto_profile  : ProtoProfile,
  vault_profiles : VaultProfile[]
) : PriceContract[] {
  // Initialize the set of price contracts.
  const price_contracts = new Set<PriceContract>()
  // For each vault profile,
  for (const vault_profile of vault_profiles) {
    // Get the price contracts for the vault profile.
    const contracts = extract_vault_price_contracts(proto_profile, vault_profile)
    // Add the price contracts to the set.
    for (const contract of contracts) {
      price_contracts.add(contract)
    }
  }
  // Return the array of price contracts.
  return Array.from(price_contracts)
}

/**
 * Get the price commit hashes for a vault profile.
 *
 * @param proto_profile - The proto profile.
 * @param vault_profile - The vault profile.
 * @returns The price contract parameters.
 */
export function get_vault_profile_price_hashes (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile
) : string[] {
  // Get the price contracts for the vault profile.
  const price_contracts = extract_vault_price_contracts(proto_profile, vault_profile)
  // Collect the price commit hashes from the price contracts.
  return price_contracts.map(c => c.commit_hash)
}

/** Recompute persisted vault ratio from locked price state and active proto. */
export function get_vault_profile_ratio (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile
) : number | null {
  const { unit_balance, unit_price, vault_balance } = vault_profile

  if (unit_price === null || unit_balance <= 0) return null

  const vault_terms  = get_vault_terms(proto_profile.proto_terms)
  const unit_profile = get_asset_profile(proto_profile, vault_terms.unit_asset_id)
  const adj_price    = get_adjusted_unit_price(unit_price, unit_profile.div)

  return calc_collateral_ratio(vault_balance, unit_balance, adj_price)
}

/** Build a new vault profile snapshot from parsed vault transaction data. */
export function create_vault_profile (
  proto_profile : ProtoProfile,
  vault_txdata  : VaultTxData
) : VaultProfile {
  // Unpack the vault transaction data.
  const { vault_return, vault_signers, vault_utxo } = vault_txdata
  Assert.exists(vault_utxo, 'vault utxo is required to create active vault profile')
  // Get the vault terms.
  const vault_terms = get_vault_terms(proto_profile.proto_terms)
  // Verify the vault balance is non-negative.
  verify_vault_balance(vault_utxo.value, vault_terms.vault_value_min)
  // Calculate the vault balance.
  const vault_balance = vault_utxo.value - vault_terms.vault_value_min
  // Define the vault return data.
  const return_data = vault_return ?? DEFAULT_RETURN_DATA()
  // Extract the vault transaction ID.
  const root_txid = decode_coin_id(vault_txdata.coin_id).txid
  // Return the vault profile.
  return {
    ...return_data,
    ...vault_signers,
    coin_id        : vault_txdata.coin_id,
    contract_id    : proto_profile.contract_id,
    root_txid      : root_txid,
    vault_action   : vault_txdata.vault_action,
    vault_balance  : vault_balance,
    vault_config   : vault_txdata.vault_config,
    vault_ratio    : vault_txdata.vault_ratio,
    vault_script   : vault_utxo.script_pk,
    vault_value    : vault_utxo.value,
    vault_version  : vault_txdata.vault_version,
  }
}

/** Build terminal vault profile for a close action (no continuation UTXO). */
export function create_vault_close_profile (
  proto_profile : ProtoProfile,
  prev_profile  : VaultProfile,
  vault_txdata  : VaultTxData
) : VaultProfile {
  const { vault_action, vault_return, vault_signers, vault_version } = vault_txdata
  Assert.ok(vault_action === 'close', 'create_vault_close_profile requires close action')
  Assert.exists(vault_return, 'create_vault_close_profile requires vault return data')

  return {
    ...vault_return,
    ...vault_signers,
    coin_id        : null,
    contract_id    : proto_profile.contract_id,
    root_txid      : prev_profile.root_txid,
    vault_action   : 'close',
    vault_balance  : 0,
    vault_config   : prev_profile.vault_config,
    vault_ratio    : null,
    vault_script   : null,
    vault_value    : null,
    vault_version
  }
}

/** Update an existing vault profile while preserving root txid/config continuity. */
export function update_vault_profile (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  vault_txdata  : VaultTxData
) : VaultProfile {
  if (vault_txdata.vault_action === 'close') {
    return create_vault_close_profile(proto_profile, vault_profile, vault_txdata)
  }
  // Create a new vault profile.
  const new_profile = create_vault_profile(proto_profile, vault_txdata)
  // Extract the root transaction ID.
  const root_txid    = vault_profile.root_txid
  // Extract the vault configuration.
  const vault_config = new_profile.vault_config ?? vault_profile.vault_config
  // Return the updated vault profile.
  return { ...new_profile, root_txid, vault_config }
}
