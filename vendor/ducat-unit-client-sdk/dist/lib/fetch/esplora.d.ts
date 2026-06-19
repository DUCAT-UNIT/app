import { Fetch } from '@vbyte/util';
import type { CoinUtxo } from '@ducat-unit/core';
import type { EsploraTxData } from '../../types/index.js';
export declare function fetch_esplora_tx(host_url: string, txid: string): Promise<Fetch.Type<EsploraTxData>>;
export declare function fetch_esplora_utxos(host_url: string, address: string): Promise<Fetch.Type<CoinUtxo[]>>;
export declare function post_esplora_tx(host_url: string, txhex: string): Promise<Fetch.Type<string>>;
