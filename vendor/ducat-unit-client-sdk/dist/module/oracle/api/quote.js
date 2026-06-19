import { parse_content } from '@vbyte/nostr-sdk/lib';
import { emit_warn } from '../../../lib/observe/index.js';
import { DEFAULT_ORACLE_MAX_AGE_SEC, filter_fresh_events, now_seconds } from './util.js';
import * as SHARED from '@ducat-unit/core/schema';
const DEFAULT_MAX_AGE_MS = DEFAULT_ORACLE_MAX_AGE_SEC * 1000;
export function fetch_price_quotes_api(client) {
    return async (options = {}) => {
        const { max_age_ms = DEFAULT_MAX_AGE_MS } = options;
        const max_age_sec = Math.floor(max_age_ms / 1000);
        const now_sec = now_seconds();
        const results = await client.nostr.query({
            kinds: [10000],
            authors: client.oracles,
            ...(max_age_sec > 0 ? { since: now_sec - max_age_sec } : {})
        });
        const quotes = results
            .map(e => parse_content(e.content, SHARED.price.quote))
            .filter(e => e.ok)
            .map(e => e.result);
        const fresh_quotes = filter_fresh_events(quotes, max_age_sec, now_sec);
        if (fresh_quotes.length === 0 && quotes.length > 0) {
            emit_warn(client.observe, 'oracle.quote', `All ${quotes.length} price quotes are stale (older than ${max_age_sec}s)`, { quote_count: quotes.length, max_age_sec });
        }
        return fresh_quotes;
    };
}
