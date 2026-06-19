import { Fetch } from '@vbyte/util';
import { validate_fetch_list_response, validate_fetch_response } from './util.js';
import * as SHARED from '@ducat-unit/core/schema';
export async function fetch_price_latest(host_url) {
    const url = `${host_url}/api/price/latest`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    return validate_fetch_response(SHARED.price.contract.array(), res.data, 'price latest validation failed');
}
export async function fetch_price_history(host_url, page_size, cursor, breached) {
    const url = new URL(`${host_url}/api/price/history`);
    if (page_size !== undefined)
        url.searchParams.set('page_size', String(page_size));
    if (cursor !== undefined)
        url.searchParams.set('cursor', cursor);
    if (breached !== undefined)
        url.searchParams.set('breached', String(breached));
    const res = await Fetch.json(url.toString());
    if (!res.ok)
        return res;
    return validate_fetch_list_response(SHARED.price.contract.array(), res.data, 'price history validation failed');
}
