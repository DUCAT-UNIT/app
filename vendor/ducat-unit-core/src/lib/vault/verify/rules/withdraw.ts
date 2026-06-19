/**
 * @fileoverview Verify a vault withdraw action meets all protocol requirements.
 */

import { Assert } from '@vbyte/util'

import { verify_vault_profile } from '@/lib/verify/vault.js'

import { guard_members_equal } from '../util.js'

import type { ProtoProfile, VaultProfile } from '@/types/index.js'

/**
 * Strict verification for a vault withdraw action.
 *
 * Withdraw action requirements:
 * - Vault balance must decrease (vault_balance < prev.vault_balance)
 * - Unit balance must remain unchanged (unit_balance == prev.unit_balance)
 * - Guard members must remain unchanged
 * - Root txid must remain unchanged (vault lineage)
 *
 * The ratio floor (encumbered) and value floor (debt-free) on the resulting
 * collateral are policy checks; see eval_vault_withdraw_policy.
 *
 * @param proto_profile - Protocol profile with terms
 * @param vault_profile - Current vault profile
 * @param prev_profile  - Previous vault profile
 * @throws Error if any verification fails
 */
export function verify_vault_withdraw_strict (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  prev_profile  : VaultProfile
) : void {
  // Trust-boundary verification (Findings #1, #8, #9).
  verify_vault_profile(vault_profile, proto_profile)
  verify_vault_profile(prev_profile,  proto_profile)

  // Withdraw is collateral-only mutation: debt side remains unchanged.

  // Vault balance must decrease
  Assert.ok(
    vault_profile.vault_balance < prev_profile.vault_balance,
    `verify_vault_withdraw: vault balance must decrease (${vault_profile.vault_balance} >= ${prev_profile.vault_balance})`
  )

  // Unit balance must remain unchanged
  Assert.ok(
    vault_profile.unit_balance === prev_profile.unit_balance,
    `verify_vault_withdraw: unit balance must remain unchanged (${vault_profile.unit_balance} !== ${prev_profile.unit_balance})`
  )

  // Guard members must remain unchanged
  Assert.ok(
    guard_members_equal(vault_profile.guard_members, prev_profile.guard_members),
    'verify_vault_withdraw: guard members must remain unchanged'
  )

  // Root txid must remain unchanged (vault lineage)
  Assert.ok(
    vault_profile.root_txid === prev_profile.root_txid,
    'verify_vault_withdraw: root_txid must remain unchanged'
  )
}
