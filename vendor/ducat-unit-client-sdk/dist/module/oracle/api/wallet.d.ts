import type { ApiResponse, BaseUtxo, GroupFetchConfig, RuneAddressBalance, RuneUtxoMap, VaultToken, VaultTokenMap } from '../../../types/index.js';
export declare function fetch_address_bal(ord_url: string, address: string): Promise<ApiResponse<RuneAddressBalance>>;
export declare function fetch_sats_utxos(esp_url: string, address: string): Promise<ApiResponse<BaseUtxo[]>>;
export declare function fetch_rune_utxos(ord_url: string, address: string, options?: Partial<GroupFetchConfig<RuneUtxoMap>>): Promise<ApiResponse<RuneUtxoMap>>;
export declare function fetch_vault_tokens(esp_url: string, ord_url: string, address: string, postage: number, options?: Partial<GroupFetchConfig<VaultToken>>): Promise<ApiResponse<VaultTokenMap>>;
