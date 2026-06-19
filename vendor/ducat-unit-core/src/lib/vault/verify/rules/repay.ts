/**
 * @fileoverview Verify a vault repay action meets all protocol requirements.
 */

import { Assert } from '@vbyte/util'

import { verify_vault_profile } from '@/lib/verify/vault.js'

import { guard_members_equal } from '../util.js'

import type { ProtoProfile, VaultProfile } from '@/types/index.js'

/**
 * Strict verification for a vault repay action.
 *
 * Repay action requirements:
 * - Unit balance must decrease (unit_balance < prev.unit_balance)
 * - Unit balance must be non-negative (unit_balance >= 0)
 * - Guard members must remain unchanged
 * - Root txid must remain unchanged (vault lineage)
 *
 * Collateral may be withdrawn during repay — that is allowed. The bounds on
 * such withdrawal (ratio not worsened, floors held) are policy checks; see
 * eval_vault_repay_policy.
 *
 * @param proto_profile - Protocol profile with terms
 * @param vault_profile - Current vault profile
 * @param prev_profile  - Previous vault profile
 * @throws Error if any verification fails
 */
export function verify_vault_repay_strict (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  prev_profile  : VaultProfile
) : void {
  // Trust-boundary verification (Findings #1, #8, #9).
  verify_vault_profile(vault_profile, proto_profile)
  verify_vault_profile(prev_profile,  proto_profile)

  // Repay enforces strictly downward UNIT liability movement.

  // Unit balance must decrease
  Assert.ok(
    vault_profile.unit_balance < prev_profile.unit_balance,
    `verify_vault_repay: unit balance must decrease (${vault_profile.unit_balance} >= ${prev_profile.unit_balance})`
  )

  // Unit balance must be non-negative
  Assert.ok(
    vault_profile.unit_balance >= 0,
    `verify_vault_repay: unit balance must be non-negative (${vault_profile.unit_balance} < 0)`
  )

  // Guard members must remain unchanged
  Assert.ok(
    guard_members_equal(vault_profile.guard_members, prev_profile.guard_members),
    'verify_vault_repay: guard members must remain unchanged'
  )

  // Root txid must remain unchanged (vault lineage)
  Assert.ok(
    vault_profile.root_txid === prev_profile.root_txid,
    'verify_vault_repay: root_txid must remain unchanged'
  )
}
