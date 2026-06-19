import { parse_content } from '@vbyte/nostr-sdk/lib';
import * as SHARED from '@ducat-unit/core/schema';
export function fetch_breached_contracts_api(client) {
    return async (contract_ids) => {
        const results = await client.nostr.query({
            kinds: [1000],
            authors: client.oracles,
            '#h': contract_ids
        });
        return results
            .map(e => parse_content(e.content, SHARED.price.contract))
            .filter(e => e.ok && e.result.thold_key !== null)
            .map(e => e.result);
    };
}
