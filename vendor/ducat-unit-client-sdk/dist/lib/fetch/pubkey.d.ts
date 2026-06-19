import { Resolve } from '@vbyte/util';
import type { AssetAccount, VaultProfile, WitnessRecord } from '@ducat-unit/core';
export declare function fetch_address_assets(host_url: string, address: string, page_size?: number, cursor?: string): Promise<Resolve.Type<AssetAccount[]>>;
export declare function fetch_pubkey_commits(host_url: string, pubkey: string, page_size?: number, cursor?: string): Promise<Resolve.Type<WitnessRecord[]>>;
export declare function fetch_pubkey_vaults(host_url: string, pubkey: string): Promise<Resolve.Type<VaultProfile[]>>;
