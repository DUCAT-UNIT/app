/**
 * @fileoverview Price-domain validators and oracle authorization checks.
 */

import { truncate }           from '@vbyte/util'
import { Assert }             from '@vbyte/util/assert'
import { hash160 }            from '@vbyte/crypto/hash'
import { get_oracle_records } from '@/lib/vault/util.js'
import * as SCHEMA            from '@/schema/index.js'

import type {
  PriceContract,
  PriceQuote,
  BreachedPriceContract,
  PriceObservation,
  ProtoProfile
} from '@/types/index.js'

/**
 * Asserts that all price configurations have the same base stamp.
 *
 * @param configs - The array of price configurations to check.
 * @throws If any configuration is missing a base stamp.
 * @throws If any configuration has a different base stamp than the first one.
 */
export function assert_consistent_price_stamp (
  configs : PriceQuote[] | PriceContract[]
) : void {
  // Get the base stamp from the first configuration.
  const base_stamp = configs.at(0)?.base_stamp
  // Assert that the base stamp is present.
  Assert.exists(base_stamp, `base stamp missing from price configuration`)
  // Assert that all configurations have the same base stamp.
  Assert.ok(configs.every(c => c.base_stamp === base_stamp), `base stamp mismatch: ${base_stamp} !== ${configs.map(c => c.base_stamp).join(', ')}`)
}

/**
 * Validates that the provided value is a valid PriceObservation.
 *
 * @param price_config - The value to validate.
 * @throws If the value does not conform to the PriceObservation schema.
 */
export function validate_price_observation (
  price_data : unknown
) : asserts price_data is PriceObservation {
  SCHEMA.price.observation.parse(price_data)
}

/**
 * Validates that the provided value is a valid PriceQuote.
 *
 * @param price_quote - The value to validate.
 * @throws If the value does not conform to the PriceQuote schema.
 */
export function validate_price_quote (
  price_quote : unknown
) : asserts price_quote is PriceQuote {
  const parsed_quote = SCHEMA.price.quote.parse(price_quote)
  const { rate_min, rate_max, rate_thold, step_size } = parsed_quote
  Assert.ok(rate_min > 0, 'rate_min must be greater than zero')
  Assert.ok(rate_max > 0, 'rate_max must be greater than zero')
  Assert.ok(rate_thold > 0, 'rate_thold must be greater than zero')
  Assert.ok(step_size > 0, 'step_size must be greater than zero')
  Assert.ok(rate_max >= rate_min, 'rate_max must be greater than or equal to rate_min')
  Assert.ok(rate_thold < rate_min, 'rate_thold must be less than rate_min')
}

/**
 * Validates that the provided value is a valid PriceContract.
 *
 * @param price_contract - The value to validate.
 * @throws If the value does not conform to the PriceContract schema.
 */
export function validate_price_contract (
  price_contract : unknown
) : asserts price_contract is PriceContract {
  SCHEMA.price.contract.parse(price_contract)
}

/**
 * Validates that the provided value is a valid BreachedPriceContract.
 *
 * A breached price contract is a price contract where the threshold key
 * has been revealed (non-null), indicating the price threshold was crossed.
 *
 * @param price_contract - The value to validate.
 * @throws If the value does not conform to the PriceContract schema.
 * @throws If the threshold key is null (contract not breached).
 */
export function validate_breached_price_contract (
  price_contract : unknown
) : asserts price_contract is BreachedPriceContract {
  validate_price_contract(price_contract)
  Assert.exists(price_contract.thold_key, `threshold key is null for price contract: ${price_contract.contract_id}`)
  const computed_thold_hash = hash160(price_contract.thold_key).hex
  Assert.ok(
    computed_thold_hash === price_contract.thold_hash,
    `threshold hash mismatch for price contract: ${price_contract.contract_id}`
  )
}

/**
 * Verify oracle is authorized in the protocol.
 * This is a business logic check.
 *
 * @param oracle_pubkey - The oracle public key to verify
 * @param proto_profile - The protocol profile containing authorized oracles
 * @throws Error if oracle is not registered in the protocol
 */
export function verify_oracle_authorized (
  oracle_pubkey : string,
  proto_profile : ProtoProfile
) : void {
  const oracle_records = get_oracle_records(proto_profile)
  const is_authorized = oracle_records.some(r => r.pubkey === oracle_pubkey)
  if (!is_authorized) {
    throw new Error(`verify_oracle_authorized: oracle ${truncate(oracle_pubkey, 16, '...')} is not registered`)
  }
}

/**
 * Verify all oracles in price commits are authorized in the protocol.
 * This is a business logic check.
 *
 * @param oracle_pubkeys - Array of oracle public keys to verify
 * @param proto_profile - The protocol profile containing authorized oracles
 * @throws Error if any oracle is not registered in the protocol
 */
export function verify_oracles_authorized (
  oracle_pubkeys : string[],
  proto_profile  : ProtoProfile
) : void {
  for (const pubkey of oracle_pubkeys) {
    verify_oracle_authorized(pubkey, proto_profile)
  }
}
