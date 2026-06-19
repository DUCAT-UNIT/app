import type { ObserveContext } from '../../../lib/observe/index.js';
import type { VaultActionConfig, VaultActionQuote } from '../../../types/index.js';
import type { VaultDepositRequestConfig, VaultCloseRequestConfig, VaultOpenRequestConfig, VaultWithdrawRequestConfig, VaultRepayRequestConfig, VaultBorrowRequestConfig, VaultRepoRequestConfig, VaultTrimRequestConfig, VaultBaseRequestConfig } from './config.js';
import type { PriceCommitData, VaultProfile, VaultTerms, CoinUtxo, AssetAccount } from '@ducat-unit/core';
export type VaultRequestCtx<T extends VaultBaseRequestConfig = VaultBaseRequestConfig> = VaultBaseRequestCtx & T;
export type VaultUpdateCtx = VaultRequestCtx<VaultBaseRequestConfig & {
    vault_profile: VaultProfile;
}>;
export type VaultOpenRequestCtx = VaultRequestCtx<VaultOpenRequestConfig>;
export type VaultBorrowRequestCtx = VaultRequestCtx<VaultBorrowRequestConfig>;
export type VaultDepositRequestCtx = VaultRequestCtx<VaultDepositRequestConfig>;
export type VaultCloseRequestCtx = VaultRequestCtx<VaultCloseRequestConfig>;
export type VaultRepayRequestCtx = VaultRequestCtx<VaultRepayRequestConfig>;
export type VaultRepoRequestCtx = VaultRequestCtx<VaultRepoRequestConfig>;
export type VaultTrimRequestCtx = VaultRequestCtx<VaultTrimRequestConfig>;
export type VaultWithdrawRequestCtx = VaultRequestCtx<VaultWithdrawRequestConfig>;
export interface VaultBaseRequestCtx extends VaultActionConfig, VaultActionQuote {
    asset_inputs: AssetAccount[];
    fund_inputs: CoinUtxo[];
    client_pubkey: string;
    guard_members: string[];
    observe: ObserveContext;
    price_commits: PriceCommitData[];
    price_stamp: number | null;
    vault_terms: VaultTerms;
    vault_version: number;
}
