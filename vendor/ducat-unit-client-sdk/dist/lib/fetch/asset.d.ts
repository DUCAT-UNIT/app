import { Resolve } from '@vbyte/util';
import type { AssetAccount } from '@ducat-unit/core';
import type { AssetStats } from '../../types/index.js';
export declare function fetch_asset_data(host_url: string, address: string): Promise<Resolve.Type<AssetAccount[]>>;
export declare function fetch_asset_history(host_url: string, asset_id: string, page_size?: number, cursor?: string): Promise<Resolve.Type<AssetAccount[]>>;
export declare function fetch_asset_stats(host_url: string, asset_id: string): Promise<Resolve.Type<AssetStats>>;
