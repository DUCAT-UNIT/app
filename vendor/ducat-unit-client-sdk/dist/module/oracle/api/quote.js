import { Fetch } from '../../../util/fetch.js';
export async function fetch_price_quote(exchange_url, thold_price, quote_stamp) {
    const query = new URLSearchParams({ th: String(thold_price) });
    if (quote_stamp !== undefined) {
        query.append('ts', String(quote_stamp));
    }
    const url = `${exchange_url}/api/quote?` + query.toString();
    const opt = { method: 'GET' };
    return Fetch.json(url, opt);
}
