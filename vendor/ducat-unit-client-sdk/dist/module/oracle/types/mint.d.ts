import { BaseUtxo, RuneUtxo } from '../../../types/index.js';
export type RuneUtxoMap = Map<string, RuneUtxo>;
export interface RuneAddressBalance {
    rune_bal: Map<string, number>;
    sats_bal: number;
}
export interface AccountProfile {
    acct_id: string;
    balance: number;
    issued: number;
    utxo: BaseUtxo;
}
export interface MintProfile {
    address: string;
    divisor: number;
    issued: number;
    label: string;
    mint_id: string;
    rune_id: string;
    symbol: string;
    utxo: BaseUtxo;
}
