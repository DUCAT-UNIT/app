import { ProtoWallet } from '../class/wallet.js';
import type { AssetBalanceType } from '@ducat-unit/core';
export declare function fetch_assets_api(client: ProtoWallet): (validator_url: string, asset_id: string, asset_amount: number, balance_type?: AssetBalanceType) => Promise<import("@ducat-unit/core").AssetAccount[]>;
export declare function fetch_funds_api(client: ProtoWallet): (funds_amount?: number) => Promise<import("@ducat-unit/core").CoinUtxo[]>;
export declare function fetch_vaults_api(client: ProtoWallet): (validator_url: string) => Promise<import("@ducat-unit/core").VaultProfile[]>;
