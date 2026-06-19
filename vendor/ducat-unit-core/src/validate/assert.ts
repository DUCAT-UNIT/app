/**
 * @fileoverview Assertion helpers for protocol scalars — dust limits, BIP-340 pubkeys, and numeric bounds.
 */

import { Assert }        from '@vbyte/util/assert'
import { verify_pubkey } from '@vbyte/crypto/ecc'
import { DUST_LIMIT }    from '@/const.js'

/** Assert amount is at or above dust threshold. */
export function assert_dust_limit (
  amount   : number,
  message? : string
) {
  const msg = message ?? `amount must be greater than dust limit`
  Assert.ok(amount >= DUST_LIMIT, msg)
}

/** Assert input is a valid BIP340 x-only public key. */
export function assert_bip340_pubkey (
  pubkey : string
) : asserts pubkey is string {
  Assert.is_hash(pubkey, `invalid pubkey format: ${pubkey}`)
  verify_pubkey(pubkey, 'bip340')
}

/**
 * Assert value is a safe integer (within JavaScript's precise range).
 * JavaScript can only precisely represent integers in the range
 * -(2^53 - 1) to (2^53 - 1).
 *
 * @param value - The value to check
 * @param name - Name of the value for error messages
 * @throws Error if value is not a safe integer
 */
export function assert_safe_integer (
  value : number,
  name  : string
) : void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite`)
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} exceeds safe integer range: ${value}`)
  }
}

/**
 * Assert value is finite (not NaN or Infinity).
 *
 * @param value - The value to check
 * @param name - Name of the value for error messages
 * @throws Error if value is not finite
 */
export function assert_finite (
  value : number,
  name  : string
) : void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite, got: ${value}`)
  }
}

/**
 * Assert value is positive (greater than zero).
 *
 * @param value - The value to check
 * @param name - Name of the value for error messages
 * @throws Error if value is not positive
 */
export function assert_positive (
  value : number,
  name  : string
) : void {
  if (value <= 0) {
    throw new Error(`${name} must be positive, got: ${value}`)
  }
}

/**
 * Assert value is a finite positive number (rejects NaN/Infinity and values
 * at or below zero). The finite check rejects Infinity, which would otherwise
 * slip past a bare `> 0` comparison.
 *
 * @param value - The value to check
 * @param name - Name of the value for error messages
 * @throws Error if value is not a finite positive number
 */
export function assert_finite_positive (
  value : number,
  name  : string
) : void {
  Assert.ok(Number.isFinite(value) && value > 0, `${name} must be a finite positive number: ${value}`)
}

/**
 * Assert value is non-negative (greater than or equal to zero).
 *
 * @param value - The value to check
 * @param name - Name of the value for error messages
 * @throws Error if value is negative
 */
export function assert_nonnegative (
  value : number,
  name  : string
) : void {
  if (value < 0) {
    throw new Error(`${name} must be non-negative, got: ${value}`)
  }
}
