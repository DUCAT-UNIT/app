import { get_vault_terms } from '@ducat-unit/core/lib';
import { VaultError } from '../../lib/errors/index.js';
export function tabulate_vault_balance(vault_config, txfee_balance) {
    const { deposit_amount = 0, liquid_profiles = [], proto_profile, vault_action, vault_profile, withdraw_amount = 0 } = vault_config;
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    const prev_sats_balance = vault_profile?.vault_balance ?? 0;
    const reserve_sats = liquid_profiles.reduce((acc, profile) => acc + profile.reserve_sats, 0);
    const reward_sats = liquid_profiles.reduce((acc, profile) => acc + profile.reward_sats, 0);
    const payable_reserve = (reserve_sats >= vault_terms.reserve_sats_min);
    const reward_balance = (payable_reserve) ? reward_sats : reward_sats + reserve_sats;
    let vault_balance = 0;
    switch (vault_action) {
        case 'open':
            vault_balance = deposit_amount - vault_terms.vault_value_min;
            break;
        case 'borrow':
            vault_balance = prev_sats_balance + deposit_amount;
            break;
        case 'repay':
            vault_balance = prev_sats_balance + deposit_amount;
            break;
        case 'deposit':
            vault_balance = prev_sats_balance + deposit_amount;
            break;
        case 'withdraw':
            vault_balance = prev_sats_balance - withdraw_amount;
            break;
        case 'close':
            vault_balance = prev_sats_balance + vault_terms.vault_value_min;
            break;
        case 'repo':
        case 'trim':
            vault_balance = prev_sats_balance + reward_balance + deposit_amount;
            break;
        default:
            throw new VaultError(`invalid vault action: ${vault_action}`);
    }
    vault_balance = vault_balance - txfee_balance;
    return vault_balance;
}
export function tabulate_reserve_balance(vault_config) {
    const { liquid_profiles, proto_profile } = vault_config;
    const vault_terms = get_vault_terms(proto_profile.proto_terms);
    const reserve_sats = liquid_profiles?.reduce((acc, profile) => acc + profile.reserve_sats, 0) ?? 0;
    const payable_reserve = (reserve_sats >= vault_terms.reserve_sats_min);
    return (payable_reserve) ? reserve_sats : 0;
}
export function tabulate_unit_balance(vault_config) {
    const { borrow_amount = 0, liquid_profiles = [], repay_amount = 0, vault_action, vault_profile } = vault_config;
    const prev_unit_balance = vault_profile?.unit_balance ?? 0;
    const claimed_unit = liquid_profiles.reduce((acc, profile) => acc + profile.claimed_unit, 0);
    let unit_balance = 0;
    switch (vault_action) {
        case 'open':
            unit_balance = borrow_amount;
            break;
        case 'borrow':
            unit_balance = prev_unit_balance + borrow_amount;
            break;
        case 'repay':
            unit_balance = prev_unit_balance - repay_amount;
            break;
        case 'deposit':
        case 'withdraw':
            unit_balance = prev_unit_balance;
            break;
        case 'close':
            unit_balance = 0;
            break;
        case 'repo':
        case 'trim':
            unit_balance = prev_unit_balance + claimed_unit;
            break;
        default:
            throw new VaultError(`invalid vault action: ${vault_action}`);
    }
    return unit_balance;
}
