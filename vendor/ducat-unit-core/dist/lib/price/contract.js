import { Buff } from '@vbyte/buff';
import { Assert } from '@vbyte/util/assert';
import { sort } from '@vbyte/util/obj';
import { sign_bip340, verify_bip340 } from '@vbyte/crypto/ecc';
import { hash160, hmac256, hash340 } from '@vbyte/crypto/hash';
import { count_steps_scaled, get_bucket_rate } from '../../lib/index.js';
import { get_threshold_price, validate_price_contract, validate_price_quote, get_base_price_config, validate_price_observation } from '../../lib/price/index.js';
export function create_price_contract(oracle_seckey, price_data, thold_price) {
    validate_price_observation(price_data);
    const commit_hash = get_price_contract_commit_hash(price_data, thold_price);
    const thold_key = get_price_contract_thold_key(oracle_seckey, commit_hash);
    const thold_hash = get_price_contract_thold_hash(thold_key);
    const contract_id = get_price_contract_id(commit_hash, thold_hash);
    const oracle_sig = sign_bip340(oracle_seckey, contract_id).hex;
    return sort({ ...price_data, commit_hash, contract_id, oracle_sig, thold_hash, thold_key: null, thold_price });
}
export function create_breached_contract(oracle_seckey, price_contract) {
    validate_price_contract(price_contract);
    const commit_hash = get_price_contract_commit_hash(price_contract, price_contract.thold_price);
    const thold_key = hmac256(oracle_seckey, commit_hash).hex;
    return { ...price_contract, thold_key };
}
export function generate_price_buckets(oracle_seckey, price_quote) {
    validate_price_quote(price_quote);
    const { rate_min, rate_max, step_size } = price_quote;
    const buckets = [];
    const base_config = get_base_price_config(price_quote);
    const step_total = count_steps_scaled(rate_max, rate_min, step_size);
    const seen_thold_prices = new Set();
    for (let step_count = 0; step_count <= step_total; step_count++) {
        const base_rate = get_bucket_rate(rate_min, step_size, step_count);
        const thold_price = get_threshold_price(price_quote, base_rate);
        if (seen_thold_prices.has(thold_price))
            continue;
        seen_thold_prices.add(thold_price);
        const contract = create_price_contract(oracle_seckey, base_config, thold_price);
        buckets.push({ base_rate, contract });
    }
    return buckets;
}
export function generate_price_contracts(oracle_seckey, price_quote) {
    return generate_price_buckets(oracle_seckey, price_quote).map(b => b.contract);
}
export function verify_price_contract_signature(contract) {
    validate_price_contract(contract);
    const { oracle_sig, oracle_pubkey, thold_hash, thold_price, contract_id } = contract;
    const commit_hash = get_price_contract_commit_hash(contract, thold_price);
    const computed_id = get_price_contract_id(commit_hash, thold_hash);
    Assert.ok(computed_id === contract_id, 'contract id mismatch');
    Assert.ok(verify_bip340(oracle_sig, contract_id, oracle_pubkey), 'oracle signature verification failed');
}
export function get_price_contract_commit_hash(price_data, thold_price) {
    const preimage = Buff.join([
        Buff.hex(price_data.oracle_pubkey, 32),
        Buff.str(price_data.chain_network),
        Buff.num(price_data.base_price, 4),
        Buff.num(price_data.base_stamp, 4),
        Buff.num(thold_price, 4)
    ]);
    return hash340('ducat/price_contract_commit', preimage).hex;
}
export function get_price_contract_thold_key(oracle_seckey, price_commit) {
    return hmac256(oracle_seckey, price_commit).hex;
}
export function get_price_contract_thold_hash(thold_key) {
    return hash160(thold_key).hex;
}
export function get_price_contract_id(commit_id, thold_hash) {
    const preimage = Buff.join([commit_id, thold_hash]);
    return hash340('ducat/price_contract_id', preimage).hex;
}
