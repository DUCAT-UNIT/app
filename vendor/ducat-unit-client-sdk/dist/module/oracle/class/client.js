import { NostrClient } from '@vbyte/nostr-sdk';
import { get_observe_context } from '../../../lib/observe/index.js';
import { fetch_price_quotes_api } from '../../../module/oracle/api/quote.js';
import { fetch_price_contracts_api } from '../../../module/oracle/api/contract.js';
import { fetch_breached_contracts_api } from '../../../module/oracle/api/breach.js';
export class PriceOracleClient {
    constructor(oracle_pks, relay_urls, options = {}) {
        const { observability, ...nostr_options } = options;
        this._nostr = new NostrClient(relay_urls, nostr_options);
        this._observe = get_observe_context(observability, { module: 'oracle' });
        this._oracles = oracle_pks;
    }
    get fetch() {
        return {
            breaches: fetch_breached_contracts_api(this),
            contracts: fetch_price_contracts_api(this),
            quotes: fetch_price_quotes_api(this)
        };
    }
    get nostr() {
        return this._nostr;
    }
    get observe() {
        return this._observe;
    }
    get oracles() {
        return this._oracles;
    }
    close() {
        return this._nostr.close();
    }
    connect() {
        return this._nostr.connect();
    }
}
