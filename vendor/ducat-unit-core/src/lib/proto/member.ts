/**
 * @fileoverview Proto member lookups — resolve members by index/pubkey and check signer authorization.
 */

import { unique } from '@vbyte/util'

import type {
  ProtoMemberRecord,
  ProtoProfile
} from '@/types/index.js'

/**
 * Find a protocol member by its index.
 */
export function get_proto_member_by_idx (
  proto_profile : ProtoProfile,
  member_idx    : number,
  group_code?   : number
) : ProtoMemberRecord | undefined {
  // Filter the members by the group code if provided.
  const members = get_proto_member_records(proto_profile, group_code)
  // Return the protocol member by the index.
  return members.find(mbr => mbr.idx === member_idx)
}

/**
 * Find a protocol member by its public key.
 */
export function get_proto_member_by_pubkey (
  proto_profile : ProtoProfile,
  member_pubkey : string,
  group_code?   : number
) : ProtoMemberRecord | undefined {
  // Filter the members by the group code if provided.
  const members = get_proto_member_records(proto_profile, group_code)
  // Return the protocol member by the pubkey.
  return members.find(mbr => mbr.pubkey === member_pubkey)
}

/**
 * List protocol members, optionally filtered by group code.
 */
export function get_proto_member_records (
  proto_profile : ProtoProfile,
  group_code?   : number
) : ProtoMemberRecord[] {
  // Return the protocol members, filtered by the group code if provided.
  return (group_code)
    ? proto_profile.proto_members.filter(mbr => mbr.group === group_code)
    : proto_profile.proto_members
}

/**
 * Whether a public key is a registered signer in the protocol,
 * optionally filtered by group (e.g., `SYMBOLS.SIGNER.ORACLE` or
 * `SYMBOLS.SIGNER.GUARDIAN`).
 *
 * Predicate counterpart to `verify_oracle_authorized`. Use when the
 * caller wants a boolean answer rather than a throw — e.g., when
 * collecting authorization status for multiple candidate keys.
 */
export function is_authorized_signer (
  proto_profile : ProtoProfile,
  pubkey        : string,
  group_code?   : number
) : boolean {
  return get_proto_member_by_pubkey(proto_profile, pubkey, group_code) !== undefined
}

/**
 * Resolve protocol member records from a list of public keys.
 */
export function resolve_proto_member_pubkeys (
  proto_profile  : ProtoProfile,
  member_pubkeys : string[],
  group_code?    : number
) : ProtoMemberRecord[] {
  // Get the protocol members, filtered by the group code if provided.
  const members = get_proto_member_records(proto_profile, group_code)
  // De-duplicate pubkeys before resolving members.
  const pubkeys = unique(member_pubkeys)
  // Keep members whose pubkey is present in the provided list.
  return members.filter(m => pubkeys.includes(m.pubkey))
}

/**
 * Resolve protocol member records from a list of member indices.
 */
export function resolve_proto_member_indices (
  proto_profile : ProtoProfile,
  member_ids    : number[],
  group_code?   : number
) : ProtoMemberRecord[] {
  // Get the protocol members, filtered by the group code if provided.
  const members = get_proto_member_records(proto_profile, group_code)
  // De-duplicate member indices before resolving members.
  const ids = unique(member_ids)
  // Keep members whose index is present in the provided list.
  return members.filter(m => ids.includes(m.idx))
}
