import type { PriceContract } from '@ducat-unit/core';
export interface SetPriceResponse {
    ok: boolean;
    price: number;
    error?: string;
}
export interface CheckBreachResponse {
    ok: boolean;
    breached: string[];
    error?: string;
}
export interface ContractInfo {
    contract_id: string;
    thold_price: number;
    base_price: number;
    base_rate: number;
}
export declare function set_oracle_price(host: string, price: number): Promise<SetPriceResponse>;
export declare function check_breaches(host: string, contracts: PriceContract[]): Promise<CheckBreachResponse>;
export declare function list_oracle_contracts(host: string): Promise<ContractInfo[]>;
