import { Fetch } from '@vbyte/util';
import { validate_fetch_list_response, validate_fetch_response, safe_path_segment } from './util.js';
import * as SHARED from '@ducat-unit/core/schema';
function resolve_commit_latest_path(key) {
    return `/api/commit/${safe_path_segment(key, 'commit key')}/latest`;
}
function resolve_commit_history_path(key) {
    return `/api/commit/${safe_path_segment(key, 'commit key')}/history`;
}
export async function fetch_commit_all(host_url, page_size, cursor) {
    const url = new URL(`${host_url}/api/commit/history`);
    if (page_size !== undefined)
        url.searchParams.set('page_size', String(page_size));
    if (cursor !== undefined)
        url.searchParams.set('cursor', cursor);
    const res = await Fetch.json(url.toString());
    if (!res.ok)
        return res;
    return validate_fetch_list_response(SHARED.witness.record.array(), res.data, 'global commit history validation failed');
}
export async function fetch_commit_latest(host_url, root_id) {
    const url = `${host_url}${resolve_commit_latest_path(root_id)}`;
    const res = await Fetch.json(url);
    if (!res.ok)
        return res;
    return validate_fetch_response(SHARED.witness.record, res.data, 'commit record validation failed');
}
export async function fetch_commit_history(host_url, root_id, page_size, cursor) {
    const url = new URL(`${host_url}${resolve_commit_history_path(root_id)}`);
    if (page_size !== undefined)
        url.searchParams.set('page_size', String(page_size));
    if (cursor !== undefined)
        url.searchParams.set('cursor', cursor);
    const res = await Fetch.json(url.toString());
    if (!res.ok)
        return res;
    return validate_fetch_list_response(SHARED.witness.record.array(), res.data, 'commit history validation failed');
}
