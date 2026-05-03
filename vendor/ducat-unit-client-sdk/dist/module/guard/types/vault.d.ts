import type { SubscriptionEventMap } from '../../../types/index.js';
export type VaultOpenSubscription = SubscriptionEventMap<VaultOpenResponse>;
export type VaultBorrowSubscription = SubscriptionEventMap<VaultBorrowResponse>;
export type VaultRepaySubscription = SubscriptionEventMap<VaultRepayResponse>;
export type VaultRepoSubscription = SubscriptionEventMap<VaultRepoResponse>;
export type VaultUpdateSubscription = SubscriptionEventMap<VaultUpdateResponse>;
export interface VaultUpdateResponse {
    vault_txid: string;
    vault_pubkey: string;
}
export interface VaultOpenResponse extends VaultUpdateResponse {
    issue_txid: string;
}
export interface VaultBorrowResponse extends VaultUpdateResponse {
    issue_txid: string;
}
export interface VaultRepayResponse extends VaultUpdateResponse {
    repay_txid: string;
}
export interface VaultRepoResponse extends VaultUpdateResponse {
    liquid_txid: string;
}
