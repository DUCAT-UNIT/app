import type { CoinInput, CoinUtxo, PSBTData } from '../types/index.js';
export declare function extract_utxo(psbt: PSBTData, index: number): CoinUtxo;
export declare function extract_txinput(psbt: PSBTData, index: number): CoinInput;
export declare function extract_spend_sighash(pdata: PSBTData, index: number): string;
export declare function extract_psbt_tx(psbt: string): [string, string];
