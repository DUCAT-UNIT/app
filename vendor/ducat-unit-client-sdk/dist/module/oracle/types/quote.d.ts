export type PriceQuote = ActiveQuote | ExpiredQuote;
export interface PriceEvent {
    event_origin: string | null;
    event_price: number | null;
    event_stamp: number | null;
    event_type: string;
    latest_origin: string;
    latest_price: number;
    latest_stamp: number;
    quote_origin: string;
    quote_price: number;
    quote_stamp: number;
}
export interface QuoteTemplate extends PriceEvent {
    is_expired: boolean;
    srv_network: string;
    srv_pubkey: string;
    thold_hash: string;
    thold_key: string | null;
    thold_price: number;
}
export interface ActiveQuote extends QuoteTemplate {
    is_expired: false;
    event_origin: null;
    event_price: null;
    event_stamp: null;
    thold_key: null;
}
export interface ExpiredQuote extends QuoteTemplate {
    is_expired: true;
    event_origin: string;
    event_price: number;
    event_stamp: number;
    thold_key: string;
}
