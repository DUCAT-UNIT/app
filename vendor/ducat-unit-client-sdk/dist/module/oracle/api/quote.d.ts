import { PriceOracleClient } from '../class/client.js';
import type { PriceQuote } from '@ducat-unit/core';
export interface FetchPriceQuotesOptions {
    max_age_ms?: number;
}
export declare function fetch_price_quotes_api(client: PriceOracleClient): (options?: FetchPriceQuotesOptions) => Promise<PriceQuote[]>;
