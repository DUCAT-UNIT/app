import { Assert, round_to_fixed } from '../../../../util/index.js';
import { calc_collateral_ratio, calc_portion } from '../../../../lib/calc.js';
import CONST from '../../../../const.js';
const FLOAT_PREC = CONST.FLOAT_PREC;
export function get_adjusted_unit_price(coin_price, divisor = 0) {
    if (divisor === 0)
        return coin_price;
    const adjusted_price = coin_price * (10 ** divisor);
    return round_to_fixed(adjusted_price, divisor);
}
export function calc_sats_balance(sats_balance, repo_portion = 1.0) {
    return calc_portion(sats_balance, repo_portion);
}
export function calc_unit_balance(unit_balance, repo_portion = 1.0) {
    return calc_portion(unit_balance, repo_portion);
}
export function calc_liquid_tax_rate(liquid_terms) {
    const { liquid_tax_rate, liquidation_thold } = liquid_terms;
    return round_to_fixed(liquidation_thold * liquid_tax_rate, FLOAT_PREC);
}
export function calc_subsidy_rate(liquid_terms, subsidy_multi) {
    const { liquid_tax_rate, subsidy_inc_rate } = liquid_terms;
    const subsidy_rate = round_to_fixed(subsidy_inc_rate * subsidy_multi, FLOAT_PREC);
    return Math.min(subsidy_rate, liquid_tax_rate);
}
export function calc_subsidy_multiplier(liquid_terms, coll_ratio) {
    const { subsidy_inc_thold } = liquid_terms;
    Assert.ok(subsidy_inc_thold > 1, 'subsidy increment threshold must be greater than 100%');
    const max_steps = (subsidy_inc_thold - 1) * 100;
    if (coll_ratio >= subsidy_inc_thold)
        return 0;
    let multi = Math.floor((subsidy_inc_thold - coll_ratio) * 100);
    multi = Math.min(multi, max_steps);
    multi = Math.max(multi, 0);
    return multi;
}
export function calc_subsidy_sats(sats_balance, subsidy_rate, taxable_sats) {
    const subsidy_sats = Math.floor(sats_balance * subsidy_rate);
    return Math.min(subsidy_sats, taxable_sats);
}
export function calc_reserve_sats(liquid_terms, tax_remaining) {
    const min_sats_amt = liquid_terms.reserve_sats_min;
    return (tax_remaining >= min_sats_amt) ? tax_remaining : 0;
}
export function calc_collateral_deficit(vault_terms, coin_price, sats_amount, unit_balance) {
    const min_ratio = vault_terms.collateral_min;
    const curr_ratio = calc_collateral_ratio(sats_amount, unit_balance, coin_price);
    Assert.ok(min_ratio >= curr_ratio, 'current collateral ratio is greater than minimum collateral ratio');
    return min_ratio - curr_ratio;
}
