import { z } from 'zod';
import base from '../../../schema/base.js';
import vdata from './vdata.js';
const base_config = z.object({
    sats_address: base.str,
    tx_feerate: base.num
});
const open_config = base_config.extend({
    borrow_amount: base.num,
    deposit_amount: base.num,
    token_address: base.bech32,
    token_data: vdata.token_data,
    token_postage: base.num,
    unit_address: base.bech32,
    unit_postage: base.num,
    vault_pubkey: base.hash32,
});
const borrow_config = base_config.extend({
    borrow_amount: base.num,
    deposit_amount: base.num,
    unit_address: base.bech32,
    unit_postage: base.num
});
const repay_config = base_config.extend({
    deposit_amount: base.num,
    repay_amount: base.num,
    unit_address: base.bech32,
    unit_postage: base.num
});
const repo_config = base_config.extend({
    deposit_amount: base.num,
});
const deposit_config = base_config.extend({
    deposit_amount: base.num
});
const withdraw_config = base_config.extend({
    change_amount: base.num
});
export default {
    borrow_config,
    deposit_config,
    open_config,
    repay_config,
    repo_config,
    withdraw_config
};
