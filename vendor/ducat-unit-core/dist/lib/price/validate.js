import { truncate } from '@vbyte/util';
import { Assert } from '@vbyte/util/assert';
import { hash160 } from '@vbyte/crypto/hash';
import { get_oracle_records } from '../../lib/vault/util.js';
import * as SCHEMA from '../../schema/index.js';
export function assert_consistent_price_stamp(configs) {
    const base_stamp = configs.at(0)?.base_stamp;
    Assert.exists(base_stamp, `base stamp missing from price configuration`);
    Assert.ok(configs.every(c => c.base_stamp === base_stamp), `base stamp mismatch: ${base_stamp} !== ${configs.map(c => c.base_stamp).join(', ')}`);
}
export function validate_price_observation(price_data) {
    SCHEMA.price.observation.parse(price_data);
}
export function validate_price_quote(price_quote) {
    const parsed_quote = SCHEMA.price.quote.parse(price_quote);
    const { rate_min, rate_max, rate_thold, step_size } = parsed_quote;
    Assert.ok(rate_min > 0, 'rate_min must be greater than zero');
    Assert.ok(rate_max > 0, 'rate_max must be greater than zero');
    Assert.ok(rate_thold > 0, 'rate_thold must be greater than zero');
    Assert.ok(step_size > 0, 'step_size must be greater than zero');
    Assert.ok(rate_max >= rate_min, 'rate_max must be greater than or equal to rate_min');
    Assert.ok(rate_thold < rate_min, 'rate_thold must be less than rate_min');
}
export function validate_price_contract(price_contract) {
    SCHEMA.price.contract.parse(price_contract);
}
export function validate_breached_price_contract(price_contract) {
    validate_price_contract(price_contract);
    Assert.exists(price_contract.thold_key, `threshold key is null for price contract: ${price_contract.contract_id}`);
    const computed_thold_hash = hash160(price_contract.thold_key).hex;
    Assert.ok(computed_thold_hash === price_contract.thold_hash, `threshold hash mismatch for price contract: ${price_contract.contract_id}`);
}
export function verify_oracle_authorized(oracle_pubkey, proto_profile) {
    const oracle_records = get_oracle_records(proto_profile);
    const is_authorized = oracle_records.some(r => r.pubkey === oracle_pubkey);
    if (!is_authorized) {
        throw new Error(`verify_oracle_authorized: oracle ${truncate(oracle_pubkey, 16, '...')} is not registered`);
    }
}
export function verify_oracles_authorized(oracle_pubkeys, proto_profile) {
    for (const pubkey of oracle_pubkeys) {
        verify_oracle_authorized(pubkey, proto_profile);
    }
}
