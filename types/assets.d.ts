/**
 * Asset Type Definitions
 * Canonical types for different asset representations
 */

/**
 * Asset type for display purposes (uppercase)
 * Used in UI components for displaying transaction/balance info
 */
export type DisplayAssetType = 'BTC' | 'UNIT' | 'RUNE';

/**
 * Asset type for send flow (lowercase, nullable)
 * Used in send flow context and related hooks
 */
export type SendFlowAssetType = 'btc' | 'unit' | null;

/**
 * Asset type for navigation params (lowercase, extensible)
 * Used in navigation route parameters
 */
export type AssetTypeParam = 'btc' | 'turbo' | 'rune' | string;

/**
 * Address type for receive flow
 */
export type AddressTypeParam = 'segwit' | 'taproot';

/**
 * Vault action types
 */
export type VaultAction = 'Borrow' | 'Repay' | 'Deposit' | 'Withdraw' | 'Open' | 'Repossess' | 'Swap';

/**
 * Vault transaction data (for transaction display)
 */
export interface VaultTransactionData {
  btcAmount: number;
  unitAmount: number;
  action: VaultAction;
}

/**
 * Vault state data (for vault screen/service)
 * Matches the canonical definition from services/vaultService.ts
 */
export interface VaultStateData {
  vaultId?: string;
  vaultTag: string;
  totalDebt: number;
  totalCollateral: number;
  currentPrice: number;
  latestTransaction?: {
    amountBorrowed: number;
    vaultAmount: number;
    btcAmount: number;
    unitAmt: number;
    oraclePrice: number;
    timestamp: number;
    action: string;
  };
}

/**
 * UTXO reference for transaction tracking
 */
export interface UtxoRef {
  txid: string;
  vout: number;
}
