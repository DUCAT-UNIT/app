import { z } from 'zod';
import base from '../../../schema/base.js';
import ord from '../../../schema/ord.js';
const { bech32, hash32, num } = base;
const adr_ptr = z.tuple([bech32, num]);
const rec_ptr = z.tuple([bech32, ord.inscribe_id]);
const val_ptr = z.tuple([num, num]);
const group_contract = z.object({ adr: bech32 });
const point_contract = group_contract.extend({ ptr: val_ptr.array() });
const quorum_contract = group_contract.extend({
    pub: hash32,
    thd: num
});
export default {
    adr_ptr,
    group_contract,
    point_contract,
    quorum_contract,
    rec_ptr,
    val_ptr
};
