import { Assert } from '@vbyte/util';
import { DUST_LIMIT } from '../../const.js';
import { VaultError } from '../../lib/errors/index.js';
import { get_vault_terms } from '@ducat-unit/core/lib';
import * as SCHEMA from '../../schema/index.js';
export const MAX_REASONABLE_FEE_RATE = 1000;
export function validate_action_config(vault_config) {
    const action = vault_config.vault_action;
    const schema = SCHEMA.vault.config;
    schema.parse(vault_config);
    assert_txfee_rate_reasonable(vault_config);
    switch (action) {
        case 'borrow':
            assert_vault_profile(vault_config);
            assert_postage(vault_config);
            assert_borrow_minimum(vault_config);
            assert_vault_state_for_action(vault_config);
            break;
        case 'open':
            assert_funds(vault_config);
            assert_postage(vault_config);
            assert_borrow_minimum(vault_config);
            assert_deposit_minimum(vault_config);
            break;
        case 'deposit':
            assert_vault_profile(vault_config);
            assert_funds(vault_config);
            break;
        case 'repay':
            assert_vault_profile(vault_config);
            assert_postage(vault_config);
            assert_vault_state_for_action(vault_config);
            assert_repay_within_balance(vault_config);
            break;
        case 'repo':
            assert_vault_profile(vault_config);
            assert_liquid_profiles(vault_config);
            break;
        case 'trim':
            assert_vault_profile(vault_config);
            assert_liquid_profiles(vault_config);
            assert_no_funds(vault_config);
            break;
        case 'withdraw':
            assert_vault_profile(vault_config);
            assert_no_funds(vault_config);
            assert_withdraw_within_balance(vault_config);
            break;
        case 'close':
            assert_vault_profile(vault_config);
            assert_no_funds(vault_config);
            assert_vault_state_for_action(vault_config);
            break;
        default:
            throw new VaultError(`unknown vault action: ${action}`);
    }
}
function assert_vault_profile(vault_config) {
    const { vault_profile } = vault_config;
    Assert.exists(vault_profile, 'vault profile is missing from vault context');
}
function assert_liquid_profiles(vault_config) {
    const { liquid_profiles } = vault_config;
    Assert.exists(liquid_profiles, 'liquid profiles are missing from vault context');
    Assert.ok(liquid_profiles.length > 0, 'liquid profiles are missing from vault context');
}
function assert_funds(vault_config) {
    const { vault_action, deposit_amount, txfee_reserve } = vault_config;
    Assert.ok(Boolean(deposit_amount && deposit_amount > 0), `${vault_action} action must have a positive deposit amount`);
    Assert.ok(Boolean(txfee_reserve && txfee_reserve > 0), `${vault_action} action must have txfee reserve greater than 0`);
}
function assert_no_funds(vault_config) {
    const { vault_action, deposit_amount, txfee_reserve } = vault_config;
    Assert.ok(!deposit_amount || deposit_amount === 0, `${vault_action} action must have no deposit amount`);
    Assert.ok(!txfee_reserve || txfee_reserve === 0, `${vault_action} action must have no txfee reserve`);
}
function assert_postage(vault_config) {
    const { vault_action, unit_postage } = vault_config;
    if (unit_postage) {
        Assert.ok(unit_postage >= DUST_LIMIT, `${vault_action} action must have unit postage at or above dust limit (${DUST_LIMIT})`);
    }
}
function assert_borrow_minimum(vault_config) {
    const { borrow_amount, proto_profile } = vault_config;
    if (!borrow_amount || borrow_amount === 0)
        return;
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    Assert.ok(borrow_amount >= vault_terms.unit_balance_min, `borrow amount ${borrow_amount} is below protocol minimum ${vault_terms.unit_balance_min}`);
}
function assert_deposit_minimum(vault_config) {
    const { deposit_amount, proto_profile } = vault_config;
    if (!deposit_amount)
        return;
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    Assert.ok(deposit_amount >= vault_terms.vault_value_min, `deposit amount ${deposit_amount} is below protocol minimum vault value ${vault_terms.vault_value_min}`);
}
function assert_withdraw_within_balance(vault_config) {
    const { vault_action, vault_profile, withdraw_amount } = vault_config;
    if (vault_action !== 'withdraw' || !vault_profile || !withdraw_amount)
        return;
    Assert.ok(withdraw_amount <= vault_profile.vault_balance, `withdraw amount ${withdraw_amount} exceeds vault balance ${vault_profile.vault_balance}`);
}
function assert_repay_within_balance(vault_config) {
    const { vault_action, vault_profile, repay_amount } = vault_config;
    if (vault_action !== 'repay' || !vault_profile || !repay_amount)
        return;
    Assert.ok(repay_amount <= vault_profile.unit_balance, `repay amount ${repay_amount} exceeds unit balance ${vault_profile.unit_balance}`);
}
function assert_vault_state_for_action(vault_config) {
    const { vault_action, vault_profile } = vault_config;
    if (!vault_profile)
        return;
    const is_encumbered = vault_profile.unit_balance > 0;
    switch (vault_action) {
        case 'repay':
            Assert.ok(is_encumbered, 'cannot repay: vault has no debt');
            break;
        case 'close':
            Assert.ok(!is_encumbered, 'cannot close: vault has debt');
            break;
        case 'borrow':
            break;
        case 'open':
        case 'deposit':
        case 'withdraw':
        case 'repo':
        case 'trim':
        case 'liquidate':
            break;
        default:
            throw new VaultError(`assert_vault_state_for_action: unhandled vault action: ${vault_action}`);
    }
    if (vault_profile.vault_action === 'close') {
        throw new VaultError(`cannot ${vault_action}: vault is already closed`);
    }
}
function assert_txfee_rate_reasonable(vault_config) {
    const { txfee_rate } = vault_config;
    Assert.ok(txfee_rate >= 0, 'txfee_rate cannot be negative');
    Assert.ok(txfee_rate <= MAX_REASONABLE_FEE_RATE, `txfee_rate ${txfee_rate} exceeds reasonable maximum ${MAX_REASONABLE_FEE_RATE}`);
}
