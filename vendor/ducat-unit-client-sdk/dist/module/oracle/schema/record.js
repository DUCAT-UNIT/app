import { z } from 'zod';
import base from '../../../schema/base.js';
import ord from '../../../schema/ord.js';
const { hash32, literal, num, str } = base;
const val_arr = z.tuple([num]).rest(literal);
const acct_record = z.object({
    iss: num,
});
const host_record = z.object({
    pub: hash32,
    url: str.url()
});
const token_record = z.object({
    dat: z.any(),
    ref: ord.inscribe_id
});
export default {
    acct_record,
    host_record,
    token_record,
    val_arr
};
