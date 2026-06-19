/**
 * @fileoverview Generic input parsing helpers.
 */

import { Assert, Test } from '@vbyte/util'

/**
 * Parse optional string input with an optional default fallback.
 *
 * @param input_value   - The value to parse; the default is returned when absent.
 * @param default_value - Fallback returned when `input_value` is not provided.
 * @returns The validated string, or `default_value` when the input is absent.
 * @throws {Error} When a provided value is not a string.
 */
export function parse_str_input (
  input_value?   : string,
  default_value? : string
) : string | undefined {
  // If the input value is not provided,
  if (!Test.exists(input_value)) return default_value
  // Assert that the input value is a string.
  Assert.ok(typeof input_value === 'string', 'input value must be a string')
  // Return the input value.
  return input_value
}

/**
 * Parse optional integer input with an optional default fallback.
 *
 * @param input_value   - The value to parse; the default is returned when absent.
 * @param default_value - Fallback returned when `input_value` is not provided.
 * @returns The parsed integer, or `default_value` when the input is absent.
 * @throws {Error} When a provided value is not an integer.
 */
export function parse_int_input (
  input_value?   : string,
  default_value? : number
) : number | undefined {
  // If the input value is not provided,
  if (!Test.exists(input_value)) return default_value
  // Convert the input value to a number.
  const value = Number(input_value)
  // Assert that the input value is an integer.
  Assert.ok(Number.isInteger(value), 'input value must be an integer')
  // Return the input value.
  return value
}
