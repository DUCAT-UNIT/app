import { z } from 'zod';
import { asset, base, coin, liquid, price, proto, vault } from '@ducat-unit/core/schema';
export const config = z.object({
    asset_inputs: asset.account.array().optional(),
    borrow_amount: base.uint.optional(),
    deposit_amount: base.uint.optional(),
    fund_inputs: coin.utxo.array().optional(),
    guard_members: base.hex32.array().optional(),
    liquid_profiles: liquid.vault.array().optional(),
    price_quotes: price.quote.array().optional(),
    proto_profile: proto.profile,
    repay_amount: base.uint.optional(),
    txfee_rate: base.uint,
    txfee_reserve: base.uint.optional(),
    unit_postage: base.uint.optional(),
    vault_action: vault.action,
    vault_config: vault.config.optional(),
    vault_profile: vault.profile.optional(),
    withdraw_amount: base.uint.optional()
});
export const estimate = z.object({
    action_effective_vsize: base.uint,
    action_fees: base.uint,
    action_postage: base.uint,
    action_sigops_vsize: base.uint,
    action_value: base.uint,
    action_vsize: base.uint,
    guardian_count: base.uint,
    liquid_count: base.uint,
    oracle_count: base.uint,
    reserve_balance: base.uint,
    unit_balance: base.uint,
});
export const funds = z.object({
    coin_count: base.num.nonnegative().int(),
    coin_fees: base.num.nonnegative(),
    coin_size: base.num.nonnegative().int(),
    coin_value: base.num.nonnegative()
});
export const quote = z.object({
    ...config.shape,
    ...estimate.shape,
    ...funds.shape,
    asset_inputs: asset.account.array(),
    borrow_amount: base.uint,
    change_value: base.uint,
    deposit_amount: base.uint,
    fund_balance: base.uint,
    fund_inputs: coin.utxo.array(),
    overflow_value: base.uint,
    price_quotes: price.quote.array(),
    repay_amount: base.uint,
    reserve_balance: base.uint,
    total_cost: base.uint,
    txfee_balance: base.uint,
    txfee_reserve: base.uint,
    unit_balance: base.uint,
    unit_postage: base.uint,
    vault_balance: base.uint,
    vault_ratio: base.uint.nullable(),
    vault_value: base.uint,
    withdraw_amount: base.uint
});
