import { Fetch } from '@vbyte/util';
import { validate_fetch_list_response, validate_fetch_response, safe_path_segment } from './util.js';
import * as SHARED from '@ducat-unit/core/schema';
export async function fetch_vault_all(host_url, page_size, cursor) {
    const url = new URL(`${host_url}/api/vault/all`);
    if (page_size !== undefined)
        url.searchParams.set('page_size', String(page_size));
    if (cursor !== undefined)
        url.searchParams.set('cursor', cursor);
    const res = await Fetch.json(url.toString());
    if (!res.ok)
        return res;
    return validate_fetch_list_response(SHARED.vault.profile.array(), res.data, 'vault list validation failed');
}
export async function fetch_vault_latest(host_url, root_txid) {
    const seg = safe_path_segment(root_txid, 'root_txid');
    const url = `${host_url}/api/vault/${seg}/latest`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    return validate_fetch_response(SHARED.vault.profile, res.data, 'vault profile validation failed');
}
export async function fetch_vault_history(host_url, root_txid, options) {
    const seg = safe_path_segment(root_txid, 'root_txid');
    const url = new URL(`${host_url}/api/vault/${seg}/history`);
    if (options?.action !== undefined)
        url.searchParams.set('action', options.action);
    if (options?.sort_by !== undefined)
        url.searchParams.set('sort_by', options.sort_by);
    if (options?.sort_order !== undefined)
        url.searchParams.set('sort_order', options.sort_order);
    const res = await Fetch.json(url.toString());
    if (!res.ok)
        return res;
    return validate_fetch_response(SHARED.vault.profile.array(), res.data, 'vault history validation failed');
}
