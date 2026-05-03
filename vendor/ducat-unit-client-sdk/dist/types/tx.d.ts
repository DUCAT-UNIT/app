export type ChainNetwork = 'main' | 'signet' | 'mutiny' | 'testnet3' | 'testnet4' | 'regtest';
export type Script = Array<string | number | Uint8Array>;
export interface DerivationData {
    mprint: number;
    path: number[];
    pubkey: string;
}
export interface TapDerivationData extends DerivationData {
    script: string;
}
export interface TaprootConfig {
    scripts: Script[] | Uint8Array[];
    int_key?: string;
    index?: number;
    version?: number;
}
export interface TxOutpoint {
    txid: string;
    vout: number;
}
export interface TxOutput {
    value: number;
    script: string;
}
