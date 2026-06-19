import { Fetch } from '@vbyte/util';
import { validate_fetch_response } from './util.js';
import * as SHARED from '@ducat-unit/core/schema';
import * as SCHEMA from '../../schema/index.js';
export async function fetch_proto_data(host_url) {
    const url = `${host_url}/api/proto/latest`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    return validate_fetch_response(SHARED.proto.profile, res.data, 'protocol profile validation failed');
}
export async function fetch_proto_history(host_url) {
    const res = await Fetch.json(`${host_url}/api/proto/history`);
    if (!res.ok)
        return res;
    return validate_fetch_response(SCHEMA.fetch.proto_history_record.array(), res.data, 'protocol history validation failed');
}
