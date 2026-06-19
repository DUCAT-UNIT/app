/**
 * @fileoverview Liquidation math helpers for reserve/subsidy/tax computations.
 */

import {
  calc_portion,
  calc_ratio,
  trim_float
} from '../calc.js'

import type { VaultTerms } from '@/types/index.js'

/**
 * Calculate the amount of sats that is being liquidated from the vault. This amount
 * is based on the portion of unit being repossessed, over the total unit in the vault.
 *
 * @param repo_amount  - The amount of units that is being repossessed.
 * @param sats_balance - The total amount of sats value in the vault.
 * @param unit_balance - The total amount of unit debt in the vault.
 * @returns The amount of sats that is being liquidated.
 */
export function get_liquid_sats_portion (
  repo_amount  : number,
  sats_balance : number,
  unit_balance : number
) : number {
  // Calculate the ratio of unit being repossessed.
  const repo_ratio = calc_ratio(repo_amount, unit_balance)
  // Return the amount of sats that is being liquidated.
  return calc_portion(sats_balance, repo_ratio)
}

/**
 * Calculate the tax rate to use for liquidation, based on the minimum liquidation threshold.
 *
 * @param vault_terms - The vault terms for the protocol.
 * @returns The tax rate to use for liquidation.
 */
export function calc_liquid_tax_rate (
  vault_terms : VaultTerms
) : number {
  // Define the tax rate from the liquidation terms.
  const { liquidation_tax, liquidation_thold } = vault_terms
  // Return the tax rate multiplied by the minimum liquidation threshold.
  return trim_float(liquidation_thold * liquidation_tax)
}

/**
 * Calculate the tax revenue rate based on the collateral ratio.
 *
 * @param vault_terms - The vault terms for the protocol.
 * @param coll_ratio  - The collateral ratio of the vault.
 * @returns The tax rate to use for liquidation.
 */
export function calc_liquid_rev_rate (
  vault_terms : VaultTerms,
  coll_ratio  : number
) : number {
  // Define the tax rate from the liquidation terms.
  const tax_rate = vault_terms.liquidation_tax
  // Return the tax rate multiplied by the collateral ratio.
  return trim_float(coll_ratio * tax_rate)
}

/**
 * Calculate the subsidy multiplier to use for liquidation, based on the collateral ratio.
 *
 * @param vault_terms - The vault terms for the protocol.
 * @param coll_ratio  - The collateral ratio of the vault.
 * @returns The subsidy multiplier to use for liquidation.
 */
export function calc_liquid_subsidy_multiplier (
  vault_terms : VaultTerms,
  coll_ratio  : number
) : number {
  // Subsidy multiplier is a step count (percent points below threshold),
  // consumed by calc_liquid_subsidy_rate via subsidy_increment.
  const { subsidy_thold } = vault_terms
  // If the ratio is equal or above the subsidy threshold, return zero
  if (coll_ratio >= subsidy_thold) return 0
  // Calculate the deficit between the ratio and threshold.
  return Math.round((subsidy_thold - coll_ratio) * 100)
}

/**
 * Calculate the subsidy rate to use for liquidation.
 *
 * @param vault_terms   - The vault terms for the protocol.
 * @param subsidy_multi - The subsidy multiplier to use for liquidation.
 * @returns The subsidy rate to use for liquidation.
 */
export function calc_liquid_subsidy_rate (
  vault_terms   : VaultTerms,
  subsidy_multi : number
) : number {
  // Define the subsidy increment rate from the liquidation terms.
  const subsidy_increment = vault_terms.subsidy_increment
  // Return the subsidy rate.
  return trim_float(subsidy_increment * subsidy_multi)
}

/**
 * Calculate the reserve rate to use for liquidation.
 *
 * @param tax_rate     - The tax rate to use for liquidation.
 * @param subsidy_rate - The subsidy rate to use for liquidation.
 * @returns The reserve rate to use for liquidation.
 */
export function calc_liquid_reserve_rate (
  tax_rate     : number,
  subsidy_rate : number
) : number {
  // The reward rate is the lower of the subsidy rate or tax rate.
  const sub_rate = Math.min(tax_rate, subsidy_rate)
  // Return the tax rate minus the reward rate, or zero if result is negative.
  return trim_float(tax_rate - sub_rate)
}

/**
 * Calculate the reserve value in sats from the liquid sats and the reserve rate.
 *
 * @param vault_terms  - The vault terms for the protocol.
 * @param reserve_rate - The reserve rate to use for the calculation.
 * @param sats_balance - The sats balance to use for the calculation.
 * @returns The reserve value in sats.
 */
export function calc_liquid_reserve_sats (
  vault_terms  : VaultTerms,
  reserve_rate : number,
  sats_balance : number
) : number {
  // Define the minimum amount of sats required for spending.
  const min_sats_amt  = vault_terms.reserve_sats_min
  // Calculate the amount of sats that should be reserved.
  const reserved_sats = calc_portion(sats_balance, reserve_rate)
  // Return the amount of sats reserved, or zero if below the minimum.
  return (reserved_sats >= min_sats_amt) ? reserved_sats : 0
}
