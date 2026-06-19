import type { PriceCommitData } from './price.js';
export type VaultAction = 'open' | 'close' | 'borrow' | 'repay' | 'repo' | 'withdraw' | 'deposit' | 'trim' | 'liquidate';
export interface VaultConfigPayload {
    lbl: string;
}
export interface VaultConfigData {
    label: string;
}
export interface VaultReturnData {
    guard_members: string[];
    price_commits: PriceCommitData[];
    price_stamp: number | null;
    unit_balance: number;
    unit_price: number | null;
    thold_price: number | null;
}
export interface VaultSequenceData {
    vault_action: VaultAction;
    vault_version: number;
}
export interface EncumberedVaultReturnData extends VaultReturnData {
    price_stamp: number;
    unit_price: number;
    thold_price: number;
}
export interface ClearedVaultReturnData extends VaultReturnData {
    price_stamp: null;
    unit_price: null;
    thold_price: null;
}
export interface VaultProfileConfig {
    root_txid?: string;
    vault_config?: VaultConfigData | null;
}
export interface VaultProfile extends VaultReturnData, VaultSequenceData {
    coin_id: string | null;
    client_pubkey: string;
    contract_id: string;
    guard_pubkey: string;
    root_txid: string;
    vault_balance: number;
    vault_config: VaultConfigData | null;
    vault_ratio: number | null;
    vault_script: string | null;
    vault_value: number | null;
}
export interface BlockMetaData {
    block_height: number;
    block_stamp: number;
}
export type VaultHistoryProfile = VaultProfile & BlockMetaData;
