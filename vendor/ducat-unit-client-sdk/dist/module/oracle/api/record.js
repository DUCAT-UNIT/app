import { fetch_record_content, fetch_satpoint_content } from './ordx.js';
import CONST from '../../../const.js';
import Schema from '../../../schema/index.js';
export async function fetch_account_record(ord_url, identifier) {
    const schema = Schema.oracle.record.acct_record;
    return fetch_record_content(ord_url, identifier, schema);
}
export async function fetch_guardian_record(ord_url, identifier) {
    const schema = Schema.oracle.record.host_record;
    return fetch_record_content(ord_url, identifier, schema);
}
export async function fetch_exchange_record(ord_url, identifier) {
    const schema = Schema.oracle.record.host_record;
    return fetch_record_content(ord_url, identifier, schema);
}
export async function fetch_terms_record(ord_url, pointer, ival = CONST.FETCH_IVAL) {
    const schema = Schema.oracle.record.val_arr;
    return fetch_satpoint_content(ord_url, pointer, { ival, schema });
}
