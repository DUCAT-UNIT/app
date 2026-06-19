/**
 * @fileoverview Numeric helpers — ratios, sats/UNIT conversion, precision rounding, and collateral math.
 *
 * Numeric safety: sat/UNIT amounts are represented as JS `number`, not BigInt.
 * This is deliberate and bounded — public entry points guard inputs with
 * `Number.isSafeInteger` / `Number.isFinite` (rejecting NaN, Infinity, negative,
 * and values past `MAX_SAFE_INTEGER`), and step counting is integer-scaled to
 * keep IEEE rounding within `FLOAT_PRECISION`. Sat amounts provably fit in the
 * safe-integer range; callers must not feed unbounded or unchecked values.
 *
 * See the "Security Considerations" section of the README and
 * `docs/SECURITY_MODEL.md` for the money-math threat model. Migrating these
 * conversions to BigInt is a separate, out-of-scope change tracked as its own
 * ticket; this header documents the current float-with-safe-integer-guard
 * strategy, not a plan to replace it.
 */

import { Assert }                from '@vbyte/util/assert'
import { assert_finite_positive } from '@/validate/assert.js'

import {
  FLOAT_PRECISION,
  SATS_PER_BTC
} from '@/const.js'

/**
 * Trim a float value to a given precision.
 * @param float_value - The float value to trim
 * @param precision   - The precision to trim to
 * @returns The trimmed float value
 */
export function trim_float (
  float_value : number,
  precision   : number = FLOAT_PRECISION
) : number {
  return parseFloat(float_value.toFixed(precision))
}

/**
 * Calculate what ratio an amount represents of a total.
 * @param amount - The amount (numerator)
 * @param total  - The total (denominator)
 * @returns Decimal ratio between 0 and 1
 */
export function calc_ratio (
  amount : number,
  total  : number
) : number {
  // Assert that the amount is a finite, positive number.
  assert_finite_positive(amount, 'amount')
  // Assert that the total is a finite, positive number.
  assert_finite_positive(total, 'total')
  // Assert the total is greater than or equal to the amount.
  Assert.ok(total >= amount, 'total must be greater than amount')
  // If the total is equal to the amount, return 1.
  if (amount === total) return 1
  // Calculate what ratio the amount represents of the total.
  const ratio = amount / total
  // Return the ratio as a trimmed float.
  return trim_float(ratio)
}

/**
 * Calculate a portion of an amount based on a ratio.
 * @param amount - The total amount to take a portion from
 * @param ratio  - The ratio (0-1) representing what portion to take
 * @returns The portion as a rounded integer
 */
export function calc_portion (
  amount : number,
  ratio  : number
) : number {
  // Calculate the portion as a trimmed float.
  const portion = trim_float(amount * ratio)
  // Return the portion rounded to the nearest integer.
  return Math.round(portion)
}

/**
 * Calculate a portion of an amount using ceiling (for amounts that must cover debt).
 * Use this when rounding down would leave debt unpaid.
 * @param amount - The total amount to take a portion from
 * @param ratio  - The ratio (0-1) representing what portion to take
 * @returns The portion as a ceiling integer
 */
export function calc_portion_ceil (
  amount : number,
  ratio  : number
) : number {
  // Calculate the portion.
  const portion = amount * ratio
  // Return the portion rounded up to ensure full coverage.
  return Math.ceil(portion)
}

/**
 * Convert satoshis to units using the given rate.
 * @param sats_amount - Amount in satoshis
 * @param unit_rate   - Units per coin conversion rate
 * @returns Amount in units as a rounded integer
 */
export function convert_sats_to_unit (
  sats_amount : number,
  unit_rate   : number
) : number {
  // Assert that the sats amount is a positive number.
  Assert.ok(sats_amount > 0, 'sats amount must be greater than zero')
  // Assert that the sats amount is within safe integer range.
  Assert.ok(Number.isSafeInteger(sats_amount), `sats amount exceeds safe integer range: ${sats_amount}`)
  // Assert that the unit rate is a finite, positive number.
  assert_finite_positive(unit_rate, 'unit rate')
  // Convert the sats amount to coins.
  const coin_amt = sats_amount / SATS_PER_BTC
  // Convert the coins amount to units.
  const unit_amt = coin_amt * unit_rate
  // Return the unit amount rounded to the nearest integer.
  return Math.round(unit_amt)
}

/**
 * Convert units to satoshis using the given rate.
 * @param unit_amount - Amount in units
 * @param unit_rate   - Units per coin conversion rate
 * @returns Amount in satoshis as a rounded integer
 */
