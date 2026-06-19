import type { AssetAccount, VaultProfile, WitnessRecord } from '@ducat-unit/core';
import type { Resolve } from '@vbyte/util';
export type FetchResponse<T> = Resolve.Type<T>;
export interface PaginatedData<T> {
    data: T;
    has_more: boolean;
    next_cursor: string | null;
}
export interface CoinData {
    assets: AssetAccount[];
    commits: WitnessRecord[];
    vault: VaultProfile | null;
}
export interface TxData {
    coins: AssetAccount[];
    commits: WitnessRecord[];
    vaults: VaultProfile[];
}
export interface AssetStats {
    issued_count: number;
    issued_total: number;
    reserve_count: number;
    reserve_total: number;
}
export interface LiquidStats {
    avg_base_price: number;
    avg_thold_price: number;
    avg_vault_ratio: number;
    sum_base_price: number;
    sum_thold_price: number;
    sum_vault_ratio: number;
    total_count: number;
    total_unit_debt: number;
    total_sats_value: number;
}
export interface ProtoHistoryRecord {
    spend_height: number;
    [key: string]: unknown;
}
