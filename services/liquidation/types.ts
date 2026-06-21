/**
 * Liquidation Types
 *
 * Types for the liquidation system, matching the web frontend
 * and the @ducat-unit/client-sdk interfaces.
 */

import type { LiquidVaultProfile, LiquidationQuote, VaultProfile } from '@ducat-unit/client-sdk';

// ============================================================
// Validator API Response Types
// ============================================================

export interface ValidatorLiquidatedVault {
  latest_profile?: VaultProfile;
  vault_id: string;
  master_id: string;
  guardian_pubkey: string;
  vault_pubkey: string;
  open_account_id: string;
  collateral_rate: number;
  stone: {
    txid: string;
    vout: number;
    version: string;
    action: string;
    balance: number;         // Unit balance in cents
    oracle_price: number;
    oracle_timestamp: number;
    liquidation_price: number;
    liquidation_hash: number[];
  };
  output: {
    txid: string;
    vout: number;
    amount: number;          // Sats
    address: string;
  };
  output_script: string;
  quote: {
    event_origin: string | null;
    event_price: number | null;
    event_stamp: number | null;
    event_type: string;
    is_expired: boolean;
    latest_origin: string;
    latest_price: number;
    latest_stamp: number;
    quote_origin: string;
    quote_price: number;
    quote_stamp: number;
    req_id: string;
    req_sig: string;
    srv_network: string;
    srv_pubkey: string;
    thold_hash: string;
    thold_key: string;
    thold_price: number;
  };
  thold_key: string;
}

// ============================================================
// Computed Data Types (frontend-side calculations)
// ============================================================

export interface LiquidationVaultComputedData {
  vaultId: string;
  unit: number;                          // Debt in UNIT
  btcInVault: number;                    // Pre-tax collateral in BTC
  postTaxBtcInVault: number;             // Post-tax collateral in BTC
  claimAmountBtc: number;                // Deficit amount in BTC (what liquidator deposits)
  unitSwapBtc: number;                   // BTC equivalent of UNIT debt (unit / btcPrice)
  claimAmountPartial?: number;           // Partial claim BTC (last vault in selection)
  claimAmountDiff?: number;              // Unclaimed portion of partial vault
  profitBtc: number;                     // Liquidator profit in BTC
  profitPercent: number;                 // Profit percentage
  profitPercentPrecised: number;         // High-precision profit percentage
  liquidationTaxRebatePercent?: number;  // Tax rebate from protocol
}

/** Full vault profile with SDK data + computed metadata */
export type LiquidVaultProfileWithMeta = LiquidVaultProfile &
  LiquidationVaultComputedData & {
    liquid_quote_partial?: LiquidationQuote;
    sourceVaultProfile?: VaultProfile;
    isLiquidationEstimate?: boolean;
  };

// ============================================================
// Extended vault profile (from validator response mapping)
// ============================================================

export interface ExtendedVaultProfile {
  vaultId: string;
  unit: number;
  btcInVault: number;
  thold_key: string;
  acct_id: string;
  guard_pk: string;
  vault_pk: string;
  master_id: string;
  utxo: {
    value: number;
    txid: string;
    vout: number;
    script: string;
  };
  rdata: {
    is_locked: boolean;
    thold_hash: string;
    thold_price: number;
    unit_balance: number;
    unit_price: number;
    unit_stamp: number;
    vault_action: string;
  };
}

// ============================================================
// Investment & Selection Types
// ============================================================

export interface LiquidationInvestStats {
  maxInvestBtc: number;
  maxClaimAmountBtc: number;
  maxSwapBtc: number;
  maxSwapUnit: number;
  maxVaultCount: number;
  lastPortionRate: number;
}

export interface ClaimFromInvestResult {
  claimAmountBtcSelected: number;
  swapAmountBtcSelected: number;
  feeSats: number;
  vaultCount: number;
}

export interface EstimatedYield {
  btc: number;
  percent: number;
}

export interface HealthAfterLiquidation {
  finalDepositAmount: number;
  finalVaultCollateral: number;
  finalUnitDebt: number;
  finalHealthValue: number;
  finalAssetValueBtc: number;
}

export interface SelectionStats {
  totalClaimBtc: number;
  totalClaimedBtc: number;
  totalClaimedUnit: number;
}

/** Display-oriented projection of LiquidationVaultComputedData for UI rendering */
export type LiqVaultDisplay = Pick<
  LiquidationVaultComputedData,
  'vaultId' | 'unit' | 'btcInVault' | 'claimAmountBtc' | 'profitBtc' | 'profitPercent' | 'postTaxBtcInVault' | 'unitSwapBtc'
>;

// ============================================================
// Swap Types (BTC→UNIT auto-swap after liquidation)
// ============================================================

export interface SwapUtxo {
  tx: string;
  output: number;
  value: number;
}

export interface SwapPsbtPayload {
  utxos: SwapUtxo[];
  amt_to_transfer: number;
  unit_amt: number;
  payment_address: string;
  ordinals_address: string;
  btc_price: number;
  vault_id: string;
}

export interface SwapPsbtData {
  psbt: string;
  message: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  user_input_indices: number[];
}

export interface SwapPsbtResponse {
  success: boolean;
  data?: SwapPsbtData;
  error?: string;
  timestamp?: string;
}