export function convert_unit_to_sats (
  unit_amount : number,
  unit_rate   : number
) : number {
  // If the unit amount is zero, return zero.
  if (unit_amount === 0) return 0
  // Assert that the unit amount is a positive number.
  Assert.ok(unit_amount > 0, 'unit amount must be greater than zero')
  // Assert that the unit amount is within safe integer range.
  Assert.ok(Number.isSafeInteger(unit_amount), `unit amount exceeds safe integer range: ${unit_amount}`)
  // Assert that the unit rate is a positive number.
  Assert.ok(unit_rate   > 0, 'unit rate must be greater than zero')
  // Convert the unit amount to coins.
  const coin_amt = unit_amount / unit_rate
  // Convert the coins amount to sats.
  const sats_amt = coin_amt * SATS_PER_BTC
  // Return the sats amount rounded to the nearest integer.
  return Math.round(sats_amt)
}

/**
 * Calculate the collateral ratio (collateral value / debt value).
 * @param sats_amount - Collateral amount in satoshis
 * @param unit_amount - Debt amount in units
 * @param unit_rate - Units per coin conversion rate
 * @returns Collateral ratio as a trimmed float
 */
export function calc_collateral_ratio (
  sats_amount : number,
  unit_amount : number,
  unit_rate   : number
) : number {
  // If the sats amount is zero or the unit amount is zero, return zero.
  if (sats_amount === 0 || unit_amount === 0) return 0
  // Convert the sats amount to base unit (e.g., cents).
  const collateral_amt  = convert_sats_to_unit(sats_amount, unit_rate)
  // Assert that the collateral amount is a positive number.
  Assert.ok(collateral_amt > 0, 'collateral amount must be greater than zero')
  // Assert that the unit amount is a positive number.
  Assert.ok(unit_amount > 0, 'unit amount must be greater than zero')
  // Calculate the collateral ratio as a trimmed float.
  const collateral_rate = collateral_amt / unit_amount
  // Return the collateral ratio as a trimmed float.
  return trim_float(collateral_rate)
}

/**
 * Calculate the portion of collateral in satoshis based on a ratio.
 * @param coll_ratio  - The collateral ratio (0-1)
 * @param unit_amount - Amount in units
 * @param unit_rate   - Units per coin conversion rate
 * @returns Collateral portion in satoshis as a rounded integer
 */
export function calc_collateral_portion (
  coll_ratio  : number,
  unit_amount : number,
  unit_rate   : number
) : number {
  // Convert the unit amount to sats.
  const sats_amt = convert_unit_to_sats(unit_amount, unit_rate)
  // Return a portion of the sats amount based on the collateral ratio.
  return calc_portion(sats_amt, coll_ratio)
}

/**
 * Count the number of fractional decimal places in a number.
 *
 * @param value - The number to inspect.
 * @returns The decimal-place count (0 for integers).
 * @throws {Error} When `value` is NaN.
 */
export function get_decimal_count (value: number): number {
  // Assert that the value is a number.
  Assert.ok(!Number.isNaN(value), 'value must be a number')
  // If the value is an integer, return 0.
  if (Number.isInteger(value)) return 0
  // Get the decimal places from the value.
  const str = value.toString()
  // Return the decimal places.
  return str.includes('.') ? str.split('.')[1].length : 0
}

/**
 * Count the number of whole steps between a value and a base, using
 * integer-scaled arithmetic to avoid IEEE 754 drift.
 *
 * Equivalent to `Math.floor((value - base) / step_size)` but immune
 * to floating-point errors such as `(2.0 - 1.6) / 0.01 = 39.999…`.
 *
 * @param value     - The value to measure from.
 * @param base      - The base to measure against.
 * @param step_size - The step size.
 * @returns The number of whole steps as a non-negative integer.
 */
export function count_steps_scaled (
  value     : number,
  base      : number,
  step_size : number
) : number {
  const precision     = get_decimal_count(step_size)
  const scale         = 10 ** precision
  const value_scaled  = Math.round(value * scale)
  const base_scaled   = Math.round(base * scale)
  const step_scaled   = Math.round(step_size * scale)
  Assert.ok(step_scaled > 0, 'step size must resolve to a positive integer scale')
  return Math.floor((value_scaled - base_scaled) / step_scaled)
}

