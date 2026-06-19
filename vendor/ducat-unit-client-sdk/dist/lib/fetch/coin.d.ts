import { Resolve } from '@vbyte/util';
import type { CoinData } from '../../types/index.js';
export declare function fetch_coin_data(host_url: string, coin_id: string): Promise<Resolve.Type<CoinData>>;
