import { Transaction } from '@scure/btc-signer';
import { TransactionInput, TransactionOutput } from '@scure/btc-signer/psbt';
export type { Transaction, TransactionInput, TransactionOutput };
export type PSBTData = string | Transaction;
export type Bip32DerivationPath = [
    [
        Uint8Array,
        {
            fingerprint: number;
            path: number[];
        }
    ]
];
export type TapScriptEntry = [
    {
        version: number;
        internalKey: Uint8Array;
        merklePath: Uint8Array[];
    },
    redeemScript: Uint8Array
];
export interface PSBTBaseInput extends TransactionInput {
    txid: Uint8Array;
    index: number;
    witnessUtxo: PSBTBaseOutput;
}
export interface PSBTBaseOutput {
    amount: bigint;
    script: Uint8Array;
}
export interface PSBTPrevouts {
    scripts: Uint8Array[];
    values: bigint[];
}
export interface PSBTInputSelectOpt {
    start_idx?: number;
    stop_idx?: number;
    post_filter?: number;
    post_exclude?: number;
}
