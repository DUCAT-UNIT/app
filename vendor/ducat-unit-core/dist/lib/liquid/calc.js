import { calc_portion, calc_ratio, trim_float } from '../calc.js';
export function get_liquid_sats_portion(repo_amount, sats_balance, unit_balance) {
    const repo_ratio = calc_ratio(repo_amount, unit_balance);
    return calc_portion(sats_balance, repo_ratio);
}
export function calc_liquid_tax_rate(vault_terms) {
    const { liquidation_tax, liquidation_thold } = vault_terms;
    return trim_float(liquidation_thold * liquidation_tax);
}
export function calc_liquid_rev_rate(vault_terms, coll_ratio) {
    const tax_rate = vault_terms.liquidation_tax;
    return trim_float(coll_ratio * tax_rate);
}
export function calc_liquid_subsidy_multiplier(vault_terms, coll_ratio) {
    const { subsidy_thold } = vault_terms;
    if (coll_ratio >= subsidy_thold)
        return 0;
    return Math.round((subsidy_thold - coll_ratio) * 100);
}
export function calc_liquid_subsidy_rate(vault_terms, subsidy_multi) {
    const subsidy_increment = vault_terms.subsidy_increment;
    return trim_float(subsidy_increment * subsidy_multi);
}
export function calc_liquid_reserve_rate(tax_rate, subsidy_rate) {
    const sub_rate = Math.min(tax_rate, subsidy_rate);
    return trim_float(tax_rate - sub_rate);
}
export function calc_liquid_reserve_sats(vault_terms, reserve_rate, sats_balance) {
    const min_sats_amt = vault_terms.reserve_sats_min;
    const reserved_sats = calc_portion(sats_balance, reserve_rate);
    return (reserved_sats >= min_sats_amt) ? reserved_sats : 0;
}
