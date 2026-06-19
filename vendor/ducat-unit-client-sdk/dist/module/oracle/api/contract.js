import { parse_content } from '@vbyte/nostr-sdk/lib';
import { DEFAULT_ORACLE_MAX_AGE_SEC, filter_fresh_events, now_seconds } from './util.js';
import * as SHARED from '@ducat-unit/core/schema';
export function fetch_price_contracts_api(client) {
    return async (commit_hashes) => {
        const now_sec = now_seconds();
        const results = await client.nostr.query({
            kinds: [30000],
            authors: client.oracles,
            '#h': commit_hashes,
            since: now_sec - DEFAULT_ORACLE_MAX_AGE_SEC
        });
        const contracts = results
            .map(e => parse_content(e.content, SHARED.price.contract))
            .filter(e => e.ok)
            .map(e => e.result);
        return filter_fresh_events(contracts, DEFAULT_ORACLE_MAX_AGE_SEC, now_sec);
    };
}
