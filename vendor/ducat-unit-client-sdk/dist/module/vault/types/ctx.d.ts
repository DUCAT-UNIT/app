import type { VaultDepositConfig, VaultOpenConfig, VaultWithdrawConfig, VaultRepayConfig, VaultBorrowConfig, VaultRepoConfig } from './config.js';
import type { AccountInput, ProtoInput, VaultInput } from './input.js';
import type { PriceQuote, VaultActionFlag } from '../../../types/index.js';
export interface VaultBaseCtx extends ProtoInput {
    sats_address: string;
    tx_feerate: number;
    vault_action: VaultActionFlag;
    vault_quote: PriceQuote;
    vault_pubkey: string;
}
export interface VaultTxQuote {
    tx_cost: number;
    tx_vsize: number;
    total_cost: number;
}
export type VaultBorrowCtx = VaultBaseCtx & VaultBorrowConfig & VaultInput & AccountInput;
export type VaultOpenCtx = VaultBaseCtx & VaultOpenConfig & AccountInput;
export type VaultDepositCtx = VaultBaseCtx & VaultDepositConfig & VaultInput;
export type VaultRepayCtx = VaultBaseCtx & VaultRepayConfig & VaultInput & AccountInput;
export type VaultRepoCtx = VaultBaseCtx & VaultRepoConfig & VaultInput & {
    repo_action: 'l';
};
export type VaultWithdrawCtx = VaultBaseCtx & VaultWithdrawConfig & VaultInput;
