/**
 * @fileoverview Validation and verification functions for vault data.
 *
 * Naming convention:
 * - validate_* functions perform schema validation (Zod .parse())
 * - verify_* functions perform business logic checks
 */

import { unique }        from '@vbyte/util'
import { assert_schema } from '@/validate/schema.js'
import * as SCHEMA       from '@/schema/index.js'

import {
  VAULT_MAX_GUARD_COUNT,
  VAULT_MAX_ORACLE_COUNT
} from '@/const.js'

import { verify_price_contract_signature } from '@/lib/price/contract.js'
import { extract_vault_price_contracts } from '@/lib/vault/price.js'

import type {
  ClearedVaultReturnData,
  EncumberedVaultReturnData,
  ProtoProfile,
  VaultReturnData
} from '@/types/index.js'

/**
 * Validate vault return data against the schema.
 *
 * @param return_data - The vault return data to validate
 * @throws Error if schema validation fails
 */
export function validate_vault_return_data (
  return_data : VaultReturnData
) : asserts return_data is VaultReturnData {
  // Verify the return data schema.
  assert_schema(return_data, SCHEMA.vault.rdata, 'validate_vault_return_data: schema validation failed')
}

/**
 * Verify that vault data represents an encumbered vault with debt.
 * This is a business logic check, not schema validation.
 *
 * @param return_data - The vault return data to verify
 * @throws Error if business logic constraints are not met
 */
export function verify_encumbered_vault (
  return_data : VaultReturnData
) : asserts return_data is EncumberedVaultReturnData {
  const { unit_balance, price_stamp, unit_price } = return_data
  if (unit_price === null || unit_price === undefined) {
    throw new Error('verify_encumbered_vault: unit price must be present')
  }
  if (price_stamp === null || price_stamp === undefined) {
    throw new Error('verify_encumbered_vault: price stamp must be present')
  }
  if (unit_balance <= 0) {
    throw new Error('verify_encumbered_vault: unit balance must be greater than zero')
  }
  // Verify the price oracle data.
  verify_price_oracle_data(return_data)
}

/**
 * Verify that vault data represents a cleared vault with no debt.
 * This is a business logic check, not schema validation.
 *
 * @param return_data - The vault return data to verify
 * @throws Error if business logic constraints are not met
 */
export function verify_cleared_vault (
  return_data : VaultReturnData
) : asserts return_data is ClearedVaultReturnData {
  const { unit_price, price_stamp, unit_balance, price_commits } = return_data
  if (unit_price !== null) {
    throw new Error('verify_cleared_vault: unit price must be null')
  }
  if (price_stamp !== null) {
    throw new Error('verify_cleared_vault: price stamp must be null')
  }
  if (unit_balance !== 0) {
    throw new Error('verify_cleared_vault: unit balance must be zero')
  }
  if (!Array.isArray(price_commits)) {
    throw new Error('verify_cleared_vault: price commits must be an array')
  }
  if (price_commits.length !== 0) {
    throw new Error('verify_cleared_vault: price commits must be empty')
  }
}

/**
 * Verify guardian data constraints.
 * This is a business logic check, not schema validation.
 *
 * @param guard_pubkeys - Array of guardian public keys
 * @throws Error if business logic constraints are not met
 */
export function verify_guardian_data (
  guard_pubkeys : string[]
) : void {
  if (guard_pubkeys.length === 0) {
    throw new Error('verify_guardian_data: guardian pubkeys must be non-empty')
  }
  if (guard_pubkeys.length > VAULT_MAX_GUARD_COUNT) {
    throw new Error(`verify_guardian_data: guardian count exceeds maximum (${guard_pubkeys.length} > ${VAULT_MAX_GUARD_COUNT})`)
  }
  // Check for duplicates.
  const unique_keys = unique(guard_pubkeys)
  if (unique_keys.length !== guard_pubkeys.length) {
    throw new Error(`verify_guardian_data: duplicate guardian pubkeys found (${guard_pubkeys.length - unique_keys.length} duplicates)`)
  }
}

/**
 * Verify price oracle data constraints.
 * This is a business logic check, not schema validation.
 *
 * @param return_data - The vault return data containing price commits
 * @throws Error if business logic constraints are not met
 */
export function verify_price_oracle_data (
  return_data : VaultReturnData
) : void {
  const { price_commits } = return_data
  if (price_commits.length === 0) {
    throw new Error('verify_price_oracle_data: price commits must be non-empty')
  }
  if (price_commits.length > VAULT_MAX_ORACLE_COUNT) {
    throw new Error(`verify_price_oracle_data: price commit count exceeds maximum (${price_commits.length} > ${VAULT_MAX_ORACLE_COUNT})`)
  }
  // Check for duplicate oracle pubkeys.
  const oracle_pubkeys = price_commits.map(c => c.oracle_pubkey)
  const unique_oracles = unique(oracle_pubkeys)
  if (unique_oracles.length !== oracle_pubkeys.length) {
    throw new Error(`verify_price_oracle_data: duplicate oracle pubkeys found (${oracle_pubkeys.length - unique_oracles.length} duplicates)`)
  }
}

/**
 * Verify vault balance is non-negative.
 * This is a business logic check, not schema validation.
 *
 * @param vault_value - The total vault value in satoshis
 * @param min_value   - The minimum required vault value in satoshis
 * @throws Error if vault balance would be negative
 */
export function verify_vault_balance (
  vault_value : number,
  min_value   : number
) : void {
  const balance = vault_value - min_value
  if (balance < 0) {
    throw new Error(`verify_vault_balance: balance cannot be negative (${vault_value} - ${min_value} = ${balance})`)
  }
}

/**
 * Verify borrow operation won't exceed collateral limits.
 * This is a business logic check.
 *
 * @param vault_ratio - The resulting collateral ratio after the borrow
 * @param rate_min - The minimum required collateral ratio
 * @throws Error if borrow would exceed maximum leverage
 */
export function verify_borrow_limits (
  vault_ratio : number | null,
  rate_min    : number
) : void {
  if (vault_ratio !== null && vault_ratio < rate_min) {
    throw new Error(`verify_borrow_limits: would exceed maximum leverage (ratio ${vault_ratio} < min ${rate_min})`)
  }
}

/**
 * Verify withdrawal won't break collateral ratio.
 * This is a business logic check.
 *
 * @param vault_ratio - The resulting collateral ratio after withdrawal
 * @param rate_min - The minimum required collateral ratio
 * @throws Error if withdrawal would break collateral ratio
 */
export function verify_withdrawal_limits (
  vault_ratio : number | null,
  rate_min    : number
) : void {
  if (vault_ratio !== null && vault_ratio < rate_min) {
    throw new Error(`verify_withdrawal_limits: would break collateral ratio (ratio ${vault_ratio} < min ${rate_min})`)
  }
}

/**
 * Verify oracle signatures on all price commits.
 * This is a business logic check that validates cryptographic integrity.
 *
 * @param vault_return  - Vault return data with price commits
 * @param proto_profile - Protocol profile with oracle registry
 * @throws Error if any oracle signature is invalid
 */
export function verify_price_commit_signatures (
  vault_return  : VaultReturnData,
  proto_profile : ProtoProfile
) : void {
  const { price_commits } = vault_return

  // Skip if no price commits (cleared vault)
  if (price_commits.length === 0) return

  // Extract full price contracts from the commits
  const contracts = extract_vault_price_contracts(proto_profile, vault_return)

  // Verify each oracle signature
  for (const contract of contracts) {
    verify_price_contract_signature(contract)
  }
}
