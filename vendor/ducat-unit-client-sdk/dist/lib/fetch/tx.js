import { Fetch } from '@vbyte/util';
import { validate_fetch_response, safe_path_segment } from './util.js';
import * as SCHEMA from '../../schema/index.js';
export async function fetch_tx_data(host_url, txid) {
    const seg = safe_path_segment(txid, 'txid');
    const url = `${host_url}/api/tx/${seg}`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    return validate_fetch_response(SCHEMA.fetch.tx_data, res.data, 'transaction data validation failed');
}
