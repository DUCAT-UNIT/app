/**
 * Vault Operation Types
 *
 * Shared type definitions for the unified vault operation hook.
 * These types define the configuration and result interfaces that allow
 * a single base hook to handle all vault operations (borrow, deposit, repay, withdraw).
 */

import type { VaultProfile, GuardianSocket } from '@ducat-unit/client-sdk';

/**
 * The four types of vault operations supported
 */
export type VaultOperationType = 'borrow' | 'deposit' | 'repay' | 'withdraw';

/**
 * Processing step numbers (1-4) for the operation flow
 */
export type ProcessingStep = 1 | 2 | 3 | 4;

/**
 * Wallet data required for vault operations
 */
export interface VaultWalletData {
  segwitAddress: string;
  segwitPubkey: string;
  taprootAddress: string;
  taprootPubkey: string;
}

/**
 * Store state selectors - what we read from the operation-specific store
 */
export interface VaultStoreState {
  /** Amount in primary unit (sats for BTC operations, cents for UNIT operations) */
  amount: number;
  /** Selected fee rate in sats/vbyte */
  selectedFeeRate: number;
  /** Current UNIT debt */
  currentUnitBorrowed: number;
  /** Current BTC collateral in BTC (not sats) */
  currentBtcLocked: number;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Issue transaction ID (for borrow/repay) */
  issueTxid?: string | null;
  /** Vault transaction ID */
  vaultTxid: string | null;
}

/**
 * Store actions - what we call on the operation-specific store
 */
export interface VaultStoreActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setVaultTxid: (txid: string | null) => void;
  setIssueTxid?: (txid: string | null) => void;
  setCurrentStep: (step: string) => void;
  setProcessingStep: (step: ProcessingStep) => void;
  setCurrentVaultData: (unitBorrowed: number, btcLocked: number) => void;
  setBitcoinPrice: (price: number) => void;
  reset: () => void;
}

/**
 * Combined store interface
 */
export interface VaultStore {
  state: VaultStoreState;
  actions: VaultStoreActions;
}

/**
 * Configuration for a specific vault operation
 */
export interface VaultOperationConfig<TConfig, TRequest, TResult> {
  /** Operation type identifier */
  operationType: VaultOperationType;

  /** Human-readable operation name for logging */
  operationName: string;

  /** Whether this operation requires a guardian reservation step */
  needsReservation: boolean;

  /** Whether this operation returns an issue txid (borrow/repay) or just vault txid */
  hasIssueTxid: boolean;

  /** Keep the store in processing so a higher-level settlement wrapper can finish the flow */
  deferSuccessTransition?: boolean;

  /** Hook to access the operation-specific store */
  useStore: () => VaultStore;

  /** Validate the operation before executing */
  validate: (params: VaultValidationParams) => string | null;

  /** Create the operation-specific config object */
  createConfig: (amount: number, feeRate: number) => TConfig;

  /** Create the request to send to guardian (async, may involve signing) */
  createRequest: (params: VaultRequestParams<TConfig>) => Promise<TRequest>;

  /** Perform the reservation step (only called if needsReservation is true) */
  performReservation?: (
    gclient: GuardianSocket,
    config: TConfig,
    taprootPubkey: string
  ) => Promise<unknown>;

  /** Send the request to guardian */
  sendRequest: (gclient: GuardianSocket, request: TRequest) => Promise<TResult>;

  /** Extract transaction IDs from the result */
  extractResult: (result: TResult) => { txid?: string; vaultTxid: string };

  /** Create pending transaction data for tracking */
  createPendingTransaction: (params: PendingTransactionParams<TConfig>) => PendingVaultTransaction;

  /** Calculate liquidation price for oracle quote (operation-specific) */
  calculateLiquidationPrice: (params: LiquidationPriceParams) => number;
}

/**
 * Parameters for validation
 */
export interface VaultValidationParams {
  wallet: VaultWalletData | null;
  btcPrice: number | null;
  amount: number;
  currentUnitBorrowed: number;
  currentBtcLocked: number;
}

/**
 * Parameters for creating the request
 */
export interface VaultRequestParams<TConfig> {
  vaultWallet: unknown; // VaultWallet from vaultWalletService
  config: TConfig;
  reservationResult?: unknown;
  feeRate: number;
  oracleQuote: unknown;
  vaultProfile: VaultProfile;
}

/**
 * Parameters for calculating liquidation price
 */
export interface LiquidationPriceParams {
  amount: number;
  currentUnitBorrowed: number;
  currentBtcLocked: number;
}

/**
 * Parameters for creating pending transaction
 */
export interface PendingTransactionParams<TConfig> {
  config: TConfig;
  result: { txid?: string; vaultTxid: string };
  taprootPubkey: string;
}

/**
 * Pending vault transaction for tracking
 */
export interface PendingVaultTransaction {
  txid: string;
  vaultTxid: string;
  action: VaultOperationType;
  btcAmt: number;
  unitAmt: number;
  timestamp: number;
  vaultPubkey: string;
}

/**
 * Result from the vault operation hook
 */
export interface UseVaultOperationResult {
  /** Execute the operation */
  execute: () => Promise<{ txid?: string; vaultTxid: string } | null>;
  /** Load vault data from context */
  loadVaultData: () => Promise<boolean>;
  /** Cancel and reset */
  cancel: () => void;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Issue transaction ID (for borrow/repay) */
  issueTxid: string | null;
  /** Vault transaction ID */
  vaultTxid: string | null;
  /** Whether vault data has been loaded */
  vaultDataLoaded: boolean;
}
