import { z } from 'zod';
import base from '../../../schema/base.js';
import quote from '../../../module/oracle/schema/quote.js';
import input from './input.js';
import vconf from './config.js';
import vdata from './vdata.js';
const base_ctx = z.object({
    sats_address: base.str,
    tx_feerate: base.num,
    vault_action: vdata.flags,
    vault_quote: quote.active_quote,
    vault_pubkey: base.hash32
});
const open_ctx = base_ctx
    .merge(vconf.open_config)
    .merge(input.acct_input)
    .merge(input.proto_input);
const borrow_ctx = base_ctx
    .merge(vconf.borrow_config)
    .merge(input.acct_input)
    .merge(input.proto_input)
    .merge(input.vault_input);
const repay_ctx = base_ctx
    .merge(vconf.repay_config)
    .merge(input.acct_input)
    .merge(input.proto_input)
    .merge(input.vault_input);
const repo_ctx = base_ctx
    .merge(vconf.repo_config)
    .merge(input.proto_input)
    .merge(input.vault_input);
const deposit_ctx = base_ctx
    .merge(vconf.deposit_config)
    .merge(input.proto_input)
    .merge(input.vault_input);
const withdraw_ctx = base_ctx
    .merge(vconf.withdraw_config)
    .merge(input.proto_input)
    .merge(input.vault_input);
export default {
    open_ctx,
    borrow_ctx,
    repay_ctx,
    repo_ctx,
    deposit_ctx,
    withdraw_ctx
};
