import type { AssetAccount, AssetBalanceType, AssetPool, AssetProfile, CoinUtxo, ProtoProfile } from '../types/index.js';
export declare function get_asset_balance(asset_account: AssetAccount, balance_type: AssetBalanceType): number;
export declare function filter_asset_accounts(asset_accts: AssetAccount[], asset_id: string): AssetAccount[];
export declare function select_asset_accounts(asset_accts: AssetAccount[], asset_id: string, asset_amount: number, balance_type?: AssetBalanceType): AssetAccount[];
export declare function get_asset_account_utxo(asset_account: AssetAccount): CoinUtxo;
export declare function get_asset_profile(proto_profile: ProtoProfile, asset_id: string): AssetProfile;
export declare function get_asset_pool(asset_id: string, asset_accts: AssetAccount[]): AssetPool;
