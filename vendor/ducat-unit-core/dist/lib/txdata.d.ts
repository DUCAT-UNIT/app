import type { TxData, TxInput, TxOutput } from '@vbyte/btc-dev';
import type { ProtoTxCoinbase, ProtoTxData, ProtoTxInput, ProtoTxOutput } from '../types/index.js';
export declare function find_tx_input(inputs: ProtoTxInput[], code: number): ProtoTxInput | null;
export declare function parse_tx_data(txdata: string | Uint8Array | TxData): ProtoTxData;
export declare function parse_tx_output(txout: TxOutput): ProtoTxOutput;
export declare function parse_tx_input(txin: TxInput): ProtoTxInput | ProtoTxCoinbase;
