import { Resolve } from '@vbyte/util';
import type { VaultProfile } from '@ducat-unit/core';
import type { LiquidStats, PaginatedData } from '../../types/index.js';
export declare function fetch_liquid_history(host_url: string, page_size?: number, cursor?: string): Promise<Resolve.Type<VaultProfile[]>>;
export declare function fetch_liquid_sample(host_url: string, price: number, count?: number, max_ratio?: number): Promise<Resolve.Type<VaultProfile[]>>;
export declare function fetch_liquid_stats(host_url: string, thold_price?: number, page_size?: number, cursor?: string): Promise<Resolve.Type<PaginatedData<LiquidStats>>>;
