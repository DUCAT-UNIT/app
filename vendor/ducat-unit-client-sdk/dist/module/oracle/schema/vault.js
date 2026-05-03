import { z } from 'zod';
import base from '../../../schema/base.js';
import ord from '../../../schema/ord.js';
import tx from '../../../schema/tx.js';
import vdata from '../../../module/vault/schema/vdata.js';
const prevout = z.object({
    rdata: vdata.return_data,
    utxo: tx.utxo
});
const profile = prevout.extend({
    acct_id: ord.inscribe_id,
    guard_pk: base.hash32,
    master_id: ord.inscribe_id,
    vault_pk: base.hash32
});
const record = z.object({
    gpk: base.hash32,
    mid: ord.inscribe_id,
    vpk: base.hash32,
    ver: base.num
});
const token = z.object({
    data: vdata.token_data,
    ptr: base.num,
    utxo: tx.utxo,
    vid: ord.inscribe_id
});
export default { prevout, profile, record, token };
