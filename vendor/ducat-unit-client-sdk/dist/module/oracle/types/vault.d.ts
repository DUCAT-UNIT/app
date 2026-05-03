import type { BaseUtxo, VaultReturnData } from '../../../types/index.js';
export type VaultTokenMap = Map<string, VaultToken>;
export interface VaultPrevout {
    rdata: VaultReturnData;
    utxo: BaseUtxo;
}
export interface VaultProfile extends VaultPrevout {
    acct_id: string;
    guard_pk: string;
    master_id: string;
    vault_pk: string;
}
export interface VaultRecord {
    gpk: string;
    mid: string;
    vpk: string;
}
export interface VaultToken {
    data: VaultTokenData;
    ptr: number;
    utxo: BaseUtxo;
    vid: string;
}
export interface VaultTokenData {
    rev: number;
    tag: string;
    ver: number;
}
