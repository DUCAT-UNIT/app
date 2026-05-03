import { z } from 'zod';
import base from './base.js';
const liquid_terms = z.object({
    liquidation_thold: base.num,
    reserve_pubkey: base.hash32,
    reserve_sats_min: base.num,
    liquid_tax_rate: base.num,
    subsidy_inc_rate: base.num,
    subsidy_inc_thold: base.num
});
const vault_terms = z.object({
    collateral_min: base.num,
    internal_key: base.hash32,
    sats_balance_min: base.num,
    unit_balance_min: base.num
});
const vault_action = z.union([
    z.literal('open'),
    z.literal('borrow'),
    z.literal('repay'),
    z.literal('deposit'),
    z.literal('withdraw'),
    z.literal('repo'),
    z.literal('liquidate'),
]);
const vault_flag = z.union([
    z.literal('o'),
    z.literal('b'),
    z.literal('r'),
    z.literal('d'),
    z.literal('w'),
    z.literal('x'),
    z.literal('l'),
]);
export default {
    liquid_terms,
    vault_terms,
    vault_action,
    vault_flag
};
