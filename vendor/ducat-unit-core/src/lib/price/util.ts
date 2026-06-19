/**
 * @fileoverview Price-selection helpers and threshold calculations.
 */

import { Assert }                        from '@vbyte/util/assert'
import { assert_consistent_price_stamp } from '@/lib/price/index.js'

import type {
  PriceCommitData,
  PriceContract,
  PriceQuote,
  PriceObservation
} from '@/types/index.js'

/**
 * Calculates the threshold price for a given price quote and base rate.
 *
 * The threshold price represents the price level at which a collateral
 * position would be considered undercollateralized for the given rate bucket.
 *
 * @param price_quote - The price quote containing base price and threshold rate.
 * @param base_rate   - The base rate to use for the calculation.
 * @returns The threshold price as an integer (in satoshis).
 * @throws If the calculated threshold price is not an integer.
 */
export function get_threshold_price (
  price_quote : PriceQuote,
  base_rate   : number
) : number {
  // Unpack the price quote.
  const { base_price, rate_thold } = price_quote
  // Calculate the threshold price.
  const thold_price = Math.ceil(base_price * rate_thold / base_rate )
  // Assert that the threshold price is an integer.
  Assert.ok(Number.isInteger(thold_price), 'thold price must be an integer')
  // Assert that the threshold price is greater than zero.
  Assert.ok(thold_price > 0, 'thold price must be greater than zero')
  // Assert that the threshold price is less than the base price.
  Assert.ok(thold_price < base_price, 'thold price must be less than base price')
  // Return the threshold price.
  return thold_price
}

/**
 * Gets the base price configuration from a price quote.
 *
 * @param price_quote - The price quote to get the base price configuration from.
 * @returns The base price configuration.
 */
export function get_base_price_config (
  price_quote : PriceQuote
) : PriceObservation {
  // Unpack the price quote.
  const { base_price, base_stamp, chain_network, oracle_pubkey } = price_quote
  // Return the base price configuration.
  return { base_price, base_stamp, chain_network, oracle_pubkey }
}

/**
 * Selects the entry with the lowest base_price from a list.
 *
 * Sorts the entries by base_price in ascending order and returns the first one.
 * Shared by the select_base_price_* helpers to identify the most conservative
 * (lowest base_price) entry.
 *
 * @param items - The array of price entries to select from.
 * @returns The entry with the lowest base_price, or null if the array is empty.
 */
function select_lowest_base_price <T extends { base_price : number }> (
  items : T[]
) : T | null {
  return items.sort((a, b) => a.base_price - b.base_price).at(0) ?? null
}

/**
 * Selects the base (lowest base_price) price quote from an array of quotes.
 *
 * Used to identify the most conservative price observation.
 *
 * @param price_quotes - The array of price quotes to select from.
 * @returns The quote with the lowest base_price, or null if the array is empty.
 * @throws If the price quotes have different base stamps.
 */
export function select_base_price_quote (
  price_quotes : PriceQuote[]
) : PriceQuote | null {
  // If there are no price quotes, return null.
  if (!price_quotes || price_quotes.length === 0) return null
  // Assert that all price quotes have the same base stamp.
  assert_consistent_price_stamp(price_quotes)
  // Return the quote with the lowest base price.
  return select_lowest_base_price(price_quotes)
}

/**
 * Selects the base (lowest base_price) price contract from an array of contracts.
 *
 * Used to identify the most conservative price contract.
 *
 * @param price_contracts - The array of price contracts to select from.
 * @returns The contract with the lowest base_price, or null if the array is empty.
 * @throws If the price contracts have different base stamps.
 */
export function select_base_price_contract (
  price_contracts : PriceContract[]
) : PriceContract | null {
  // If there are no price contracts, return null.
  if (!price_contracts || price_contracts.length === 0) return null
  // Assert that all price contracts have the same base stamp.
  assert_consistent_price_stamp(price_contracts)
  // Return the contract with the lowest base price.
  return select_lowest_base_price(price_contracts)
}

/**
 * Selects the base (lowest base_price) price commit from an array of commits.
 *
 * Used to identify the most conservative price commitment.
 *
 * @param price_commits - The array of price commits to select from.
 * @returns The commit with the lowest base_price, or null if the array is empty.
 */
export function select_base_price_commit (
  price_commits : PriceCommitData[]
) : PriceCommitData | null {
  // If there are no price commits, return null.
  if (price_commits.length === 0) return null
  // NOTE: unlike quote/contract selection, commits are not stamp-checked —
  // PriceCommitData has no base_stamp field, so assert_consistent_price_stamp
  // (which validates base_stamp) is structurally inapplicable here.
  // Return the commit with the lowest base price.
  return select_lowest_base_price(price_commits)
}
