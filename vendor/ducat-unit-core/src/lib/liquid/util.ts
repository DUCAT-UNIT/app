/**
 * @fileoverview Liquidation selection helpers and recap aggregation utilities.
 */

import {
  extract_vault_price_contracts,
  validate_breached_price_contract
} from '@/lib/index.js'

import type {
  BreachedPriceContract,
  LiquidVaultProfile,
  ProtoProfile,
  VaultProfile,
  PriceContract
} from '@/types/index.js'

/**
 * Select the breached price contract that authorizes liquidation of
 * a given vault from a candidate set. Returns the contract whose
 * `thold_hash` corresponds to one of the vault's price commits and
 * whose `thold_key` has been revealed; the highest `thold_price` wins
 * when multiple candidates match.
 *
 * Returns `null` when no candidate matches — the vault is not yet
 * liquidatable from this evidence set.
 */
export function get_vault_breach_contract (
  proto_profile   : ProtoProfile,
  price_contracts : PriceContract[],
  vault_profile   : VaultProfile
) : BreachedPriceContract | null {
  // Build the vault-derived price contracts.
  const vault_contracts = extract_vault_price_contracts(proto_profile, vault_profile)
  // Get the contract ids for the vault.
  const contract_ids = vault_contracts.map(c => c.contract_id)
  // Select the highest-threshold breached contract for this vault.
  const selected = price_contracts
    .filter(c => contract_ids.includes(c.contract_id) && c.thold_key !== null)
    .sort((a, b) => b.thold_price - a.thold_price)
    .at(0)
  if (!selected) return null
  // Assert that the selected contract is valid (hash160 binding).
  validate_breached_price_contract(selected)
  return selected as BreachedPriceContract
}

/**
 * Select the breached threshold key for a vault from candidate price
 * contracts. Convenience wrapper over `get_vault_breach_contract` that
 * returns only the revealed `thold_key`.
 *
 * Intentional public convenience helper kept deliberately as published API.
 */
export function get_vault_liquidation_key (
  proto_profile   : ProtoProfile,
  price_contracts : PriceContract[],
  vault_profile   : VaultProfile
) : string | null {
  const breach = get_vault_breach_contract(proto_profile, price_contracts, vault_profile)
  return breach?.thold_key ?? null
}

/**
 * Select the vaults to be liquidated, in deterministic order.
 *
 * Closes Codex audit finding #12:
 *   - Drops vaults with `deficit_sats === 0` (nothing to recover; they
 *     have no business being absorbed into a repo/trim flow).
 *   - Sorts by `(deficit_sats DESC, root_txid ASC)`. Deterministic
 *     across runs and operator instances — replaces the previous
 *     `Math.random()`-based shuffle that made the selection set
 *     non-reproducible and (worse) sometimes excluded high-deficit
 *     vaults that should have been absorbed first.
 *
 * @param liquid_vaults - The array of liquid vault candidates.
 * @param recap_limit?  - The desired recap limit (cumulative
 *                        deficit_sats). When supplied, candidates are
 *                        included until the limit is met or exceeded.
 * @returns The selected vaults, in inclusion order.
 */
export function select_liquid_vaults (
  liquid_vaults : LiquidVaultProfile[],
  recap_limit?  : number
) : LiquidVaultProfile[] {
  // Filter out zero-deficit candidates (nothing to recover) and sort
  // by (deficit_sats DESC, root_txid ASC) — high-deficit first,
  // root_txid breaks ties deterministically.
  const sorted_vaults = liquid_vaults
    .filter(v => v.deficit_sats > 0)
    .sort((a, b) => {
      if (b.deficit_sats !== a.deficit_sats) return b.deficit_sats - a.deficit_sats
      return a.root_txid.localeCompare(b.root_txid)
    })
  // Initialize the selected vaults array.
  const selected_vaults : LiquidVaultProfile[] = []
  // Initialize the cumulative recap cost.
  let recap_cost = 0
  // For each vault, accumulate until the recap limit is met.
  for (const vault_profile of sorted_vaults) {
    recap_cost += vault_profile.deficit_sats
    selected_vaults.push(vault_profile)
    if (recap_limit && recap_cost >= recap_limit) break
  }
  return selected_vaults
}

/**
 * Get the total cost of recapitalization for the vaults.
 *
 * Intentional public convenience helper kept deliberately as published API.
 *
 * @param liquid_vaults - The array of liquid vaults.
 * @returns The total cost of recapitalization for the vaults.
 */
export function get_recap_costs_total (
  liquid_vaults : LiquidVaultProfile[]
) : number {
  return liquid_vaults.reduce((prev, curr) => prev + curr.deficit_sats, 0)
}
