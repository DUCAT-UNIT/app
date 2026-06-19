/**
 * @fileoverview Price-contract creation, derivation, and verification helpers.
 */

import { Buff, Bytes }                from '@vbyte/buff'
import { Assert }                     from '@vbyte/util/assert'
import { sort }                       from '@vbyte/util/obj'
import { sign_bip340, verify_bip340 } from '@vbyte/crypto/ecc'
import { hash160, hmac256, hash340 }  from '@vbyte/crypto/hash'

import {
  count_steps_scaled,
  get_bucket_rate
} from '@/lib/index.js'

import {
  get_threshold_price,
  validate_price_contract,
  validate_price_quote,
  get_base_price_config,
  validate_price_observation
} from '@/lib/price/index.js'

import type {
  PriceBucket,
  PriceContract,
  PriceQuote,
  BreachedPriceContract,
  PriceObservation
} from '@/types/index.js'

/**
 * Creates a signed price contract for a specific threshold price.
 *
 * A price contract commits an oracle to a specific price observation and threshold.
 * The contract includes a commitment hash, a threshold key (derived via HMAC),
 * and an oracle signature over the contract ID.
 *
 * @param oracle_seckey - The oracle's secret key for signing and key derivation.
 * @param price_data    - The price observation data (base price, timestamp, network, oracle pubkey).
 * @param thold_price   - The threshold price for this contract.
 * @returns A complete signed price contract.
 * @throws If the price configuration is invalid.
 */
export function create_price_contract (
  oracle_seckey : string,
  price_data    : PriceObservation,
  thold_price   : number
) : PriceContract {
  // Assert price data is correct.
  validate_price_observation(price_data)
  // Compute the commitment hash for the contract.
  const commit_hash = get_price_contract_commit_hash(price_data, thold_price)
  // Compute the HMAC-256 hash of the oracle secret key and commitment hash.
  const thold_key   = get_price_contract_thold_key(oracle_seckey, commit_hash)
  // Compute the hash160 hash of the threshold key.
  const thold_hash  = get_price_contract_thold_hash(thold_key)
  // Compute the contract id for the contract.
  const contract_id = get_price_contract_id(commit_hash, thold_hash)
  // Sign the contract id with the oracle secret key.
  const oracle_sig  = sign_bip340(oracle_seckey, contract_id).hex
  // Return the completed price contract.
  return sort({ ...price_data, commit_hash, contract_id, oracle_sig, thold_hash, thold_key: null, thold_price })
}

/**
 * Creates a breached price contract by revealing the threshold key.
 *
 * @param oracle_seckey - The oracle's secret key for signing and key derivation.
 * @param price_contract - The price contract to reveal the threshold key for.
 * @returns The breached price contract.
 */
export function create_breached_contract (
  oracle_seckey  : string,
  price_contract : PriceContract
) : BreachedPriceContract {
  // Assert that the price contract is valid.
  validate_price_contract(price_contract)
  // Compute the commitment hash for the contract.
  const commit_hash = get_price_contract_commit_hash(price_contract, price_contract.thold_price)
  // Compute the HMAC-256 hash of the oracle secret key and commitment hash.
  const thold_key   = hmac256(oracle_seckey, commit_hash).hex
  // Return the breached price contract.
  return { ...price_contract, thold_key }
}

/**
 * Generates a complete set of price buckets for all rate buckets in a price quote.
 *
 * Iterates through all rate buckets from rate_min to rate_max (inclusive) using
 * step_size increments, creating a signed price contract for each unique threshold
 * price. Each returned bucket carries the exact `base_rate` that produced it (the
 * lowest rate of any dedup-collapsed group), reconstructed via {@link get_bucket_rate}
 * so it is bit-identical to the rate the client selector derives.
 *
 * @param oracle_seckey - The oracle's secret key for signing contracts.
 * @param price_quote   - The price quote defining the rate range and parameters.
 * @returns An array of price buckets, one for each unique threshold price.
 * @throws If the price quote is invalid.
 */
export function generate_price_buckets (
  oracle_seckey : string,
  price_quote   : PriceQuote
) : PriceBucket[] {
  // Validate the quote configuration.
  validate_price_quote(price_quote)
  // Unpack the quote configuration.
  const { rate_min, rate_max, step_size } = price_quote
  // Initialize the price buckets array.
  const buckets : PriceBucket[] = []
  // Define the base price configuration.
  const base_config = get_base_price_config(price_quote)
  // Count the total number of whole steps from rate_min to rate_max (inclusive),
  // using integer-scaled arithmetic to avoid floating-step drift.
  const step_total = count_steps_scaled(rate_max, rate_min, step_size)
  // Track thresholds to avoid duplicate contracts from adjacent buckets.
  const seen_thold_prices = new Set<number>()

  for (let step_count = 0; step_count <= step_total; step_count++) {
    // Reconstruct the bucket rate (drift-free, shared with the client selector).
    const base_rate = get_bucket_rate(rate_min, step_size, step_count)
    const thold_price = get_threshold_price(price_quote, base_rate)
    if (seen_thold_prices.has(thold_price)) continue

    seen_thold_prices.add(thold_price)
    const contract = create_price_contract(oracle_seckey, base_config, thold_price)
    buckets.push({ base_rate, contract })
  }
  // Return the price buckets array.
  return buckets
}

