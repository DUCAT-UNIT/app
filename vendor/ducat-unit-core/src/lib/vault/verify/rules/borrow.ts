/**
 * @fileoverview Verify a vault borrow action meets all protocol requirements.
 */

import { Assert } from '@vbyte/util'

import {
  verify_price_oracle_data,
  verify_price_commit_signatures
} from '@/lib/vault/validate.js'

import { verify_oracles_authorized } from '@/lib/price/validate.js'
import { verify_vault_profile }      from '@/lib/verify/vault.js'

import { guard_members_equal } from '../util.js'

import type { ProtoProfile, VaultProfile } from '@/types/index.js'

/**
 * Strict verification for a vault borrow action.
 *
 * Borrow action requirements:
 * - Unit balance must increase (unit_balance > prev.unit_balance)
 * - Price data must be present and valid
 * - Guard members must remain unchanged
 * - Root txid must remain unchanged (vault lineage)
 *
 * Collateral may move (deposit, withdraw, or unchanged) — that is allowed.
 * The collateral-ratio floor is a policy check; see eval_vault_borrow_policy.
 *
 * @param proto_profile - Protocol profile with terms
 * @param vault_profile - Current vault profile
 * @param prev_profile  - Previous vault profile
 * @throws Error if any verification fails
 */
export function verify_vault_borrow_strict (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile,
  prev_profile  : VaultProfile
) : void {
  // Trust-boundary verification: both states' profile shape +
  // contract_id binding + vault_balance invariant + active-commit
  // verification (Findings #1, #8, #9).
  verify_vault_profile(vault_profile, proto_profile)
  verify_vault_profile(prev_profile,  proto_profile)

  // Unit balance must increase
  Assert.ok(
    vault_profile.unit_balance > prev_profile.unit_balance,
    `verify_vault_borrow: unit balance must increase (${vault_profile.unit_balance} <= ${prev_profile.unit_balance})`
  )

  // Price data must be present and valid
  verify_price_oracle_data(vault_profile)

  // Guard members must remain unchanged
  Assert.ok(
    guard_members_equal(vault_profile.guard_members, prev_profile.guard_members),
    'verify_vault_borrow: guard members must remain unchanged'
  )

  // Root txid must remain unchanged (vault lineage)
  Assert.ok(
    vault_profile.root_txid === prev_profile.root_txid,
    'verify_vault_borrow: root_txid must remain unchanged'
  )

  // Verify oracle signatures are valid
  verify_price_commit_signatures(vault_profile, proto_profile)

  // Verify oracles are authorized in the protocol
  // Authorization is evaluated against protocol member registry, not just
  // signature validity on the price commit payload.
  const oracle_pubkeys = vault_profile.price_commits.map(c => c.oracle_pubkey)
  verify_oracles_authorized(oracle_pubkeys, proto_profile)
}
