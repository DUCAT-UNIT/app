import { z } from 'zod';
import base from '../../../schema/base.js';
const { hash64, hex, num, str } = base;
const actions = z.enum(['open', 'borrow', 'repay', 'deposit', 'withdraw', 'repo', 'liquidate']);
const flags = z.enum(['o', 'b', 'r', 'd', 'w', 'x', 'l']);
const base_return = z.object({
    unit_balance: base.num,
    unit_price: base.num,
    unit_stamp: base.num,
    vault_action: flags
});
const locked_return_data = base_return.extend({
    is_locked: z.literal(true),
    thold_hash: base.hash20,
    thold_price: base.num
});
const cleared_return_data = base_return.extend({
    is_locked: z.literal(false)
});
const return_data = z.discriminatedUnion('is_locked', [locked_return_data, cleared_return_data]);
const token_data = z.object({
    rev: num,
    tag: str,
    ver: num
});
const open_witness = z.tuple([hash64, hex, hex]);
const update_witness = z.tuple([hash64, hash64, hex, hex]);
export default {
    actions,
    flags,
    open_witness,
    return_data,
    token_data,
    update_witness
};
