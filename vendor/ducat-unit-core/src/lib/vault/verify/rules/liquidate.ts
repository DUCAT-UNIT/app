/**
 * @fileoverview Vault liquidate action verification.
 *
 * `verify_vault_liquidate` validates the transition from a debt-bearing
 * vault to a `LiquidVaultProfile`. Closes Codex audit finding #4
 * (CRITICAL): binds `liquid_key` and `liquid_price` to a cryptographically
 * verified breach contract that the previous vault committed to, rather
 * than the previously-shipped naive `liquid_price <= prev.thold_price`
 * comparison that could be forged by anyone able to shape the
 * `LiquidVaultProfile`.
 *
 * `verify_vault_repo_liquidated` (full clear) and
 * `verify_vault_trim_liquidated` (partial — target retains debt) are the
 * per-target variants called by `verify_vault_repo` and `verify_vault_trim`
 * respectively, on each liquidated vault being absorbed in those flows.
 *
 * NOTE: `liquidate` is NOT a user-invokable vault action. `verify_vault_liquidate`
 * is the *target-state* verifier used by the repo/trim flows (via the
 * `_liquidated` helpers) and by client-sdk to verify a liquidated target's
 * transition. It is intentionally a strict-only verifier: there is no
 * `verify_vault_liquidate` composite and no `eval_vault_liquidate_policy`,
 * because a liquidation is authorized by the repo/trim flow that produces it
 * and its economics are policy-checked there (see `eval_vault_repo_policy` /
 * `eval_vault_trim_policy`). Callers must never dispatch `liquidate` as a
 * standalone user action.
 */

import { Assert } from '@vbyte/util'

import { verify_encumbered_vault }          from '@/lib/vault/validate.js'
import { extract_vault_price_contracts }    from '@/lib/vault/price.js'
import { get_price_contract_thold_hash }    from '@/lib/price/contract.js'
import { validate_breached_price_contract } from '@/lib/price/validate.js'
import { verify_price_contract }            from '@/lib/verify/price.js'
import { verify_vault_profile }             from '@/lib/verify/vault.js'
import { guard_members_equal }              from '../util.js'

import type {
  BreachedPriceContract,
  LiquidVaultProfile,
  ProtoProfile,
  VaultProfile
} from '@/types/index.js'

/**
 * Verify a vault liquidate action.
 *
 * Liquidate action requirements:
 * - Previous vault must be encumbered (has debt)
 * - The post-state `LiquidVaultProfile` must structurally verify
 * - The authorizing breach is *derived*, not supplied: reconstruct the
 *   prev vault's committed price contracts (`extract_vault_price_contracts`)
 *   and pair the one whose `thold_hash === hash160(liquid_key)` with the
 *   revealed `liquid_key`. A `liquid_key` that doesn't hash to one of the
 *   prev vault's commits cannot liquidate it (Finding #4 core exploit).
 * - The derived breach must verify: oracle signature, oracle membership
 *   in proto, `hash160(thold_key) === thold_hash`
 * - `liquid_price` must be `<=` the derived breach's `thold_price`
 * - Root txid must remain unchanged (vault lineage)
 *
 * Deriving from the prev vault's own on-chain commits is strictly stronger
 * than trusting a caller-supplied breach array: there is nothing to forge.
 *
 * @param proto_profile - Protocol profile (caller must have run verify_proto_profile)
 * @param vault_profile - Post-liquidation profile (the new liquid state)
 * @param prev_profile  - Pre-liquidation profile (the encumbered vault)
 * @throws Error if any verification fails
 */
export function verify_vault_liquidate (
  proto_profile : ProtoProfile,
  vault_profile : LiquidVaultProfile,
  prev_profile  : VaultProfile
) : void {
  // Structural validation of the post-state liquid profile.
  verify_vault_profile(vault_profile, proto_profile)

  // Previous vault must be encumbered (eligibility).
  verify_encumbered_vault(prev_profile)

  // Derive the authorizing breach from the prev vault's own committed
  // price contracts + the revealed liquid_key.
  const breach = derive_breach_contract(proto_profile, prev_profile, vault_profile.liquid_key)

  // Validate the derived breach end-to-end: structural + signature +
  // oracle authorization + revealed-key hash binding.
  verify_price_contract(breach, proto_profile)
  validate_breached_price_contract(breach)

  // The liquid_price must not exceed the breach's threshold.
  Assert.ok(
    vault_profile.liquid_price <= breach.thold_price,
    `verify_vault_liquidate: liquid_price (${vault_profile.liquid_price}) must be <= ` +
    `breach.thold_price (${breach.thold_price})`
  )

  // Root txid must remain unchanged (vault lineage).
  Assert.ok(
    vault_profile.root_txid === prev_profile.root_txid,
    'verify_vault_liquidate: root_txid must remain unchanged'
  )
}

