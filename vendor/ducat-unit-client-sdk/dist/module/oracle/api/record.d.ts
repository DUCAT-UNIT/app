import type { AccountRecord, ApiResponse, ExchangeRecord, GuardianRecord, Literal } from '../../../types/index.js';
export declare function fetch_account_record(ord_url: string, identifier: string): Promise<ApiResponse<AccountRecord>>;
export declare function fetch_guardian_record(ord_url: string, identifier: string): Promise<ApiResponse<GuardianRecord>>;
export declare function fetch_exchange_record(ord_url: string, identifier: string): Promise<ApiResponse<ExchangeRecord>>;
export declare function fetch_terms_record(ord_url: string, pointer: number, ival?: number): Promise<ApiResponse<Literal[]>>;
