import { Fetch } from '@vbyte/util';
import { validate_fetch_response, safe_path_segment } from './util.js';
import * as SCHEMA from '../../schema/index.js';
export async function fetch_coin_data(host_url, coin_id) {
    const seg = safe_path_segment(coin_id, 'coin_id');
    const url = `${host_url}/api/coin/${seg}`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    return validate_fetch_response(SCHEMA.fetch.coin_data, res.data, 'coin data validation failed');
}
