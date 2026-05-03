import { z } from 'zod';
import ord from '../../../schema/ord.js';
import tx from '../../../schema/tx.js';
import vault from '../../../module/vault/schema/index.js';
const base_req = z.object({
    contract_id: ord.inscribe_id,
    network: tx.network
});
const open_req = vault.req.open_req.merge(base_req);
const borrow_req = vault.req.borrow_req.merge(base_req);
const repay_req = vault.req.repay_req.merge(base_req);
const repo_req = vault.req.repo_req.merge(base_req);
const deposit_req = vault.req.deposit_req.merge(base_req);
const withdraw_req = vault.req.withdraw_req.merge(base_req);
export default {
    open_req,
    borrow_req,
    repay_req,
    repo_req,
    deposit_req,
    withdraw_req
};