/**
 * Generates a complete set of price contracts for all rate buckets in a price quote.
 *
 * Thin wrapper over {@link generate_price_buckets} that returns only the signed
 * contracts. Prefer {@link generate_price_buckets} when the originating `base_rate`
 * of each contract is needed (e.g. event metadata).
 *
 * @param oracle_seckey - The oracle's secret key for signing contracts.
 * @param price_quote   - The price quote defining the rate range and parameters.
 * @returns An array of signed price contracts, one for each unique threshold price.
 * @throws If the price quote is invalid.
 */
export function generate_price_contracts (
  oracle_seckey : string,
  price_quote   : PriceQuote
) : PriceContract[] {
  return generate_price_buckets(oracle_seckey, price_quote).map(b => b.contract)
}

/**
 * Verifies the structural integrity and oracle signature of a price contract.
 *
 * Validates the contract structure, recomputes the commitment hash and contract ID,
 * and verifies the oracle's BIP-340 signature over the contract ID.
 *
 * Note: this is the low-level structural + signature check. For the full
 * trust-boundary verifier (including oracle membership in a proto and
 * thold_price range invariants), use `verify_price_contract` from
 * `@/lib/verify/price.js`.
 *
 * @param contract - The price contract to verify.
 * @throws If the contract structure is invalid.
 * @throws If the computed contract ID does not match the provided contract_id.
 * @throws If the oracle signature verification fails.
 */
export function verify_price_contract_signature (
  contract : PriceContract
) : asserts contract is PriceContract {
  // Assert the oracle price contract is valid.
  validate_price_contract(contract)
  // Unpack the oracle price contract data.
  const { oracle_sig, oracle_pubkey, thold_hash, thold_price, contract_id } = contract
  // Compute the price commitment hash for the contract.
  const commit_hash = get_price_contract_commit_hash(contract, thold_price)
  // Compute the price contract id for the contract.
  const computed_id = get_price_contract_id(commit_hash, thold_hash)
  // Assert the price contract id is correct.
  Assert.ok(computed_id === contract_id, 'contract id mismatch')
  // Verify the oracle signature for the price contract id.
  Assert.ok(verify_bip340(oracle_sig, contract_id, oracle_pubkey), 'oracle signature verification failed')
}

/**
 * Computes the commitment hash for a price observation and threshold price.
 *
 * The commitment hash is a tagged hash (using 'ducat/price_commit_hash') over
 * the serialized price configuration and threshold price. This hash uniquely
 * identifies a specific price commitment.
 *
 * @param price_config - The price observation data.
 * @returns The hex-encoded contract commit hash.
 */
export function get_price_contract_commit_hash (
  price_data  : PriceObservation,
  thold_price : number
) : string {
  // Serialize the price configuration into a preimage.
  const preimage = Buff.join([
    Buff.hex(price_data.oracle_pubkey, 32),
    Buff.str(price_data.chain_network),
    Buff.num(price_data.base_price,  4),
    Buff.num(price_data.base_stamp,  4),
    Buff.num(thold_price, 4)
  ])
  // Return the computed price commitment hash for the price configuration.
  return hash340('ducat/price_contract_commit', preimage).hex
}

/**
 * Computes the threshold key for a price contract.
 *
 * The threshold key is a HMAC-256 hash of the oracle secret key and the price contract commit.
 *
 * @param oracle_seckey - The oracle's secret key for signing and key derivation.
 * @param price_commit  - The price contract commit to compute the threshold key for.
 * @returns The hex-encoded threshold key.
 */
export function get_price_contract_thold_key (
  oracle_seckey : string,
  price_commit  : string
) : string {
  // Return the computed price contract key.
  return hmac256(oracle_seckey, price_commit).hex
}

/**
 * Computes the threshold hash for a price contract.
 *
 * The threshold hash is a hash160 hash of the threshold key.
 *
 * @param thold_key - The threshold key to compute the hash for.
 * @returns The hex-encoded threshold hash.
 */
export function get_price_contract_thold_hash (
  thold_key : string
) : string {
  // Return the computed price contract thold hash.
  return hash160(thold_key).hex
}

/**
 * Computes the price contract ID from a commitment hash and threshold hash.
 *
 * The contract ID is a tagged hash (using 'ducat/price_contract_id') that
 * uniquely identifies a price contract. This ID is signed by the oracle.
 *
 * @param commit_id  - The price commitment hash.
 * @param thold_hash - The hash of the threshold key.
 * @returns The hex-encoded price contract ID.
 */
export function get_price_contract_id (
  commit_id  : Bytes,
  thold_hash : Bytes
) : string {
  // Serialize the commit id and thold hash into a preimage.
  const preimage = Buff.join([ commit_id, thold_hash ])
  // Return the computed price contract id for the commit id and thold hash.
  return hash340('ducat/price_contract_id', preimage).hex
}
