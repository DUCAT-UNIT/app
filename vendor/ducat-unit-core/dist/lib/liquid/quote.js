import { Assert } from '@vbyte/util/assert';
import { get_vault_terms } from '../proto/terms.js';
import { get_asset_profile } from '../asset.js';
import { calc_collateral_ratio, calc_portion_ceil, calc_ratio, convert_unit_to_sats, get_adjusted_unit_price, trim_float } from '../../lib/calc.js';
import { calc_liquid_reserve_rate, calc_liquid_reserve_sats, calc_liquid_subsidy_multiplier, calc_liquid_subsidy_rate } from './calc.js';
export function get_liquidation_quote(proto_profile, claimed_sats, claimed_unit, unit_price) {
    Assert.ok(Number.isFinite(claimed_sats) && claimed_sats > 0, `claimed sats must be a finite positive number: ${claimed_sats}`);
    Assert.ok(Number.isFinite(claimed_unit) && claimed_unit > 0, `claimed unit must be a finite positive number: ${claimed_unit}`);
    Assert.ok(Number.isFinite(unit_price) && unit_price > 0, `unit price must be a finite positive number: ${unit_price}`);
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    const unit_asset = get_asset_profile(proto_profile, vault_terms.unit_asset_id);
    const adj_unit_price = get_adjusted_unit_price(unit_price, unit_asset.div);
    const min_coll_ratio = vault_terms.vault_ratio_min;
    const liquidation_tax = vault_terms.liquidation_tax;
    const collateral_ratio = calc_collateral_ratio(claimed_sats, claimed_unit, adj_unit_price);
    const subsidy_multi = calc_liquid_subsidy_multiplier(vault_terms, collateral_ratio);
    const subsidy_rate = calc_liquid_subsidy_rate(vault_terms, subsidy_multi);
    const reserve_rate = calc_liquid_reserve_rate(liquidation_tax, subsidy_rate);
    const reserve_sats = calc_liquid_reserve_sats(vault_terms, reserve_rate, claimed_sats);
    const reward_sats = claimed_sats - reserve_sats;
    Assert.ok(reward_sats >= 0, `reward sats cannot be negative: ${reward_sats}`);
    const reward_ratio = calc_collateral_ratio(reward_sats, claimed_unit, adj_unit_price);
    Assert.ok(reward_ratio >= 0, `reward ratio cannot be negative: ${reward_ratio}`);
    const deficit_ratio = Math.max(0, trim_float(min_coll_ratio - reward_ratio));
    const deficit_unit = Math.ceil(deficit_ratio * claimed_unit);
    const deficit_sats = (deficit_unit > 0) ? convert_unit_to_sats(deficit_unit, adj_unit_price) : 0;
    return {
        claimed_sats,
        claimed_unit,
        deficit_ratio,
        deficit_sats,
        reserve_sats,
        reserve_rate,
        reward_ratio,
        reward_sats,
        subsidy_multi,
        subsidy_rate
    };
}
export function get_partial_liquidation_quote(proto_profile, liquid_quote, recap_amount, unit_price) {
    if (liquid_quote.deficit_sats === 0)
        return liquid_quote;
    Assert.ok(recap_amount > 0, `recap amount must be greater than zero: ${recap_amount}`);
    const recap_percent = calc_ratio(recap_amount, liquid_quote.deficit_sats);
    const claimed_sats = calc_portion_ceil(liquid_quote.claimed_sats, recap_percent);
    const claimed_unit = calc_portion_ceil(liquid_quote.claimed_unit, recap_percent);
    return get_liquidation_quote(proto_profile, claimed_sats, claimed_unit, unit_price);
}