/**
 * Reconstruct a bucket rate from a step count using integer-scaled arithmetic.
 *
 * Produces the exact same double the oracle enumerates (`rate_scaled / scale`),
 * making this the inverse of {@link count_steps_scaled}. Using this instead of
 * `step_count * step_size + rate_min` avoids IEEE 754 drift such as
 * `359 * 0.01 + 1.35 = 4.9399999999999995`, which would otherwise floor down a
 * whole bucket and cause client/oracle commit-hash mismatches.
 *
 * @param rate_min   - The base rate (lower bound of the bucket range).
 * @param step_size  - The step size.
 * @param step_count - The whole number of steps above `rate_min`.
 * @returns The reconstructed bucket rate.
 * @throws {Error} When `step_count` is not a non-negative integer.
 */
export function get_bucket_rate (
  rate_min   : number,
  step_size  : number,
  step_count : number
) : number {
  Assert.ok(Number.isInteger(step_count), 'step count must be an integer')
  Assert.ok(step_count >= 0, 'step count cannot be negative')
  const precision       = get_decimal_count(step_size)
  const scale           = 10 ** precision
  const rate_min_scaled = Math.round(rate_min * scale)
  const step_scaled     = Math.round(step_size * scale)
  Assert.ok(step_scaled > 0, 'step size must resolve to a positive integer scale')
  return (rate_min_scaled + step_count * step_scaled) / scale
}

/**
 * Floor a number to a fixed number of decimal places.
 *
 * @param value     - The number to floor.
 * @param precision - Decimal places to keep (a non-negative integer; 0 floors
 *   to a whole number).
 * @returns The value floored to `precision` decimals.
 * @throws {Error} When `value` is NaN or `precision` is not a non-negative integer.
 */
export function floor_to_precision (
  value     : number,
  precision : number
): number {
  // Assert that the value is a number.
  Assert.ok(!Number.isNaN(value), 'value must be a number')
  // Assert that the precision is a positive integer.
  Assert.ok(Number.isInteger(precision), 'precision must be a positive integer')
  // Assert that the precision is greater than zero.
  Assert.ok(precision >= 0, 'precision cannot be negative')
  // If the precision is zero, return the value.
  if (precision === 0) return Math.floor(value)
  // Round the value to the precision.
  return Math.floor(value * 10 ** precision) / 10 ** precision
}

/**
 * Get the adjusted unit price from the base price and divisibility.
 *
 * @param base_price    - The base price to adjust.
 * @param divisibility? - The divisibility to use for adjustment.
 * @returns The adjusted unit price.
 */
export function get_adjusted_unit_price (
  base_price   : number,
  divisibility : number = 0
) : number {
  // If the divisibility is zero, return the unit price.
  if (divisibility === 0) return base_price
  // Calculate the divisibility factor.
  const adjusted_price = base_price * (10 ** divisibility)
  // Return the adjusted unit price.
  return trim_float(adjusted_price, divisibility)
}

/**
 * Converts a display amount (e.g., dollars) to smallest units (e.g., cents).
 * Validates float precision matches divisibility before conversion.
 *
 * @param display_amount - Amount in display units (can be float, e.g., 10.50)
 * @param divisibility   - Asset divisibility (e.g., 2 for cents)
 * @returns Amount in smallest units (integer)
 * @throws If float precision exceeds divisibility
 */
export function convert_display_to_smallest (
  display_amount : number,
  divisibility   : number = 0
) : number {
  // If the divisibility is zero, return the amount as-is (rounded).
  if (divisibility === 0) return Math.round(display_amount)
  // Calculate the scaling factor.
  const scale_factor = 10 ** divisibility
  // Scale the display amount.
  const scaled = display_amount * scale_factor
  // Round to nearest integer.
  const rounded = Math.round(scaled)
  // Check for precision loss (e.g., 10.999 with div=2 would lose the third decimal).
  if (Math.abs(scaled - rounded) > 1e-9) {
    throw new Error(
      `Amount ${display_amount} has more precision than divisibility ${divisibility} allows`
    )
  }
  // Return the rounded smallest unit value.
  return rounded
}

/**
 * Converts smallest units (e.g., cents) to display units (e.g., dollars).
 *
 * @param smallest_amount - Amount in smallest units (integer)
 * @param divisibility    - Asset divisibility (e.g., 2 for cents)
 * @returns Amount in display units (float)
 */
export function convert_smallest_to_display (
  smallest_amount : number,
  divisibility    : number = 0
) : number {
  // If the divisibility is zero, return the amount as-is.
  if (divisibility === 0) return smallest_amount
  // Calculate the scaling factor.
  const scale_factor = 10 ** divisibility
  // Return the display amount.
  return smallest_amount / scale_factor
}
