/**
 * @fileoverview Trust-boundary verification for VaultProfile.
 *
 * `verify_vault_profile` checks a vault profile is internally coherent
 * with the supplied proto — schema, contract_id binding, balance
 * invariant, and embedded price-commit verification. It does NOT verify
 * any state-transition rules; those live in the action verifiers under
 * `src/lib/vault/verify/rules/`.
 *
 * Closes the boundary enforcement for:
 *   - Finding #1  — `contract_id` binding to the supplied proto.
 *   - Finding #8  — every embedded price commit's oracle is a
 *                   registered protocol member, with valid signature
 *                   and threshold range (via verify_active_price_contract).
 *   - Finding #9  — `vault_balance` matches `vault_value - vault_value_min`
 *                   recomputed from proto terms.
 *
 * Note: Finding #16 (close-state cleared invariants) is enforced by
 * `verify_vault_close_action` in `src/lib/vault/verify/rules/close.ts`,
 * not here — close-state is a transition concern, not a profile-shape
 * concern.
 */

import { Assert } from '@vbyte/util'

import { assert_schema } from '@/validate/schema.js'
import * as SCHEMA       from '@/schema/index.js'

import { extract_vault_price_contracts } from '@/lib/vault/price.js'
import { get_vault_terms }               from '@/lib/proto/terms.js'
import { is_vault_active }               from '@/lib/vault/util.js'

import { verify_active_price_contract } from './price.js'

import type { ProtoProfile, VaultProfile } from '@/types/index.js'

/**
 * Verify a vault profile end-to-end. Throws on invalid input.
 *
 * @param profile - The vault profile to verify (untrusted shape allowed).
 * @param proto   - The protocol profile (caller must have run
 *                  `verify_proto_profile` first).
 * @throws Error if any check fails.
 */
export function verify_vault_profile (
  profile : VaultProfile,
  proto   : ProtoProfile
) : void {
  // Step 1: schema validation.
  assert_schema(profile, SCHEMA.vault.profile, 'verify_vault_profile: schema validation failed')

  // Step 2: contract_id binding (Finding #1 boundary). The proto is
  // already verified by the caller, so its contract_id is authoritative.
  Assert.ok(
    profile.contract_id === proto.contract_id,
    `verify_vault_profile: contract_id mismatch — supplied ${profile.contract_id}, expected ${proto.contract_id}`
  )

  // Step 3: vault_balance invariant (Finding #9). For profiles with an
  // on-chain vault UTXO, balance must be derivable from vault_value and
  // the proto's vault_value_min term. A null vault_value indicates a
  // terminal state (e.g., closed); the balance check doesn't apply.
  if (profile.vault_value !== null) {
    const vault_terms = get_vault_terms(proto.proto_terms)
    const expected_balance = profile.vault_value - vault_terms.vault_value_min
    Assert.ok(
      profile.vault_balance === expected_balance,
      `verify_vault_profile: vault_balance invariant violation — ` +
      `supplied ${profile.vault_balance}, expected ${expected_balance} ` +
      `(vault_value=${profile.vault_value} - vault_value_min=${vault_terms.vault_value_min})`
    )
  }

  // Step 4: active-state price-commit verification (Finding #8 boundary).
  // For vaults in active state (has UTXO, not liquidated), every embedded
  // price commit must reconstruct into an *active* contract whose oracle
  // is a registered protocol member. Closed and liquid profiles skip the
  // loop — closed has no commits to verify, and liquid has one revealed
  // commit (thold_key !== null) that would fail the active-contract
  // assertion. extract_vault_price_contracts enforces its own
  // postcondition; verify_active_price_contract enforces membership +
  // signature + range + untriggered state.
  if (is_vault_active(profile)) {
    const contracts = extract_vault_price_contracts(proto, profile)
    for (const contract of contracts) {
      verify_active_price_contract(contract, proto)
    }
  }
}
