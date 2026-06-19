import { Fetch } from '@vbyte/util';
import { validate_fetch_list_response, safe_path_segment } from './util.js';
import * as SHARED from '@ducat-unit/core/schema';
export async function fetch_address_assets(host_url, address, page_size, cursor) {
    const seg = safe_path_segment(address, 'address');
    const url = new URL(`${host_url}/api/address/${seg}`);
    if (page_size !== undefined)
        url.searchParams.set('page_size', String(page_size));
    if (cursor !== undefined)
        url.searchParams.set('cursor', cursor);
    const res = await Fetch.json(url.toString());
    if (!res.ok)
        return res;
    return validate_fetch_list_response(SHARED.asset.account.array(), res.data, 'address assets validation failed');
}
export async function fetch_pubkey_commits(host_url, pubkey, page_size, cursor) {
    const seg = safe_path_segment(pubkey, 'pubkey');
    const url = new URL(`${host_url}/api/pubkey/${seg}/commits`);
    if (page_size !== undefined)
        url.searchParams.set('page_size', String(page_size));
    if (cursor !== undefined)
        url.searchParams.set('cursor', cursor);
    const res = await Fetch.json(url.toString());
    if (!res.ok)
        return res;
    return validate_fetch_list_response(SHARED.witness.record.array(), res.data, 'pubkey commits validation failed');
}
export async function fetch_pubkey_vaults(host_url, pubkey) {
    const seg = safe_path_segment(pubkey, 'pubkey');
    const res = await Fetch.json(`${host_url}/api/vault/pubkey/${seg}`);
    if (!res.ok)
        return res;
    return validate_fetch_list_response(SHARED.vault.profile.array(), res.data, 'pubkey vaults validation failed');
}
