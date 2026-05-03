import { z } from 'zod';
import base from '../../../schema/base.js';
const open_config = z.object({
    borrow_amount: base.num,
    deposit_amount: base.num,
    tx_feerate: base.num,
    vault_label: base.str,
});
const borrow_config = z.object({
    borrow_amount: base.num,
    deposit_amount: base.num,
    tx_feerate: base.num
});
const repay_config = z.object({
    deposit_amount: base.num,
    repay_amount: base.num,
    tx_feerate: base.num
});
const repo_config = z.object({
    deposit_amount: base.num,
    tx_feerate: base.num
});
const deposit_config = z.object({
    deposit_amount: base.num,
    tx_feerate: base.num
});
const withdraw_config = z.object({
    change_amount: base.num,
    tx_feerate: base.num
});
export default {
    open_config,
    borrow_config,
    repay_config,
    repo_config,
    deposit_config,
    withdraw_config
};
