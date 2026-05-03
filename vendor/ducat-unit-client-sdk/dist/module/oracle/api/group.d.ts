import type { AccountProfile, ApiResponse, ExchangeRecord, GuardianRecord, MintProfile } from '../../../types/index.js';
export declare function fetch_rand_unit_account(mint: MintProfile, esp_url: string, ord_url: string, address: string, ival?: number): Promise<ApiResponse<AccountProfile>>;
export declare function fetch_rand_guardian_host(esp_url: string, ord_url: string, address: string, ival?: number): Promise<ApiResponse<GuardianRecord>>;
export declare function fetch_rand_exchange_host(esp_url: string, ord_url: string, address: string, ival?: number): Promise<ApiResponse<ExchangeRecord>>;
