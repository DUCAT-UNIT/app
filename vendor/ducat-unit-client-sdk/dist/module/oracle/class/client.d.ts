import { NostrClient, NostrClientConfig } from '@vbyte/nostr-sdk';
import type { ObserveContext, ObservabilityOptions } from '../../../lib/observe/index.js';
export interface PriceOracleClientOptions extends Partial<NostrClientConfig> {
    observability?: ObservabilityOptions | ObserveContext;
}
export declare class PriceOracleClient {
    private readonly _nostr;
    private readonly _observe;
    private readonly _oracles;
    constructor(oracle_pks: string[], relay_urls: string[], options?: PriceOracleClientOptions);
    get fetch(): {
        breaches: (contract_ids: string[]) => Promise<import("@ducat-unit/core").BreachedPriceContract[]>;
        contracts: (commit_hashes: string[]) => Promise<import("@ducat-unit/core").PriceContract[]>;
        quotes: (options?: import("../../../module/oracle/api/quote.js").FetchPriceQuotesOptions) => Promise<import("@ducat-unit/core").PriceQuote[]>;
    };
    get nostr(): NostrClient;
    get observe(): ObserveContext;
    get oracles(): string[];
    close(): void;
    connect(): Promise<void>;
}
