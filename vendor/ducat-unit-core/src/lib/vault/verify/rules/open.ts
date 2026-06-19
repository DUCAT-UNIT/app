/**
 * @fileoverview Verify a vault open action meets all protocol requirements.
 */

import {
  verify_encumbered_vault,
  verify_guardian_data,
  verify_price_oracle_data,
  verify_price_commit_signatures
} from '@/lib/vault/validate.js'

import { verify_oracles_authorized } from '@/lib/price/validate.js'
import { verify_vault_profile }      from '@/lib/verify/vault.js'

import type { ProtoProfile, VaultProfile } from '@/types/index.js'

/**
 * Strict verification for a vault open action.
 *
 * Open action requirements:
 * - Must borrow on open (unit_balance > 0)
 * - Price data must be present and valid
 * - Guard members must be present and valid
 *
 * The collateral-ratio floor is a policy check; see eval_vault_open_policy.
 *
 * @param proto_profile - Protocol profile with terms
 * @param vault_profile - Vault profile to verify
 * @throws Error if any verification fails
 */
export function verify_vault_open_strict (
  proto_profile : ProtoProfile,
  vault_profile : VaultProfile
) : void {
  // Trust-boundary verification: profile shape, contract_id binding
  // (Finding #1), vault_balance invariant (Finding #9), embedded
  // price-commit verification (Finding #8 — for the active commits
  // an open vault carries).
  verify_vault_profile(vault_profile, proto_profile)

  // Must borrow on open (unit_balance > 0)
  verify_encumbered_vault(vault_profile)

  // Price data must be present and valid
  verify_price_oracle_data(vault_profile)

  // Guard members must be present and valid
  verify_guardian_data(vault_profile.guard_members)

  // Verify oracle signatures are valid
  verify_price_commit_signatures(vault_profile, proto_profile)

  // Verify oracles are authorized in the protocol
  // Signature correctness alone is not sufficient; oracle keys must also be
  // members of the protocol-authorized oracle set.
  const oracle_pubkeys = vault_profile.price_commits.map(c => c.oracle_pubkey)
  verify_oracles_authorized(oracle_pubkeys, proto_profile)
}
