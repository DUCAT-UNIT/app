import type { CoinUtxo } from './coin.js';
export type AssetBalanceType = 'active' | 'reserve';
export interface AssetAccount {
    asset_id: string;
    asset_balance: number;
    asset_reserve: number;
    coin_id: string;
    coin_script: string;
    coin_value: number;
}
export interface AssetPool {
    asset_id: string;
    coin_utxos: CoinUtxo[];
    pool_active: number;
    pool_reserve: number;
    pool_value: number;
}
export interface AssetProfile {
    div: number;
    id: string;
    label: string;
    symbol: string;
    supply: string;
}
export interface AssetTransferConfig {
    asset_id: string;
    amount: number | bigint;
    output: number;
}
