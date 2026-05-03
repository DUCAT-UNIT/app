export type SafeReturn<T = any> = SuccessReturn<T> | ErrorReturn;
export interface SuccessReturn<T> {
    ok: true;
    data: T;
}
export interface ErrorReturn {
    ok: false;
    err: unknown;
}
export type SorterMethod<T = any> = (a: T, b: T) => 1 | 0 | -1;
export interface ContractProfile {
    oracle_pk: string;
    guard_pk: string;
    master_id: string;
    unit_rune: {
        address: string;
        divisor: number;
        issued: number;
        label: string;
        mint_id: string;
        rune_id: string;
        symbol: string;
        utxo: {
            txid: string;
            vout: number;
            script: string;
            value: number;
        };
    };
    terms: [label: string, value: string | number][];
    version: number;
}
