/**
 * @fileoverview Schema-backed validators for core protocol data types.
 */

import { format_zod_error } from './errors.js'
import * as Schema from '../schema/index.js'

import type {
  AssetProfile,
  ProtoProfile,
  VaultProfile,
} from '../types/index.js'

/**
 * Validate that data matches the AssetProfile schema.
 *
 * @param data - The data to validate
 * @throws Error with detailed message if validation fails
 */
export function validate_asset_account (
  data : unknown
) : asserts data is AssetProfile {
  const result = Schema.asset.account.safeParse(data)
  if (!result.success) {
    throw new Error(format_zod_error(result.error, 'validate_asset_account'))
  }
}

/**
 * Validate that data matches the ProtoProfile schema.
 *
 * @param profile - The data to validate
 * @throws Error with detailed message if validation fails
 */
export function validate_proto_profile (
  profile : unknown
) : asserts profile is ProtoProfile {
  const result = Schema.proto.profile.safeParse(profile)
  if (!result.success) {
    throw new Error(format_zod_error(result.error, 'validate_proto_profile'))
  }
}

/**
 * Validate that data matches the VaultProfile schema.
 *
 * @param profile - The data to validate
 * @throws Error with detailed message if validation fails
 */
export function validate_vault_profile (
  profile : unknown
) : asserts profile is VaultProfile {
  const result = Schema.vault.profile.safeParse(profile)
  if (!result.success) {
    throw new Error(format_zod_error(result.error, 'validate_vault_profile'))
  }
}

