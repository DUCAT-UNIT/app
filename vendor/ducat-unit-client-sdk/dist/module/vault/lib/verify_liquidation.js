import { Assert } from '@vbyte/util';
import { convert_unit_to_sats, get_vault_profile_ratio, verify_vault_liquidate } from '@ducat-unit/core/lib';
import { get_adjusted_liquid_price } from '../../../lib/vault/util.js';
import { verify_collateral_ratio } from './verify.js';
export function verify_liquidator_vault_transition(vault_ctx) {
    const { liquid_profiles, vault_profile: prev_profile, unit_balance } = vault_ctx;
    Assert.ok(liquid_profiles && liquid_profiles.length > 0, 'repo/trim requires at least one liquid profile');
    Assert.exists(prev_profile, 'repo/trim requires liquidator to have an existing vault');
    if (unit_balance > 0) {
        verify_collateral_ratio(vault_ctx);
    }
}
export function verify_liquid_vaults_eligible(liquid_profiles) {
    for (const profile of liquid_profiles) {
        Assert.ok(profile.unit_balance > 0, `liquidated vault has no debt: unit_balance=${profile.unit_balance}`);
        Assert.exists(profile.thold_price, 'liquidated vault missing threshold price');
        Assert.exists(profile.liquid_price, 'liquidated vault missing liquidation price');
        Assert.ok(profile.liquid_price <= profile.thold_price, `vault not eligible for liquidation: price ${profile.liquid_price} > threshold ${profile.thold_price}`);
    }
}
export function verify_liquid_vault_transitions(vault_ctx) {
    const { liquid_profiles, proto_profile, vault_action, vault_terms } = vault_ctx;
    const vault_value_min = vault_terms.vault_value_min;
    for (const prev_profile of liquid_profiles ?? []) {
        Assert.exists(prev_profile.vault_value, 'liquidated vault missing vault value');
        Assert.ok(prev_profile.vault_balance === prev_profile.vault_value - vault_value_min, `liquidated vault_balance invariant violated: ${prev_profile.vault_balance} !== ` +
            `${prev_profile.vault_value} - ${vault_value_min}`);
        const new_vault_balance = get_new_liquidated_vault_balance(prev_profile, vault_action);
        const new_unit_balance = get_new_liquidated_unit_balance(prev_profile, vault_action);
        const new_profile = {
            ...prev_profile,
            vault_action: 'liquidate',
            vault_balance: new_vault_balance,
            unit_balance: new_unit_balance,
            vault_ratio: null,
            vault_value: new_vault_balance + vault_value_min,
            price_commits: vault_action === 'trim' ? prev_profile.price_commits : [],
            price_stamp: vault_action === 'trim' ? prev_profile.price_stamp : null,
            unit_price: vault_action === 'trim' ? prev_profile.unit_price : null,
            thold_price: vault_action === 'trim' ? prev_profile.thold_price : null
        };
        new_profile.vault_ratio = get_vault_profile_ratio(proto_profile, new_profile);
        verify_vault_liquidate(proto_profile, new_profile, prev_profile);
    }
}
export function verify_liquidation_amounts(vault_ctx) {
    const { liquid_profiles, proto_profile, vault_action } = vault_ctx;
    const reserve_tolerance_sats = 1;
    for (const profile of liquid_profiles ?? []) {
        Assert.ok(profile.reward_sats === profile.claimed_sats - profile.reserve_sats, `liquidation reward mismatch: ${profile.reward_sats} !== ${profile.claimed_sats} - ${profile.reserve_sats}`);
        Assert.exists(profile.vault_value, 'liquidated vault missing vault value');
        Assert.ok(profile.claimed_sats <= profile.vault_value, `claimed sats exceeds vault value: ${profile.claimed_sats} > ${profile.vault_value}`);
        if (vault_action === 'repo') {
            Assert.ok(profile.claimed_unit === profile.unit_balance, `repo should claim all debt: ${profile.claimed_unit} !== ${profile.unit_balance}`);
        }
        if (vault_action === 'trim') {
            Assert.ok(profile.claimed_unit <= profile.unit_balance, `trim cannot claim more than debt: ${profile.claimed_unit} > ${profile.unit_balance}`);
        }
        Assert.exists(profile.liquid_price, 'liquidated vault missing liquidation price for reserve validation');
        const adjusted_unit_price = get_adjusted_liquid_price(proto_profile, profile.liquid_price);
        const debt_value_sats = convert_unit_to_sats(profile.claimed_unit, adjusted_unit_price);
        const premium_sats = Math.max(profile.claimed_sats - debt_value_sats, 0);
        Assert.ok(profile.reserve_sats <= (premium_sats + reserve_tolerance_sats), `reserve exceeds premium: reserve=${profile.reserve_sats}, premium=${premium_sats}, claimed_sats=${profile.claimed_sats}, debt_sats=${debt_value_sats}, liquid_price=${profile.liquid_price}`);
    }
}
function get_new_liquidated_vault_balance(liquid_profile, vault_action) {
    if (vault_action === 'repo') {
        return 0;
    }
    const new_vault_balance = liquid_profile.vault_balance - liquid_profile.claimed_sats;
    if (new_vault_balance < 0) {
        throw new Error(`new vault balance is negative: ${new_vault_balance} < 0`);
    }
    return new_vault_balance;
}
function get_new_liquidated_unit_balance(liquid_profile, vault_action) {
    if (vault_action === 'repo') {
        return 0;
    }
    const new_unit_balance = liquid_profile.unit_balance - liquid_profile.claimed_unit;
    if (new_unit_balance < 0) {
        throw new Error(`new unit balance is negative: ${new_unit_balance} < 0`);
    }
    return new_unit_balance;
}
