import { Resolve, sleep } from '../../../util/index.js';
import { fetch_record_content } from './ordx.js';
import { ord_fetch_inscription, ord_fetch_sat_identifier } from './ord.js';
import CONST from '../../../const.js';
import Schema from '../../../schema/index.js';
export async function fetch_master_contract(ord_url, identifier) {
    const schema = Schema.oracle.proto.master_contract;
    return fetch_record_content(ord_url, identifier, schema);
}
export async function fetch_child_contract(ord_url, pointer, options = {}) {
    const { ival = CONST.FETCH_IVAL, schema } = options;
    const [address, sat] = pointer;
    const res1 = await ord_fetch_sat_identifier(ord_url, sat, -1);
    if (!res1.ok) {
        return res1;
    }
    else if (res1.data === null) {
        return Resolve.fail('sat points to a null inscription id', 404);
    }
    await sleep(ival);
    const res2 = await ord_fetch_inscription(ord_url, res1.data);
    if (!res2.ok) {
        return res2;
    }
    else if (res2.data.address !== address) {
        return Resolve.fail('sat points to an unrecognized address', 403);
    }
    else if (res2.data.sat !== sat) {
        return Resolve.fail('sat does not point to itself', 403);
    }
    await sleep(ival);
    return fetch_record_content(ord_url, res1.data, schema);
}
export async function fetch_guard_contract(ord_url, pointer, ival = CONST.FETCH_IVAL) {
    const schema = Schema.oracle.proto.guard_contract;
    return fetch_child_contract(ord_url, pointer, { ival, schema });
}
export async function fetch_oracle_contract(ord_url, pointer, ival = CONST.FETCH_IVAL) {
    const schema = Schema.oracle.proto.oracle_contract;
    return fetch_child_contract(ord_url, pointer, { ival, schema });
}
export async function fetch_terms_contract(ord_url, pointer, ival = CONST.FETCH_IVAL) {
    const schema = Schema.oracle.proto.terms_contract;
    return fetch_child_contract(ord_url, pointer, { ival, schema });
}
