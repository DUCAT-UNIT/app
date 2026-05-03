import { Assert, round_to_fixed } from '../../../../util/index.js';
import { calc_subsidy_multiplier, calc_subsidy_rate, calc_reserve_sats, get_adjusted_unit_price, calc_subsidy_sats, } from './calc.js';
import { calc_collateral_ratio, calc_portion, } from '../../../../lib/calc.js';
import { parse_liquidation_terms, parse_vault_terms } from '../util.js';
import { verify_return_balances, verify_repo_portion } from './verify.js';
import CONST from '../../../../const.js';
const FLOAT_PREC = CONST.FLOAT_PREC;
export function get_liquid_profile(proto_profile, liquid_vault, thold_key, coin_price, repo_portion = 1.0) {
    Assert.ok(liquid_vault.rdata.unit_balance > 0, 'vault unit balance must be greater than zero');
    Assert.ok(liquid_vault.utxo.value > CONST.MIN_VAULT_BAL, 'vault sats balance must be greater than minimum vault balance');
    verify_repo_portion(repo_portion);
    const sats_total = liquid_vault.utxo.value;
    const unit_total = liquid_vault.rdata.unit_balance;
    const unit_divisor = proto_profile.runes.unit.divisor;
    const quote_config = { coin_price, repo_portion, sats_total, unit_total, unit_divisor };
    const liquid_quote = get_liquidation_quote(proto_profile.terms, quote_config);
    const return_sats = sats_total - liquid_quote.sats_balance;
    const return_unit = unit_total - liquid_quote.unit_balance;
    verify_return_balances(repo_portion, return_sats, return_unit);
    return {
        ...liquid_vault,
        liquid_quote,
        repo_portion,
        return_sats,
        return_unit,
        thold_key
    };
}
export function get_liquidation_quote(proto_terms, liquid_config) {
    const { coin_price, repo_portion = 1.0, unit_divisor = 0 } = liquid_config;
    const sats_available = liquid_config.sats_total - CONST.MIN_VAULT_BAL;
    const sats_balance = calc_portion(sats_available, repo_portion);
    const unit_balance = calc_portion(liquid_config.unit_total, repo_portion);
    const liquid_terms = parse_liquidation_terms(proto_terms);
    const vault_terms = parse_vault_terms(proto_terms);
    const min_collateral = vault_terms.collateral_min;
    const tax_rate = liquid_terms.liquid_tax_rate;
    const adj_price = get_adjusted_unit_price(coin_price, unit_divisor);
    const vault_cr = calc_collateral_ratio(sats_balance, unit_balance, adj_price);
    const taxable_sats = Math.round(sats_balance * tax_rate);
    const subsidy_multi = calc_subsidy_multiplier(liquid_terms, vault_cr);
    const subsidy_rate = calc_subsidy_rate(liquid_terms, subsidy_multi);
    const subsidy_sats = calc_subsidy_sats(sats_balance, subsidy_rate, taxable_sats);
    const tax_remaining = taxable_sats - subsidy_sats;
    const reserve_sats = calc_reserve_sats(liquid_terms, tax_remaining);
    const reward_sats = sats_balance - reserve_sats;
    const reward_cr = calc_collateral_ratio(reward_sats, unit_balance, adj_price);
    const deficit_cr = min_collateral - reward_cr;
    const deficit_sats = Math.ceil((deficit_cr / reward_cr) * reward_sats);
    const liquid_nav = round_to_fixed(reward_cr - 1, FLOAT_PREC);
    const profit_margin = round_to_fixed(liquid_nav / deficit_cr, FLOAT_PREC);
    return {
        coin_price,
        vault_cr,
        deficit_cr,
        deficit_sats,
        liquid_nav,
        profit_margin,
        reserve_sats,
        reward_cr,
        reward_sats,
        sats_balance,
        subsidy_multi,
        subsidy_rate,
        subsidy_sats,
        taxable_sats,
        unit_balance,
        unit_divisor
    };
}
