import { z } from 'zod';
import base from '../../../schema/base.js';
import mint from '../../../module/oracle/schema/mint.js';
import tx from '../../../schema/tx.js';
import vault from '../../../module/vault/schema/index.js';
const acct_reserve_config = z.object({
    unit_amount: base.num,
    vault_action: vault.base.actions,
    vault_pubkey: base.hash32
});
const acct_reserve_req = acct_reserve_config.extend({
    network: tx.network
});
const acct_reserve_res = z.object({
    mint_account: mint.acct_profile,
    vault_action: vault.base.actions,
    vault_pubkey: base.hash32
});
const vault_update_res = z.object({
    vault_txid: base.hash32,
    vault_pubkey: base.hash32
});
const vault_open_res = vault_update_res.extend({
    issue_txid: base.hash32
});
const vault_borrow_res = vault_update_res.extend({
    issue_txid: base.hash32
});
const vault_repay_res = vault_update_res.extend({
    repay_txid: base.hash32
});
const vault_repo_res = vault_update_res.extend({
    liquid_txid: base.hash32
});
export default {
    acct_reserve_config,
    acct_reserve_req,
    acct_reserve_res,
    vault_open_res,
    vault_borrow_res,
    vault_repay_res,
    vault_repo_res,
    vault_update_res
};
