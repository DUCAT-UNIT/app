import { Resolve } from '@vbyte/util';
import type { VaultProfile } from '@ducat-unit/core';
export declare function fetch_vault_all(host_url: string, page_size?: number, cursor?: string): Promise<Resolve.Type<VaultProfile[]>>;
export declare function fetch_vault_latest(host_url: string, root_txid: string): Promise<Resolve.Type<VaultProfile>>;
export declare function fetch_vault_history(host_url: string, root_txid: string, options?: {
    action?: string;
    sort_by?: 'date' | 'btc' | 'unit';
    sort_order?: 'asc' | 'desc';
}): Promise<Resolve.Type<VaultProfile[]>>;
