import { type ApiResponse, type VaultPrevout, type VaultProfile, type VaultToken } from '../../../types/index.js';
export declare function fetch_vault_token(ord_url: string, outpoint: string, ival?: number): Promise<ApiResponse<VaultToken>>;
export declare function fetch_vault_prevout(ord_url: string, txid: string): Promise<ApiResponse<VaultPrevout>>;
export declare function fetch_vault_profile(ord_url: string, token: VaultToken, interval?: number): Promise<ApiResponse<VaultProfile>>;
