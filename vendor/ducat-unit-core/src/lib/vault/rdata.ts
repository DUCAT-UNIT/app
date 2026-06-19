/**
 * @fileoverview Vault return-data script encode/decode and guardian-index packing helpers.
 */

import { Buff, Stream } from '@vbyte/buff'
import { Assert }       from '@vbyte/util/assert'

import {
  decode_script,
  encode_script
} from '@vbyte/btc-dev/script'

import {
  select_base_price_commit,
  encode_price_commits,
  decode_price_commits,
  resolve_guardian_pubkeys,
  resolve_guardian_indices
} from '@/lib/index.js'

import {
  VAULT_RETURN_CODE,
  VAULT_RETURN_VERSION
} from '@/const.js'

import {
  validate_vault_return_data,
  verify_encumbered_vault,
  verify_guardian_data
} from './validate.js'

import type {
  ClearedVaultReturnData,
  ProtoProfile,
  VaultProfile,
  VaultReturnData
} from '@/types/index.js'

export const DEFAULT_RETURN_DATA = () : ClearedVaultReturnData => {
  return {
    guard_members : [],
    price_commits : [],
    price_stamp   : null,
    unit_balance  : 0,
    unit_price    : null,
    thold_price   : null
  }
}

/**
 * Create a vault return data script.
 */
export function encode_vault_return_script (
  proto_profile : ProtoProfile,
  return_data   : VaultReturnData
) : Buff {
  // Unpack the return data.
  const { guard_members, unit_balance, price_commits } = return_data
  // Validate the return data.
  validate_vault_return_data(return_data)
  // Verify the guardian data.
  verify_guardian_data(guard_members)
  // Initialize the payload array.
  const payload = [ Buff.num(VAULT_RETURN_VERSION, 1) ]
  // Encode the guardian indices.
  payload.push(encode_guardian_indices(proto_profile, guard_members))
  // If the unit balance is greater than zero,
  if (unit_balance > 0) {
    // Verify the encumbered vault data.
    verify_encumbered_vault(return_data)
    // Unpack the return data.
    const { unit_balance, price_stamp } = return_data
    // Encode the unit balance.
    payload.push(Buff.num(unit_balance, 4))
    // Encode the price stamp.
    payload.push(Buff.num(price_stamp,  4))
    // Encode the price commits.
    payload.push(encode_price_commits(proto_profile, price_commits))
  }
  // Join the payload and return an OP_RETURN data script.
  return encode_script([ 'OP_RETURN', VAULT_RETURN_CODE, Buff.join(payload) ])
}

/**
 * Parse the vault data from an OP_RETURN script.
 */
export function decode_vault_return_script (
  proto_profile : ProtoProfile,
  return_script : string | Uint8Array
) : VaultReturnData {
  // Decode the script into opcodes.
  const [ opcode, magic, payload ] = decode_script(return_script)
  // Assert the proper opcodes exist.
  Assert.ok(opcode === 'OP_RETURN', 'vault data does not include OP_RETURN')
  Assert.ok(magic  === 'OP_8',      'vault data does not include OP_8')
  // Convert the return data payload into a stream.
  const stream = new Stream(payload)
  // Read the version from the stream.
  const version = stream.read(1).num
  // Assert the proper version.
  Assert.ok(version === VAULT_RETURN_VERSION, `vault return data version mismatch: ${version} !== ${VAULT_RETURN_VERSION}`)
  // Parse the vault return data.
  const guard_members = extract_guardian_pubkeys(proto_profile, stream)
  // Verify the guardian data.
  verify_guardian_data(guard_members)
  // If the stream is empty, return a cleared vault return data.
  if (stream.size === 0) {
    // Return a cleared vault return data.
    return { ...DEFAULT_RETURN_DATA(), guard_members }
  } else {
    // Read the unit balance from the stream.
    const unit_balance   = stream.read(4).num
    const price_stamp    = stream.read(4).num
    const price_commits  = decode_price_commits(proto_profile, stream)
    // Get the base price from the price commits.
    const base_commit    = select_base_price_commit(price_commits)
    // Assert that the base commit exists.
    Assert.exists(base_commit, 'no base price commit found')
    // Get the unit price and thold price from the base price commit.
    const unit_price  = base_commit.base_price
    const thold_price = base_commit.thold_price
    // Create the return data object.
    const return_data = { guard_members, unit_balance, price_stamp, price_commits, unit_price, thold_price }
    // Assert that the return data is valid.
    validate_vault_return_data(return_data)
    // Verify the encumbered vault data.
    verify_encumbered_vault(return_data)
    // Return the return data.
    return return_data
  }
}

/** Encode guardian pubkeys as compact guardian index payload bytes. */
export function encode_guardian_indices (
  proto_profile : ProtoProfile,
  guard_pubkeys : string[]
) : Buff {
  // Resolve the guardian members by their pubkeys.
  const records = resolve_guardian_pubkeys(proto_profile, guard_pubkeys)
  // Initialize the payload array.
  const payload = [ Buff.num(records.length, 1) ]
  // For each guardian index,
  for (const mbr of records) {
    // Push the member id to the payload.
    payload.push(Buff.num(mbr.idx, 1))
  }
  // Return the encoded guardian indices as a buffer.
  return Buff.join(payload)
}

/** Decode guardian member pubkeys from encoded guardian index payload stream. */
export function extract_guardian_pubkeys (
  proto_profile : ProtoProfile,
  data_stream   : Stream
) : string[] {
  // Read the number of guardian indices from the stream.
  const count = data_stream.read(1).num
  // Assert that the number of guardian indices is not zero.
  Assert.ok(count > 0, `guardian indices must be non-empty`)
  // Initialize the indices array.
  const indices : number[] = []
  // For each guardian index,
  for (let i = 0; i < count; i++) {
    // Read the guardian index from the stream.
    const idx = data_stream.read(1).num
    // Push the index to the indices array.
    indices.push(idx)
  }
  // Assert that the number of guardian indices matches the count.
  Assert.ok(indices.length === count, `guardian indices count mismatch: ${indices.length} !== ${count}`)
  // Return the decoded guardian members.
  const records = resolve_guardian_indices(proto_profile, indices)
  // Return the guardian pubkeys from the records.
  return records.map(m => m.pubkey)
}

/** Project vault profile fields into vault return-data shape. */
export function get_vault_profile_return_data (
  vault_profile : VaultProfile
) : VaultReturnData {
  // Unpack the vault profile.
  const { guard_members, unit_price, thold_price, price_stamp, price_commits, unit_balance } = vault_profile
  // Return the vault return data.
  return { guard_members, unit_price, thold_price, price_stamp, price_commits, unit_balance }
}
