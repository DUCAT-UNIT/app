/**
 * @fileoverview Vault state predicates and guardian/oracle member-record resolution helpers.
 */

import { Assert }  from '@vbyte/util'
import { SYMBOLS } from '@/const.js'

import { get_proto_member_records } from '@/lib/index.js'

import type {
  ProtoMemberRecord,
  ProtoProfile,
  VaultProfile,
  VaultTerms
} from '@/types/index.js'

/**
 * Whether a vault profile is in an active state — i.e., it has an
 * on-chain UTXO (`vault_value` non-null) and has not been liquidated
 * or trimmed (vault_action is not in the liquidating set).
 *
 * Active vaults' embedded price commits must all reconstruct into
 * untriggered (`thold_key === null`) price contracts; consumers like
 * `verify_vault_profile` gate per-commit verification on this
 * predicate. Closed (`vault_value === null`), liquid
 * (`vault_action === 'liquidate'`), and trimmed
 * (`vault_action === 'trim'`) profiles are terminal/derived states
 * with one revealed thold_key each and a different verification
 * shape — they aren't checked here.
 */
const VAULT_ACTIONS_LIQUIDATING : ReadonlySet<VaultProfile['vault_action']> = new Set([
  'liquidate',
  'trim'
])

/**
 * Whether a vault is in an active (non-liquidating, funded) state.
 *
 * True when the vault still has a `vault_value` and its current action is not a
 * liquidating one (`liquidate`/`trim`).
 *
 * @param profile - The vault profile to test.
 * @returns `true` if the vault is active, otherwise `false`.
 */
export function is_vault_active (profile : VaultProfile) : boolean {
  return profile.vault_value !== null
      && !VAULT_ACTIONS_LIQUIDATING.has(profile.vault_action)
}

/**
 * Whether a vault has crossed the liquidation price threshold —
 * i.e., its observed `unit_price` has dropped to or below the
 * `thold_price` that was locked at borrow time.
 *
 * Vaults with no `unit_price` or `thold_price` (cleared / closed)
 * are trivially not liquidatable and return false. The threshold is
 * locked into the profile at borrow time as a function of the proto
 * `liquidation_thold` term, so this predicate doesn't need the
 * terms record at call time — the work was already done.
 *
 * Closes the eligibility-check gap noted in Codex audit finding #5.
 */
export function is_above_liquidation_threshold (
  profile : VaultProfile
) : boolean {
  if (profile.unit_price === null || profile.thold_price === null) {
    return false
  }
  return profile.unit_price <= profile.thold_price
}

/**
 * Whether a unit balance satisfies the protocol's minimum-debt rule:
 * either zero (cleared) or at least `vault_terms.unit_balance_min`.
 *
 * Closes Codex audit finding F21 (client-sdk) at the primitive layer.
 */
export function is_valid_unit_balance (
  unit_balance : number,
  vault_terms  : VaultTerms
) : boolean {
  return unit_balance === 0 || unit_balance >= vault_terms.unit_balance_min
}

/** Resolve guardian member records from explicit guardian pubkeys. */
export function resolve_guardian_pubkeys (
  proto_profile : ProtoProfile,
  guard_pubkeys : string[]
) : ProtoMemberRecord[] {
  // Get the guardian members from the profile.
  const records = get_guardian_records(proto_profile)
  // Resolve the guardian records by their pubkeys.
  return guard_pubkeys.map(pk => {
    const record = records.find(m => m.pubkey === pk)
    // Assert that the guardian record exists.
    Assert.exists(record, `guardian record not found for public key: ${pk}`)
    return record
  })
}

/** Resolve guardian member records from guardian indices. */
export function resolve_guardian_indices (
  proto_profile : ProtoProfile,
  guard_indices : number[]
) : ProtoMemberRecord[] {
  // Get the guardian members from the profile.
  const records  = get_guardian_records(proto_profile)
  // Filter the guardian records by the indices.
  return guard_indices.map(idx => {
    const record = records.find(m => m.idx === idx)
    // Assert that the guardian record exists.
    Assert.exists(record, `guardian record not found for index: ${idx}`)
    return record
  })
}

/** Return guardian member records from protocol profile membership data. */
export function get_guardian_records (
  proto_profile : ProtoProfile,
) : ProtoMemberRecord[] {
  // Define the guardian group code.
  const guard_code = SYMBOLS.SIGNER.GUARDIAN
  // Get the guardian members from the profile.
  return get_proto_member_records(proto_profile, guard_code)
}

/** Find an oracle member record by oracle pubkey. */
export function find_oracle_record_by_pubkey (
  proto_members : ProtoMemberRecord[],
  oracle_pubkey : string
) : ProtoMemberRecord {
  // Get the oracle record from the records.
  const member = proto_members.find(m => m.pubkey === oracle_pubkey)
  // Assert that the oracle record exists.
  Assert.exists(member, `oracle record not found for public key: ${oracle_pubkey}`)
  // Return the oracle record.
  return member
}

/** Find an oracle member record by member index. */
export function find_oracle_record_by_idx (
  proto_members : ProtoMemberRecord[],
  oracle_index  : number
) : ProtoMemberRecord {
  // Get the oracle record from the records.
  const member = proto_members.find(m => m.idx === oracle_index)
  // Assert that the oracle record exists.
  Assert.exists(member, `oracle record not found for index: ${oracle_index}`)
  // Return the oracle record.
  return member
}

/** Return oracle member records from protocol profile membership data. */
export function get_oracle_records (
  proto_profile : ProtoProfile,
) : ProtoMemberRecord[] {
  // Define the guardian group code.
  const oracle_code = SYMBOLS.SIGNER.ORACLE
  // Get the oracle members from the profile.
  return get_proto_member_records(proto_profile, oracle_code)
}
