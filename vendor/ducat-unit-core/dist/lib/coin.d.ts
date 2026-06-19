import type { CoinInput, CoinUtxo, ProtoTxData } from '../types/index.js';
export declare function get_coin_total_value(coin_utxos: CoinUtxo[]): number;
export declare function select_coins(coins: CoinUtxo[], amount: number): CoinUtxo[];
export declare function get_coin_utxo(txdata: ProtoTxData, index: number): CoinUtxo | null;
export declare function get_coin_input(template: CoinUtxo & Partial<CoinInput>): CoinInput;
