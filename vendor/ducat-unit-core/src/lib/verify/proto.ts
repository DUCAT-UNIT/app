/**
 * @fileoverview Trust-boundary verification for ProtoProfile.
 *
 * `verify_proto_profile` is the single canonical entry point for validating
 * a proto profile received from any external source (JSON parse, RPC,
 * indexer DB, gossip). Callers receive a throw on invalid input; on
 * success, the profile is safe to consume.
 *
 * Closes Codex audit finding #1 (contract_id binding) at the boundary: the
 * function recomputes `contract_id` from the proto's content fields per
 * `get_proto_contract_id` and asserts equality with the schema-supplied
 * value. A profile copying a legitimate `contract_id` with mismatched
 * members/terms/assets fails verification here.
 */

import { Assert }        from '@vbyte/util'
import { assert_schema } from '@/validate/schema.js'
import * as SCHEMA       from '@/schema/index.js'

import { get_proto_contract_id } from '@/lib/proto/contract.js'

import type { ProtoProfile } from '@/types/index.js'

/**
 * Verify a ProtoProfile end-to-end. Throws on invalid input.
 *
 * Checks:
 *   1. Schema validation via Zod.
 *   2. `contract_id` recomputed from proto fields matches the profile's
 *      stored value. (Finding #1.)
 *
 * @param proto - The proto profile to verify.
 * @throws Error if any check fails.
 */
export function verify_proto_profile (
  proto : ProtoProfile
) : void {
  // Step 1: schema validation. Throws on shape/type mismatch.
  assert_schema(proto, SCHEMA.proto.profile, 'verify_proto_profile: schema validation failed')

  // Step 2: contract_id binding. Recompute from proto fields and compare.
  // ProtoProfile is a structural superset of ProtoContractIdInput, so the
  // profile passes directly without any field-by-field decomposition.
  const expected_id = get_proto_contract_id(proto)
  Assert.ok(
    proto.contract_id === expected_id,
    `verify_proto_profile: contract_id mismatch — supplied ${proto.contract_id}, expected ${expected_id}`
  )
}
