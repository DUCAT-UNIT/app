import type { ApiResponse, PriceQuote } from '../../../types/index.js';
export declare function fetch_price_quote(exchange_url: string, thold_price: number, quote_stamp?: number): Promise<ApiResponse<PriceQuote>>;
