/**
 * @fileoverview Liquidation quote and liquid-vault profile/manifest type definitions.
 */

import type {
  BreachedPriceContract,
  ProtoProfile,
  VaultProfile
} from '@/types/index.js'

export interface LiquidVaultConfig {
  breach_contracts : BreachedPriceContract[]
  liquid_price     : number
  proto_profile    : ProtoProfile
}

export interface LiquidationQuote {
  claimed_sats     : number
  claimed_unit     : number
  deficit_ratio    : number
  deficit_sats     : number
  reserve_rate     : number
  reserve_sats     : number
  reward_ratio     : number
  reward_sats      : number
  subsidy_multi    : number
  subsidy_rate     : number
}

export interface LiquidVaultProfile extends VaultProfile, LiquidationQuote {
  /**
   * The revealed threshold key that authorizes this liquidation. It is
   * the hash160 preimage published in the on-chain liquidation witness;
   * `validator-ts` extracts it via `extract_liquid_thold_key`.
   *
   * The authorizing breach contract is NOT stored — it is derivable.
   * `verify_vault_liquidate` reconstructs the vault's committed price
   * contracts from its own `price_commits` (`extract_vault_price_contracts`)
   * and pairs the one whose `thold_hash === hash160(liquid_key)` with this
   * revealed key. Reconstructing from the prev vault's on-chain commits is
   * strictly stronger than trusting a caller-supplied breach array.
   */
  liquid_key       : string
  liquid_price     : number
}

/**
 * Aggregated totals for liquidation of multiple vaults.
 * Used to summarize cleared or trimmed vault batches.
 */
export interface LiquidVaultTotal {
  /** Total UNIT tokens claimed from liquidated vaults */
  claimed_unit  : number
  /** Total satoshi deficit (shortfall from collateral) */
  deficit_sats  : number
  /** Total satoshis reserved for protocol */
  reserve_sats  : number
  /** Total satoshis returned to vault owners */
  return_sats   : number
  /** Total UNIT tokens returned to vault owners */
  return_unit   : number
  /** Total satoshi reward for liquidators */
  reward_sats   : number
}

/**
 * Manifest describing the result of a liquidation operation.
 * Contains both cleared (fully liquidated) and trimmed (partially liquidated) vaults.
 */
export interface LiquidationManifest {
  /** Array of fully liquidated vault profiles, or null if none */
  cleared_vaults      : LiquidVaultProfile[] | null
  /** Aggregated totals for cleared vaults, or null if none */
  cleared_total       : LiquidVaultTotal | null
  /** Single partially liquidated vault, or null if none */
  trimmed_vault       : LiquidVaultProfile | null
  /** Totals for the trimmed vault, or null if none */
  trimmed_total       : LiquidVaultTotal | null
  /** Total UNIT tokens claimed across all liquidated vaults */
  total_unit_claimed  : number
  /** Total satoshi deficit across all liquidations */
  total_sats_deficit  : number
  /** Total satoshi reward for liquidators */
  total_sats_reward   : number
}
