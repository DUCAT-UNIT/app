/**
 * @fileoverview Vault trim action verification.
 *
 * Trim is a partial-liquidation flow: a liquidator absorbs the debt of a
 * single underwater vault that becomes a `LiquidVaultProfile` (the
 * `target`). `verify_vault_trim` validates the liquidator's own
 * transition and verifies the absorbed target via
 * `verify_vault_trim_liquidated` (partial: the target retains reduced debt).
 */

import { Assert } from '@vbyte/util'

import { verify_encumbered_vault }   from '@/lib/vault/validate.js'
import { verify_vault_profile }      from '@/lib/verify/vault.js'
import { guard_members_equal }       from '../util.js'
import { eval_vault_trim_policy }    from '../policy.js'
import { compose_strict_policy }     from '../util.js'
import { verify_vault_trim_liquidated } from './liquidate.js'

import type {
  LiquidVaultProfile,
  ProtoProfile,
  VaultProfile
} from '@/types/index.js'

/**
 * Verify the STRICT requirements of a vault trim action (liquidator side).
 *
 * Strict (consensus-envelope) requirements enforced here:
 * - Both profiles structurally verify (trust boundary)
 * - The absorbed liquidated target is validated end-to-end via
 *   `verify_vault_trim_liquidated` — full breach-chain check plus
 *   partial-liquidation invariants (reduced-but-remaining debt, still
 *   encumbered). Caller supplies the target's pre-liquidation profile so
 *   the breach-vs-commits membership check can run.
 * - Unit balance must remain non-negative (structural)
 * - Resulting vault must be encumbered (absorbed debt requires fresh
 *   oracle price data on the post-state)
 * - Guard members, client pubkey, and root txid must remain unchanged
 *
 * The liquidator's collateral-increase, debt-increase, and post-state ratio
 * floor are POLICY checks — see `eval_vault_trim_policy`. The composite
 * `verify_vault_trim` runs strict then policy and throws on a policy flag.
 *
 * @param proto_profile - Protocol profile with terms
 * @param vault_profile - Liquidator's post-state vault profile
 * @param prev_profile  - Liquidator's pre-state vault profile
 * @param target        - The absorbed liquidated target ({liquid, prev})
 * @throws Error if any verification fails
 */
export function verify_vault_trim_strict (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  prev_profile  : VaultProfile,
  target        : { liquid : LiquidVaultProfile, prev : VaultProfile }
) : void {
  // Trust-boundary verification (Findings #1, #8, #9).
  verify_vault_profile(vault_profile, proto_profile)
  verify_vault_profile(prev_profile,  proto_profile)

  // Target verification (full breach chain + partial-liquidation invariants:
  // the trimmed target retains reduced debt and remains encumbered).
  verify_vault_trim_liquidated(proto_profile, target.liquid, target.prev)

  // Unit balance must remain non-negative.
  Assert.ok(
    vault_profile.unit_balance >= 0,
    `verify_vault_trim: unit balance must be non-negative (${vault_profile.unit_balance} < 0)`
  )

  // Resulting vault must be encumbered: absorbed debt requires fresh
  // oracle price data on the post-state.
  verify_encumbered_vault(vault_profile)

  // Guard members must remain unchanged.
  Assert.ok(
    guard_members_equal(vault_profile.guard_members, prev_profile.guard_members),
    'verify_vault_trim: guard members must remain unchanged'
  )

  // Client pubkey must remain unchanged.
  Assert.ok(
    vault_profile.client_pubkey === prev_profile.client_pubkey,
    'verify_vault_trim: client pubkey must remain unchanged'
  )

  // Root txid must remain unchanged (vault lineage).
  Assert.ok(
    vault_profile.root_txid === prev_profile.root_txid,
    'verify_vault_trim: root_txid must remain unchanged'
  )
}

/**
 * Verify a vault trim action: strict structural/continuity checks plus the
 * economic policy (collateral/debt increase, ratio floor). Throws on the
 * first policy flag after all strict checks pass.
 */
export function verify_vault_trim (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  prev_profile  : VaultProfile,
  target        : { liquid : LiquidVaultProfile, prev : VaultProfile }
) : void {
  compose_strict_policy(
    'verify_vault_trim',
    () => verify_vault_trim_strict(proto_profile, vault_profile, prev_profile, target),
    () => eval_vault_trim_policy(proto_profile, vault_profile, prev_profile)
  )
}
