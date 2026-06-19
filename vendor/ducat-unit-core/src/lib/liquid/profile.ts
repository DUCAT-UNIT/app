/**
 * @fileoverview Liquid-vault profile builders from vault state and breach data.
 */

import { Assert } from '@vbyte/util'

import {
  get_liquidation_quote,
  get_partial_liquidation_quote,
  get_vault_breach_contract
} from '@/lib/index.js'

import type {
  LiquidVaultProfile,
  LiquidVaultConfig,
  VaultProfile
} from '@/types/index.js'

/**
 * Get the liquid vault profiles.
 *
 * The authorizing breach is selected from the config's candidate set
 * only to derive each profile's `liquid_key` (the revealed thold_key)
 * and confirm the vault is liquidatable. The breach itself is not stored
 * on the output — verifiers re-derive it from the vault's committed
 * price contracts + `liquid_key`.
 *
 * @param liquid_config  - The liquid vault configuration.
 * @param vault_profiles - The vault profiles.
 * @returns The collected liquid vault profiles.
 */
export function get_liquid_vault_profiles (
  liquid_config  : LiquidVaultConfig,
  vault_profiles : VaultProfile[]
) : LiquidVaultProfile[] {
  // Unpack the configuration.
  const { proto_profile, breach_contracts, liquid_price } = liquid_config
  // Initialize the liquid vaults array.
  const liquid_vaults : LiquidVaultProfile[] = []
  // For each vault,
  for (const vault_profile of vault_profiles) {
    // Unpack the vault profile.
    const { unit_balance, vault_balance } = vault_profile
    // Get the matching breach contract for the vault.
    const breach = get_vault_breach_contract(proto_profile, breach_contracts, vault_profile)
    // If no matching breach is found, skip.
    if (!breach) continue
    // Get the liquidation quote for the vault.
    const liquid_quote = get_liquidation_quote(proto_profile, vault_balance, unit_balance, liquid_price)
    // Add the liquid vault to the array, carrying the revealed key. The
    // authorizing breach is re-derivable from (vault + proto + liquid_key).
    liquid_vaults.push({
      ...vault_profile,
      ...liquid_quote,
      liquid_key       : breach.thold_key,
      liquid_price
    })
  }
  // Return the liquid vaults.
  return liquid_vaults
}

/**
 * Get the liquid vault profile.
 *
 * Carries the revealed `liquid_key`; the authorizing breach is not stored
 * (re-derivable from the vault's committed contracts + `liquid_key`).
 *
 * @param liquid_config - The liquid vault configuration.
 * @param vault_profile - The vault profile.
 * @param recap_amount? - The recap amount.
 * @returns The liquid vault profile.
 */
export function get_liquid_vault_profile (
  liquid_config : LiquidVaultConfig,
  vault_profile : VaultProfile,
  recap_amount? : number
) : LiquidVaultProfile {
  // Unpack the configuration.
  const { proto_profile, breach_contracts, liquid_price } = liquid_config
  // Unpack the vault profile.
  const { unit_balance, vault_balance } = vault_profile
  // Get the matching breach contract for the vault.
  const breach = get_vault_breach_contract(proto_profile, breach_contracts, vault_profile)
  // Assert that the matching breach exists. Without this, a missing
  // breach would have silently produced a profile with `liquid_key: null`
  // that fails downstream verification (`Assert.ok` only throws on
  // strict `false`, not on `null` — this needs `Assert.exists`).
  Assert.exists(breach, `liquidation breach is missing from price contracts`)
  // Get the liquidation quote.
  const liquid_quote = get_liquidation_quote(proto_profile, vault_balance, unit_balance, liquid_price)
  const base = {
    ...vault_profile,
    liquid_key       : breach.thold_key,
    liquid_price
  }
  // If a recap amount is provided,
  if (recap_amount) {
    // Calculate the percentage of the recap amount out of the total deficit.
    const partial_quote = get_partial_liquidation_quote(proto_profile, liquid_quote, recap_amount, liquid_price)
    return { ...base, ...partial_quote }
  } else {
    return { ...base, ...liquid_quote }
  }
}
