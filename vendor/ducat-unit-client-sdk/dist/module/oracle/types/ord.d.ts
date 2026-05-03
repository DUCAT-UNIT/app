export type RuneBalance = [label: string, amount: string, symbol: string];
export type RuneRecord = Record<string, RuneData>;
export type SatRange = [start: number, stop: number];
export interface InscriptionEnvelope<T> {
    body?: T;
    delegate?: string;
    parent?: string;
    pointer?: number;
    type?: string;
}
export interface InscriptionRecord {
    id: string;
    data: Record<string, unknown>;
}
export interface InscriptionChildResponse {
    children: InscriptionChild[];
    more: boolean;
    page: number;
}
export interface InscriptionChild {
    charms: string[];
    fee: number;
    height: number;
    id: string;
    number: number;
    output: string;
    sat: number;
    satpoint: string;
    timestamp: number;
}
export interface InscriptionResponse {
    address: string;
    charms: string[];
    children: string[];
    content_length: number;
    content_type: string;
    effective_content_type: string;
    fee: number;
    height: number;
    id: string;
    next: string | null;
    number: number;
    parents: string[];
    previous: string | null;
    rune: string | null;
    sat: number;
    satpoint: string;
    timestamp: number;
    value: number;
}
export interface SatIndexResponse {
    id: string | null;
}
export interface OrdAddressResponse {
    outputs: string[];
    inscriptions: string[];
    sat_balance: number;
    runes_balances: RuneBalance[];
}
export interface OrdOutputResponse {
    address: string;
    indexed: boolean;
    inscriptions: string[];
    runes: RuneRecord | null;
    sat_ranges: SatRange[] | null;
    script_pubkey: string;
    spent: boolean;
    transaction: string;
    value: number;
}
export interface OrdTx {
    version: number;
    lock_time: number;
    input: [
        {
            previous_output: string;
            script_sig: string;
            sequence: number;
            witness: string[];
        }
    ];
    output: [
        {
            value: number;
            script_pubkey: string;
        }
    ];
}
export interface OrdTxResponse {
    chain: string;
    etching: RuneEtching | null;
    inscription_count: number;
    transaction: OrdTx;
    txid: string;
}
export interface RuneData {
    amount: number;
    divisibility: number;
    symbol: string;
}
export interface RuneEtching {
    block: number;
    burned: number;
    divisibility: number;
    etching: string;
    mints: number;
    number: number;
    premine: number;
    spaced_rune: string;
    symbol: string;
    terms: RuneTerms | null;
    timestamp: number;
    turbo: boolean;
}
export interface RuneResponse {
    entry: RuneEtching;
    id: string;
    mintable: boolean;
    parent: string;
}
export interface RuneTerms {
    something: string;
}
export interface SatResponse {
    block: number;
    charms: string[];
    cycle: number;
    decimal: string;
    degree: string;
    epoch: number;
    inscriptions: string[];
    name: string;
    number: number;
    offset: number;
    percentile: string;
    period: number;
    rarity: string;
    satpoint: string;
    timestamp: number;
}
