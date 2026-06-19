import { Bytes } from '@vbyte/buff';
import type { TxOpts } from '@scure/btc-signer/transaction.js';
import type { CoinInput, CoinOutput, CoinUtxo, PSBTData, PSBTInput, PSBTOutput } from '../types/index.js';
interface TapScriptControlBlock {
    version: number;
    internalKey: Uint8Array;
    merklePath: Uint8Array[];
}
interface TapScriptConfig {
    index: number;
    version: number;
    internalKey: Uint8Array;
}
type TapScriptEntry = [
    cblock: TapScriptControlBlock,
    script: Uint8Array
];
export interface PSBTPrevout {
    amount: bigint;
    script: Uint8Array;
}
type PSBTInputMetadata = Pick<PSBTInput, 'tapInternalKey' | 'tapMerkleRoot' | 'tapLeafScript'>;
export declare function create_psbt(opts?: TxOpts): PSBTData;
export declare function create_psbt_output(txoutput: CoinOutput): PSBTOutput;
export declare function create_psbt_input(txinput: (CoinUtxo & Partial<CoinInput>) & Partial<PSBTInputMetadata>): PSBTInput;
export declare function create_psbt_tapscript_entry(scripts: (string | Uint8Array)[], options?: Partial<TapScriptConfig>): TapScriptEntry;
export declare function create_psbt_hashlock_entry(thold_hash: Bytes, thold_key: Bytes): [Uint8Array, Uint8Array];
export declare function create_psbt_tapscript_input(scripts: (string | Uint8Array)[], txinput: CoinInput, options?: Partial<TapScriptConfig>): PSBTInput;
export {};
