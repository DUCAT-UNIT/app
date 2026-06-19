/**
 * @fileoverview Liquidation quote builders for full and partial recap scenarios.
 */

import { Assert }          from '@vbyte/util/assert'
import { get_vault_terms } from '../proto/terms.js'
import { get_asset_profile } from '../asset.js'

import {
  calc_collateral_ratio,
  calc_portion_ceil,
  calc_ratio,
  convert_unit_to_sats,
  get_adjusted_unit_price,
  trim_float
} from '@/lib/calc.js'

import {
  calc_liquid_reserve_rate,
  calc_liquid_reserve_sats,
  calc_liquid_subsidy_multiplier,
  calc_liquid_subsidy_rate
} from './calc.js'

import type {
  LiquidationQuote,
  ProtoProfile
} from '@/types/index.js'

/**
 * Get the liquidation quote for a given repossession amount and vault balance.
 *
 * @param proto_profile - The protocol profile containing asset divisibility.
 * @param claimed_sats  - The claimed satoshis amount.
 * @param claimed_unit  - The claimed unit amount (in smallest units).
 * @param unit_price    - The base unit price (will be adjusted for divisibility).
 * @returns The liquidation quote for the vault.
 */
export function get_liquidation_quote (
  proto_profile : ProtoProfile,
  claimed_sats  : number,
  claimed_unit  : number,
  unit_price    : number
) : LiquidationQuote {
  // Assert that the inputs are finite, positive numbers. The finite
  // checks reject Infinity, which slips past a bare `> 0` (Codex #22
  // input hardening).
  Assert.ok(Number.isFinite(claimed_sats) && claimed_sats > 0, `claimed sats must be a finite positive number: ${claimed_sats}`)
  Assert.ok(Number.isFinite(claimed_unit) && claimed_unit > 0, `claimed unit must be a finite positive number: ${claimed_unit}`)
  Assert.ok(Number.isFinite(unit_price)   && unit_price   > 0, `unit price must be a finite positive number: ${unit_price}`)
  // Define the vault terms.
  const vault_terms      = get_vault_terms(proto_profile.proto_terms)
  // Get the UNIT asset profile by its ID.
  const unit_asset       = get_asset_profile(proto_profile, vault_terms.unit_asset_id)
  // Adjust the unit price for divisibility.
  const adj_unit_price   = get_adjusted_unit_price(unit_price, unit_asset.div)
  // Define the minimum collateral ratio from the liquidation terms.
  const min_coll_ratio   = vault_terms.vault_ratio_min
  // Define the liquidation tax rate from the liquidation terms.
  const liquidation_tax  = vault_terms.liquidation_tax
  // Calculate the collateral ratio between the liquid sats and the unit balance.
  const collateral_ratio = calc_collateral_ratio(claimed_sats, claimed_unit, adj_unit_price)
  // Calculate the subsidy multiplier.
  const subsidy_multi    = calc_liquid_subsidy_multiplier(vault_terms, collateral_ratio)
  // Calculate the protocol subsidy rate.
  const subsidy_rate     = calc_liquid_subsidy_rate(vault_terms, subsidy_multi)
  // Calculate the tax reserve rate, and cap the minimum result at zero.
  const reserve_rate     = calc_liquid_reserve_rate(liquidation_tax, subsidy_rate)
  // Calculate the tax reserve value in sats.
  const reserve_sats     = calc_liquid_reserve_sats(vault_terms, reserve_rate, claimed_sats)
  // Calculate the total value in sats that should be awarded to the liquidator.
  const reward_sats      = claimed_sats - reserve_sats
  // Assert that the reward sats is non-negative.
  // Zero reward is valid but unprofitable (vault at exactly 1:1 collateral).
  Assert.ok(reward_sats >= 0, `reward sats cannot be negative: ${reward_sats}`)
  // Calculate the reward ratio based on the sats amount rewardable to the liquidator.
  // If reward_sats is 0, reward_ratio will be 0 (unprofitable liquidation).
  const reward_ratio     = calc_collateral_ratio(reward_sats, claimed_unit, adj_unit_price)
  // Assert that the reward ratio is non-negative.
  Assert.ok(reward_ratio >= 0, `reward ratio cannot be negative: ${reward_ratio}`)
  // Calculate the deficit in the reward ratio.
  const deficit_ratio    = Math.max(0, trim_float(min_coll_ratio - reward_ratio))
  // Calculate the deficit in the unit amount (ceiling to ensure full coverage).
  const deficit_unit     = Math.ceil(deficit_ratio * claimed_unit)
  // Calculate the deficit in the sats amount.
  const deficit_sats     = (deficit_unit > 0) ? convert_unit_to_sats(deficit_unit, adj_unit_price) : 0
  // Return the context object.
  return {
    claimed_sats,
    claimed_unit,
    deficit_ratio,
    deficit_sats,
    reserve_sats,
    reserve_rate,
    reward_ratio,
    reward_sats,
    subsidy_multi,
    subsidy_rate
  }
}

/**
 * Scale a full liquidation quote down to a partial recapitalization amount.
 *
 * Computes the recap's share of the total deficit and applies it (ceiling-
 * rounded, to fully cover debt) to the claimed sats/unit, then rebuilds the
 * quote. Returns the original quote unchanged when there is no deficit.
 *
 * @param proto_profile - The protocol profile (for quote reconstruction).
 * @param liquid_quote  - The full liquidation quote to scale from.
 * @param recap_amount  - The partial recapitalization amount, in sats.
 * @param unit_price    - The unit price used to rebuild the quote.
 * @returns The partial liquidation quote (or the original when no deficit).
 * @throws {Error} When `recap_amount` is not greater than zero.
 */
export function get_partial_liquidation_quote (
  proto_profile : ProtoProfile,
  liquid_quote  : LiquidationQuote,
  recap_amount  : number,
  unit_price    : number
) : LiquidationQuote {
  // If the deficit sats is zero, return the original liquidation quote.
  if (liquid_quote.deficit_sats === 0) return liquid_quote
  // Assert that the recap amount is a positive number.
  Assert.ok(recap_amount > 0, `recap amount must be greater than zero: ${recap_amount}`)
  // Calculate the percentage of the recap amount out of the total deficit.
  const recap_percent = calc_ratio(recap_amount, liquid_quote.deficit_sats)
  // Calculate the claimed sats and unit balance using ceiling to ensure full debt coverage.
  const claimed_sats = calc_portion_ceil(liquid_quote.claimed_sats, recap_percent)
  const claimed_unit = calc_portion_ceil(liquid_quote.claimed_unit, recap_percent)
  // Return the partial liquidation quote.
  return get_liquidation_quote(proto_profile, claimed_sats, claimed_unit, unit_price)
}
