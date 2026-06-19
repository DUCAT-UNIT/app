export * as CONST from './const.js';
export * as LIB from './lib/index.js';
export * as SCHEMA from './schema/index.js';
export { WebSocketClient } from './class/socket.js';
export { GuardianClient } from './module/guard/class/client.js';
export { ProtoWallet } from './module/wallet/class/wallet.js';
export * from './lib/errors/index.js';
export * from './lib/observe/index.js';
export { validate, safe_validate, assert_valid } from './lib/validate/core.js';
export type { ValidationResult, ValidateOptions } from './lib/validate/types.js';
export { validate_vault_open_config, validate_vault_borrow_config, validate_vault_deposit_config, validate_vault_repay_config, validate_vault_close_config, validate_vault_withdraw_config, validate_vault_repo_config, validate_vault_trim_config, validate_vault_close_request, validate_vault_borrow_request, validate_vault_deposit_request, validate_vault_open_request, validate_vault_repay_request, validate_vault_repo_request, validate_vault_trim_request, validate_vault_withdraw_request } from './module/vault/index.js';
export { GuardianSocket, OracleAPI, PSBT, TX, VaultAPI, VaultWallet, hash160, select_sat_utxos, taptweak_pubkey } from './compat.js';
export * from './types/index.js';
export type { ChainNetwork, PriceContract, VaultOpenRequest, VaultBorrowRequest, VaultDepositRequest, VaultRepayRequest, VaultWithdrawRequest, VaultRepoRequest, VaultOpenResponse, VaultBorrowResponse } from '@ducat-unit/core';
export type ProtocolProfile = import('@ducat-unit/core').ProtoProfile;
export type ProtoProfile = import('@ducat-unit/core').ProtoProfile & Record<string, any>;
export type PriceQuote = import('@ducat-unit/core').PriceQuote & {
  contracts?: import('@ducat-unit/core').PriceContract[];
  latest_price: number;
  latest_stamp: number;
  quote_price: number;
  quote_stamp: number;
};
export type CoinUtxo = Omit<import('@ducat-unit/core').CoinUtxo, 'script_pk'> & {
  script: string;
  script_pk?: string;
};
export type BaseUtxo = CoinUtxo;
export type RuneUtxo = CoinUtxo & {
  records?: string[];
  runes?: Map<string, { amount: number; divisibility?: number; symbol?: string }>;
  script?: string;
};
export type VaultReturnData = Partial<import('@ducat-unit/core').VaultReturnData> & {
  is_locked?: boolean;
  thold_hash?: string;
  thold_price: number;
  unit_balance: number;
  unit_price: number | null;
  unit_stamp?: number;
  vault_action?: string;
};
export type VaultProfile = Partial<import('@ducat-unit/core').VaultProfile> & Record<string, any> & {
  acct_id?: string;
  guard_pk?: string;
  master_id?: string;
  vault_pk?: string;
  rdata?: VaultReturnData;
  utxo?: BaseUtxo;
};
export type LiquidationQuote = Record<string, any>;
export type LiquidVaultProfile = Partial<import('@ducat-unit/core').LiquidVaultProfile> & VaultProfile & {
  claimed_sats: number;
  claimed_unit: number;
  deficit_sats: number;
  reserve_sats: number;
  reward_sats: number;
  subsidy_rate: number;
  liquid_key: string;
  liquid_price: number;
  liquid_quote?: LiquidationQuote;
  thold_key?: string;
};
export type VaultRepayResponse = import('@ducat-unit/core').VaultRepayResponse & { repay_txid?: string };
export type VaultPrevout = {
  rdata: VaultReturnData;
  utxo: BaseUtxo & { script?: string };
};
export type Transaction = any;
export type AccountProfile = import('@ducat-unit/core').AssetAccount;
export type UnitAccountResponse = {
  mint_account: import('@ducat-unit/core').AssetAccount;
  vault_action: string;
  vault_pubkey: string;
};
export interface WalletAccountRecord {
  sats: { address: string; pubkey: string };
  runes: { address: string; pubkey: string };
  vault: { address: string; pubkey: string };
}
export interface WalletConfig {
  indexer: { esp: string; ord: string };
  network: ChainNetwork;
  postage: { unit: number; vault: number };
  txfee_rate?: number;
  txfee_reserve?: number;
}
export type WalletConnectAPI = any;
export type SignPSBTEntry = [string, Record<string, number[]>];
export type VaultOpenCtx = any;
export type VaultBorrowCtx = any;
export type VaultDepositCtx = any;
export type VaultRepayCtx = any;
export type VaultRepoCtx = any;
export type VaultWithdrawCtx = any;
export interface WalletVaultOpenConfig { borrow_amount: number; deposit_amount: number; tx_feerate: number; vault_label: string }
export interface WalletVaultBorrowConfig { borrow_amount: number; deposit_amount: number; tx_feerate: number }
export interface WalletVaultRepoConfig { deposit_amount: number; tx_feerate: number; liquid_profiles?: unknown[] }
export interface WalletVaultRepayConfig { deposit_amount: number; repay_amount: number; tx_feerate: number }
export interface WalletVaultDepositConfig { deposit_amount: number; tx_feerate: number }
export interface WalletVaultWithdrawConfig { change_amount?: number; withdraw_amount?: number; tx_feerate: number }
export type WalletVaultOpenRequest = Partial<import('@ducat-unit/core').VaultOpenRequest> & {
  issue_txhex: string;
  issue_txid: string;
  vault_txhex: string;
  vault_txid: string;
} & Record<string, any>;
export type WalletVaultBorrowRequest = Partial<import('@ducat-unit/core').VaultBorrowRequest> & {
  issue_txhex: string;
  issue_txid: string;
  vault_txhex: string;
  vault_txid: string;
} & Record<string, any>;
export type WalletVaultRepoRequest = Partial<import('@ducat-unit/core').VaultRepoRequest> & {
  liquid_psbt?: string;
  liquid_txhex?: string;
  liquid_txid?: string;
  vault_psbt?: string;
  vault_txhex: string;
  vault_txid: string;
} & Record<string, any>;
export type WalletVaultRepayRequest = Partial<import('@ducat-unit/core').VaultRepayRequest> & {
  repay_txhex?: string;
  repay_txid: string;
  vault_txhex?: string;
  vault_txid: string;
} & Record<string, any>;
export type WalletVaultDepositRequest = Partial<import('@ducat-unit/core').VaultDepositRequest> & Record<string, any>;
export type WalletVaultWithdrawRequest = Partial<import('@ducat-unit/core').VaultWithdrawRequest> & Record<string, any>;
