import { Assert } from '@vbyte/util';
import { DEFAULT_POSTAGE, SATS_PER_BTC } from '../../const.js';
import { get_unit_asset_id } from '../../lib/index.js';
import { calc_collateral_ratio, count_steps_scaled, floor_to_precision, get_adjusted_unit_price, get_asset_pool, get_asset_profile, get_bucket_rate, get_decimal_count, get_price_contract_commit_hash, get_threshold_price, get_vault_terms, select_base_price_quote, validate_price_quote } from '@ducat-unit/core/lib';
export function get_adjusted_quote_price(proto_profile, price_quote) {
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    const asset_profile = get_asset_profile(proto_profile, vault_terms.unit_asset_id);
    return get_adjusted_unit_price(price_quote.base_price, asset_profile.div);
}
export function get_adjusted_commit_price(proto_profile, price_commit) {
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    const asset_profile = get_asset_profile(proto_profile, vault_terms.unit_asset_id);
    return get_adjusted_unit_price(price_commit.base_price, asset_profile.div);
}
export function get_adjusted_liquid_price(proto_profile, liquid_price) {
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    const asset_profile = get_asset_profile(proto_profile, vault_terms.unit_asset_id);
    return get_adjusted_unit_price(liquid_price, asset_profile.div);
}
export function get_price_bucket_rate(price_quote, collateral_ratio) {
    validate_price_quote(price_quote);
    const { rate_min, rate_max, step_size } = price_quote;
    const decimal_count = get_decimal_count(step_size);
    const contract_rate = floor_to_precision(collateral_ratio, decimal_count);
    const clamped_rate = Math.min(Math.max(contract_rate, rate_min), rate_max);
    const step_count = count_steps_scaled(clamped_rate, rate_min, step_size);
    return get_bucket_rate(rate_min, step_size, step_count);
}
export function is_ratio_clamped(price_quote, collateral_ratio) {
    validate_price_quote(price_quote);
    const { rate_min, rate_max, step_size } = price_quote;
    const contract_rate = floor_to_precision(collateral_ratio, get_decimal_count(step_size));
    return contract_rate < rate_min || contract_rate > rate_max;
}
export function get_price_commit_hashes(proto_profile, action_quote, price_quotes) {
    const { vault_balance, unit_balance } = action_quote;
    const base_quote = select_base_price_quote(price_quotes);
    Assert.exists(base_quote, 'no price quote found');
    const unit_price = get_adjusted_quote_price(proto_profile, base_quote);
    const collateral_ratio = calc_collateral_ratio(vault_balance, unit_balance, unit_price);
    const hashes = [];
    for (const price_quote of price_quotes) {
        const bucket_rate = get_price_bucket_rate(price_quote, collateral_ratio);
        const thold_price = get_threshold_price(price_quote, bucket_rate);
        const commit_hash = get_price_contract_commit_hash(price_quote, thold_price);
        hashes.push(commit_hash);
    }
    return hashes;
}
export function get_vault_guardian_count(action_config) {
    const { guard_members, vault_profile } = action_config;
    if (guard_members)
        return guard_members.length;
    if (vault_profile)
        return vault_profile.guard_members.length;
    throw new Error('guard membership missing from action config');
}
export function get_price_oracle_count(action_config) {
    const { price_quotes, vault_profile } = action_config;
    if (vault_profile) {
        const profile_oracle_count = vault_profile.price_commits?.length ?? 0;
        if (profile_oracle_count > 0)
            return profile_oracle_count;
    }
    if (price_quotes)
        return price_quotes.length;
    return 0;
}
export function has_asset_change(action_config) {
    const { repay_amount, asset_inputs, proto_profile } = action_config;
    if (!repay_amount || !asset_inputs)
        return false;
    const unit_asset_id = get_unit_asset_id(proto_profile);
    const asset_pool = get_asset_pool(unit_asset_id, asset_inputs);
    return (asset_pool.pool_active > repay_amount);
}
export function get_vault_action_postage(action_config) {
    const { unit_postage = DEFAULT_POSTAGE, vault_action } = action_config;
    switch (vault_action) {
        case 'open':
            return unit_postage;
        case 'borrow':
            return unit_postage;
        case 'repay':
            return has_asset_change(action_config) ? unit_postage : 0;
        case 'close':
        case 'deposit':
        case 'withdraw':
        case 'repo':
        case 'trim':
        case 'liquidate':
            return 0;
        default:
            throw new Error(`get_vault_action_postage: unhandled vault action: ${vault_action}`);
    }
}
export function get_max_sats_at_ratio(target_ratio, unit_balance, unit_price) {
    if (unit_balance === 0)
        return Number.MAX_SAFE_INTEGER;
    const max_sats = (target_ratio * unit_balance * Number(SATS_PER_BTC)) / unit_price;
    return Math.floor(max_sats);
}
export function get_collateral_overflow(vault_balance, unit_balance, price_quotes, proto_profile) {
    if (unit_balance === 0)
        return 0;
    if (price_quotes.length === 0)
        return 0;
    const base_quote = select_base_price_quote(price_quotes);
    if (!base_quote)
        return 0;
    const unit_price = get_adjusted_quote_price(proto_profile, base_quote);
    const max_sats = get_max_sats_at_ratio(base_quote.rate_max, unit_balance, unit_price);
    const overflow = vault_balance - max_sats;
    return Math.max(overflow, 0);
}
