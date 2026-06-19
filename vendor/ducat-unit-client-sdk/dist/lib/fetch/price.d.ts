import { Resolve } from '@vbyte/util';
import type { PriceContract } from '@ducat-unit/core';
export declare function fetch_price_latest(host_url: string): Promise<Resolve.Type<PriceContract[]>>;
export declare function fetch_price_history(host_url: string, page_size?: number, cursor?: string, breached?: boolean): Promise<Resolve.Type<PriceContract[]>>;