/**
 * Identity-continuity checks shared by repo and trim liquidated targets:
 * the absorbing liquidation must preserve the target vault's guardians and
 * client, and mark it as a `liquidate` action.
 */
function verify_liquidated_target_identity (
  target      : LiquidVaultProfile,
  target_prev : VaultProfile
) : void {
  Assert.ok(
    guard_members_equal(target.guard_members, target_prev.guard_members),
    'verify_liquidated_target: guard members must remain unchanged'
  )
  Assert.ok(
    target.client_pubkey === target_prev.client_pubkey,
    'verify_liquidated_target: client pubkey must remain unchanged'
  )
  Assert.ok(
    target.vault_action === 'liquidate',
    'verify_liquidated_target: vault action must be liquidate'
  )
}

/**
 * Verify a liquidated target absorbed in a REPO (full liquidation) flow.
 * Breach chain + identity continuity, plus terminal-cleared invariants: a
 * repo target is fully wiped — no remaining debt, no ratio.
 *
 * @param proto_profile - Protocol profile (caller-verified)
 * @param target        - The liquidated target vault profile
 * @param target_prev   - The target's own pre-liquidation profile
 * @throws Error if any verification fails
 */
export function verify_vault_repo_liquidated (
  proto_profile : ProtoProfile,
  target        : LiquidVaultProfile,
  target_prev   : VaultProfile
) : void {
  verify_vault_liquidate(proto_profile, target, target_prev)
  verify_liquidated_target_identity(target, target_prev)

  // Terminal-record invariants for a fully-absorbed (repo) target.
  Assert.ok(
    target.unit_balance === 0,
    'verify_vault_repo_liquidated: unit balance must be zero'
  )
  Assert.ok(
    target.vault_ratio === null,
    'verify_vault_repo_liquidated: vault ratio must be null'
  )
}

/**
 * Verify a liquidated target absorbed in a TRIM (partial liquidation) flow.
 * Same breach chain + identity continuity as repo, but a trim only partially
 * liquidates: the target RETAINS debt (reduced from its prior balance) and
 * remains encumbered (ratio recomputed, non-null). A fully-cleared target
 * must use the repo flow instead.
 *
 * @param proto_profile - Protocol profile (caller-verified)
 * @param target        - The liquidated target vault profile
 * @param target_prev   - The target's own pre-liquidation profile
 * @throws Error if any verification fails
 */
export function verify_vault_trim_liquidated (
  proto_profile : ProtoProfile,
  target        : LiquidVaultProfile,
  target_prev   : VaultProfile
) : void {
  verify_vault_liquidate(proto_profile, target, target_prev)
  verify_liquidated_target_identity(target, target_prev)

  // Partial-liquidation invariants: debt reduced but remaining; encumbered.
  Assert.ok(
    target.unit_balance > 0,
    'verify_vault_trim_liquidated: target must retain debt (partial liquidation; use repo for full)'
  )
  Assert.ok(
    target.unit_balance < target_prev.unit_balance,
    'verify_vault_trim_liquidated: target debt must be reduced'
  )
  Assert.exists(
    target.vault_ratio,
    'verify_vault_trim_liquidated: target ratio must be recomputed (target remains encumbered)'
  )
}

/**
 * Reconstruct the breach contract that authorizes a liquidation from the
 * previous vault's own committed price contracts paired with the revealed
 * `liquid_key`. The matching contract is the one whose `thold_hash` equals
 * `hash160(liquid_key)` — a threshold the prev vault actually committed to.
 *
 * Throws if no committed contract matches the revealed key: a key for some
 * other vault cannot be used to liquidate this one (Finding #4 binding).
 */
function derive_breach_contract (
  proto_profile : ProtoProfile,
  prev_profile  : VaultProfile,
  liquid_key    : string
) : BreachedPriceContract {
  const want_hash      = get_price_contract_thold_hash(liquid_key)
  const prev_contracts = extract_vault_price_contracts(proto_profile, prev_profile)
  const active         = prev_contracts.find(c => c.thold_hash === want_hash)
  Assert.exists(
    active,
    `verify_vault_liquidate: liquid_key does not match any threshold the prev vault committed to ` +
    `(hash160(liquid_key)=${want_hash})`
  )
  return { ...active, thold_key: liquid_key }
}
