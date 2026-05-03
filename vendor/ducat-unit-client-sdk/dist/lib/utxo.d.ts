import type { BaseUtxo, RuneUtxo, SorterMethod } from '../types/index.js';
export declare function select_sat_utxos(utxos: BaseUtxo[], amount: number, sorter?: SorterMethod): BaseUtxo[];
export declare function select_rune_utxos(utxos: RuneUtxo[], rune: string, amount: number, sorter?: SorterMethod): RuneUtxo[];
export declare function filter_rune_utxos(utxos: RuneUtxo[], rune: string): RuneUtxo[];
export declare function sum_rune_utxos(utxos: RuneUtxo[], rune: string): number;
