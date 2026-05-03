import type { RuneMap } from '../types/index.js';
import type { TxOutpoint, TxOutput } from './tx.js';
export type BaseUtxo = TxOutput & TxOutpoint & {
    sequence?: number;
};
export interface SignedUtxo extends BaseUtxo {
    sighash?: string;
    witness: string[];
}
export interface RuneUtxo extends BaseUtxo {
    records: string[];
    runes: RuneMap;
}
