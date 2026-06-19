export * from './api/open.js';
export * from './api/deposit.js';
export * from './api/borrow.js';
export * from './api/repay.js';
export * from './api/close.js';
export * from './api/withdraw.js';
export * from './api/repo.js';
import { VaultOpenAPI } from './api/open.js';
import { VaultBorrowAPI } from './api/borrow.js';
import { VaultDepositAPI } from './api/deposit.js';
import { VaultRepayAPI } from './api/repay.js';
import { VaultCloseAPI } from './api/close.js';
import { VaultWithdrawAPI } from './api/withdraw.js';
import { VaultRepoAPI } from './api/repo.js';
import { VaultTrimAPI } from './api/trim.js';
export declare namespace VaultActionAPI {
    const open: typeof VaultOpenAPI;
    const borrow: typeof VaultBorrowAPI;
    const repay: typeof VaultRepayAPI;
    const close: typeof VaultCloseAPI;
    const deposit: typeof VaultDepositAPI;
    const withdraw: typeof VaultWithdrawAPI;
    const repo: typeof VaultRepoAPI;
    const trim: typeof VaultTrimAPI;
}
export * from './lib/index.js';
export * from './types/index.js';
export * as SCHEMA from './schema/index.js';
export type LiquidationQuote = Record<string, any>;
export type VaultReturnData = Partial<import('@ducat-unit/core').VaultReturnData> & Record<string, any>;
export type VaultProfile = Partial<import('@ducat-unit/core').VaultProfile> & Record<string, any>;
export type LiquidVaultProfile = Partial<import('@ducat-unit/core').LiquidVaultProfile> & VaultProfile & {
    claimed_sats: number;
    claimed_unit: number;
    deficit_sats: number;
    reserve_sats: number;
    reward_sats: number;
    subsidy_rate: number;
    liquid_key: string;
    liquid_price: number;
    liquid_quote: LiquidationQuote;
    thold_key?: string;
};
export interface VaultOpenConfig { borrow_amount?: number; deposit_amount?: number; tx_feerate?: number; unit_postage?: number; token_postage?: number; token_data?: unknown }
export interface VaultBorrowConfig { borrow_amount?: number; deposit_amount?: number; tx_feerate?: number; unit_postage?: number }
export interface VaultRepayConfig { deposit_amount?: number; repay_amount?: number; tx_feerate?: number; unit_postage?: number }
export interface VaultDepositConfig { deposit_amount?: number; tx_feerate?: number }
export interface VaultWithdrawConfig { change_amount?: number; withdraw_amount?: number; tx_feerate?: number }
