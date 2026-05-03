import type { AccountProfile, ApiResponse, MintProfile, RecordPointer } from '../../../types/index.js';
export declare function fetch_account_profile(mint: MintProfile, ord_url: string, outpoint: string, ival?: number): Promise<ApiResponse<AccountProfile>>;
export declare function fetch_mint_profile(ord_url: string, pointer: RecordPointer, ival?: number): Promise<ApiResponse<MintProfile>>;
