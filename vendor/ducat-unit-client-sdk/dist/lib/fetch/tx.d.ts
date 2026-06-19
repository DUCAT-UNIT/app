import { Resolve } from '@vbyte/util';
import type { TxData } from '../../types/index.js';
export declare function fetch_tx_data(host_url: string, txid: string): Promise<Resolve.Type<TxData>>;
