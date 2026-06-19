import { Fetch } from '@vbyte/util';
import { validate_fetch_list_response, validate_fetch_response, safe_path_segment } from './util.js';
import * as SHARED from '@ducat-unit/core/schema';
import * as SCHEMA from '../../schema/index.js';
export async function fetch_asset_data(host_url, address) {
    const seg = safe_path_segment(address, 'address');
    const url = `${host_url}/api/address/${seg}`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    return validate_fetch_list_response(SHARED.asset.account.array(), res.data, 'asset data validation failed');
}
export async function fetch_asset_history(host_url, asset_id, page_size, cursor) {
    const seg = safe_path_segment(asset_id, 'asset_id');
    const url = new URL(`${host_url}/api/asset/${seg}/history`);
    if (page_size !== undefined)
        url.searchParams.set('page_size', String(page_size));
    if (cursor !== undefined)
        url.searchParams.set('cursor', cursor);
    const res = await Fetch.json(url.toString());
    if (!res.ok)
        return res;
    return validate_fetch_list_response(SHARED.asset.account.array(), res.data, 'asset history validation failed');
}
export async function fetch_asset_stats(host_url, asset_id) {
    const seg = safe_path_segment(asset_id, 'asset_id');
    const url = `${host_url}/api/asset/${seg}/stats`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    return validate_fetch_response(SCHEMA.fetch.asset_stats, res.data, 'asset stats validation failed');
}
