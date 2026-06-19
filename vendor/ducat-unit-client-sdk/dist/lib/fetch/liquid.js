import { Fetch } from '@vbyte/util';
import { validate_fetch_list_response, validate_fetch_response } from './util.js';
import * as SHARED from '@ducat-unit/core/schema';
import * as SCHEMA from '../../schema/index.js';
export async function fetch_liquid_history(host_url, page_size, cursor) {
    const url = new URL(`${host_url}/api/liquid/history`);
    if (page_size !== undefined)
        url.searchParams.set('page_size', String(page_size));
    if (cursor !== undefined)
        url.searchParams.set('cursor', cursor);
    const res = await Fetch.json(url.toString());
    if (!res.ok)
        return res;
    return validate_fetch_list_response(SHARED.vault.profile.array(), res.data, 'liquid history validation failed');
}
export async function fetch_liquid_sample(host_url, price, count, max_ratio) {
    const url = new URL(`${host_url}/api/liquid/sample`);
    url.searchParams.set('price', String(price));
    if (count !== undefined)
        url.searchParams.set('count', String(count));
    if (max_ratio !== undefined)
        url.searchParams.set('max_ratio', String(max_ratio));
    const res = await Fetch.json(url.toString());
    if (!res.ok)
        return res;
    return validate_fetch_response(SHARED.vault.profile.array(), res.data, 'liquid sample validation failed');
}
export async function fetch_liquid_stats(host_url, thold_price = 0, page_size, cursor) {
    const url = new URL(`${host_url}/api/liquid/stats`);
    url.searchParams.set('thold_price', String(thold_price));
    if (page_size !== undefined)
        url.searchParams.set('page_size', String(page_size));
    if (cursor !== undefined)
        url.searchParams.set('cursor', cursor);
    const res = await Fetch.json(url.toString());
    if (!res.ok)
        return res;
    return validate_fetch_response(SCHEMA.fetch.liquid_stats_page, res.data, 'liquid stats validation failed');
}
