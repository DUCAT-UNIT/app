import { z } from 'zod';
import { asset, base, chain, liquid, price, vault } from '@ducat-unit/core/schema';
import * as action from '../../../schema/vault.js';
export const base_config = z.object({
    ...action.config.shape,
    client_pubkey: base.hex32.optional(),
    guard_pubkey: base.hex32,
    change_address: base.bech32.optional(),
    issue_account: asset.account.optional(),
    price_contracts: price.contract.array().optional(),
    unit_address: base.bech32.optional(),
});
export const open_config = base_config.extend({
    borrow_amount: base.uint,
    client_pubkey: base.hex32,
    deposit_amount: base.uint,
    issue_account: asset.account,
    unit_address: base.bech32,
    unit_postage: base.uint,
    vault_action: z.literal('open'),
    vault_config: vault.config,
});
export const borrow_config = base_config.extend({
    borrow_amount: base.uint,
    issue_account: asset.account,
    unit_address: base.bech32,
    unit_postage: base.uint,
    vault_action: z.literal('borrow'),
    vault_profile: vault.profile,
});
export const repay_config = base_config.extend({
    asset_inputs: asset.account.array(),
    repay_amount: base.uint,
    unit_address: base.bech32.optional(),
    vault_action: z.literal('repay'),
    vault_profile: vault.profile,
});
export const deposit_config = base_config.extend({
    deposit_amount: base.uint,
    vault_action: z.literal('deposit'),
    vault_profile: vault.profile,
});
export const withdraw_config = base_config.extend({
    change_address: chain.address,
    vault_action: z.literal('withdraw'),
    vault_profile: vault.profile,
    withdraw_amount: base.uint,
});
export const close_config = base_config.extend({
    change_address: chain.address,
    vault_action: z.literal('close'),
    vault_profile: vault.profile,
});
export const repo_config = base_config.extend({
    liquid_profiles: liquid.vault.array(),
    price_contracts: price.contract.array(),
    vault_action: z.literal('repo'),
    vault_profile: vault.profile,
});
export const trim_config = base_config.extend({
    liquid_profiles: liquid.vault.array(),
    price_contracts: price.contract.array(),
    vault_action: z.literal('trim'),
    vault_profile: vault.profile,
});
