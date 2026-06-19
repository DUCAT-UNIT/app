import { Assert } from '@vbyte/util';
import { get_asset_account_utxo } from '@ducat-unit/core/lib';
import { get_vault_terms } from '@ducat-unit/core/lib';
import { DEFAULT_POSTAGE, DUST_LIMIT } from '../../const.js';
import * as SCHEMA from '../../schema/index.js';
import { create_vault_action_estimate, emit_debug, get_observe_context, get_coin_ctx, get_collateral_overflow, tabulate_vault_balance, with_observe_span } from '../../lib/index.js';
const DEFAULT_ACTION_CONFIG = {
    asset_inputs: [],
    borrow_amount: 0,
    deposit_amount: 0,
    fund_inputs: [],
    repay_amount: 0,
    txfee_reserve: 0,
    unit_postage: DEFAULT_POSTAGE,
    withdraw_amount: 0
};
export function create_vault_action_quote(vault_config) {
    const observe = get_observe_context(vault_config.observability, {
        module: 'vault.quote',
        vault_action: vault_config.vault_action
    });
    return with_observe_span(observe, `vault.${vault_config.vault_action}.quote`, { vault_action: vault_config.vault_action }, scope => {
        const parsed = parse_vault_action_config(vault_config);
        const config = { ...DEFAULT_ACTION_CONFIG, ...parsed };
        const { asset_inputs, deposit_amount, fund_inputs, price_quotes, proto_profile, txfee_rate, vault_action, vault_profile } = config;
        validate_coin_inputs(vault_action, fund_inputs);
        const estimate = create_vault_action_estimate(config);
        const action_cost = estimate.action_fees;
        const asset_coins = asset_inputs.map(input => get_asset_account_utxo(input));
        const coin_ctx = get_coin_ctx([...asset_coins, ...fund_inputs], txfee_rate);
        const { coin_value, coin_fees } = coin_ctx;
        const fund_balance = coin_value - (deposit_amount + estimate.action_postage);
        Assert.ok(fund_balance >= 0, `coin value does not cover deposit and postage: ${coin_value} < ${fund_balance}`);
        const total_cost = action_cost + coin_fees;
        const txfee_balance = Math.max(total_cost - fund_balance, 0);
        if ((vault_action === 'open' || vault_action === 'borrow' || vault_action === 'deposit') &&
            txfee_balance > 0) {
            throw new Error(`insufficient funding for transaction fees: add ${txfee_balance} sats of input ` +
                `to cover fees rather than reducing the vault deposit`);
        }
        let change_value = Math.max(fund_balance - total_cost, 0);
        let vault_balance = tabulate_vault_balance(config, txfee_balance);
        Assert.ok(vault_balance >= 0, `vault balance cannot be negative after fees: ${vault_balance}`);
        let overflow_value = 0;
        if (vault_action === 'close') {
            const prev_balance = vault_profile?.vault_balance ?? 0;
            const vault_terms = get_vault_terms(proto_profile.proto_terms);
            const spendable_balance = prev_balance + vault_terms.vault_value_min;
            vault_balance = 0;
            change_value = Math.max(spendable_balance - txfee_balance, 0);
        }
        if (vault_action === 'repay' && price_quotes && price_quotes.length > 0) {
            overflow_value = get_collateral_overflow(vault_balance, estimate.unit_balance, price_quotes, proto_profile);
            if (overflow_value > 0) {
                vault_balance -= overflow_value;
                change_value += overflow_value;
            }
        }
        if (change_value > 0) {
            Assert.ok(change_value >= DUST_LIMIT, `change value is below the dust limit: ${change_value}`);
        }
        if (txfee_balance > 0) {
            const is_valid_change = (vault_action === 'close')
                ? change_value >= 0
                : (change_value === 0 || change_value === overflow_value);
            Assert.ok(is_valid_change, `cannot have a txfee balance and change value: ${txfee_balance} / ${change_value}`);
        }
        const quote = {
            ...estimate,
            ...coin_ctx,
            vault_balance,
            change_value,
            fund_balance,
            overflow_value,
            total_cost,
            txfee_balance
        };
        emit_debug(scope, `vault.${vault_action}.quote.complete`, {
            change_value,
            coin_count: fund_inputs.length,
            overflow_value,
            total_cost,
            txfee_balance,
            vault_balance
        });
        return quote;
    });
}
function parse_vault_action_config(config) {
    const parsed = SCHEMA.vault.config.parse(config);
    for (const key of Object.keys(parsed)) {
        if (parsed[key] === undefined) {
            delete parsed[key];
        }
    }
    return parsed;
}
function validate_coin_inputs(vault_action, coin_inputs) {
    if (vault_action === 'withdraw') {
        Assert.ok(coin_inputs.length === 0, 'no coin inputs allowed for vault withdraw action');
    }
    else if (vault_action === 'close') {
        Assert.ok(coin_inputs.length === 0, 'no coin inputs allowed for vault close action');
    }
    else if (vault_action === 'trim') {
        Assert.ok(coin_inputs.length === 0, 'no coin inputs allowed for vault trim action');
    }
}
