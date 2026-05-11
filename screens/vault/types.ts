/**
 * Vault Screen Types
 * Configuration types for generic vault operation screens
 */

import type { NavigationProp } from '@react-navigation/native';
import type { VaultSettlementRequestedAsset } from '../../stores/vaultSettlementStore';
import type { HealthStatus } from '../../utils/vaultUtils';

/**
 * Vault operation type
 */
export type VaultOperationType = 'borrow' | 'deposit' | 'repay' | 'withdraw';

/**
 * Asset type for the operation
 */
export type VaultAssetType = 'BTC' | 'USD';

/**
 * Common vault state from any store
 */
export interface VaultStoreState {
  // Current vault data
  currentUnitBorrowed: number;
  currentBtcLocked: number;
  bitcoinPrice: number | null;

  // Form state
  selectedFeeRate: number;

  // Process state
  currentStep: string;
  processingStep: number;
  loading: boolean;
  error: string | null;
  vaultTxid: string | null;
  txid?: string | null;

  // Computed health values
  healthFactor: number;
  newHealthFactor: number;
  liquidationPrice: number;
  newLiquidationPrice: number;
  healthStatus: HealthStatus;
  newHealthStatus: HealthStatus;

  // Actions
  setSelectedFeeRate(rate: number): void;
  setCurrentStep(step: string): void;
  setProcessingStep(step: number): void;
  reset(): void;
}

export interface BorrowVaultStore extends VaultStoreState {
  borrowAmountUsd: number;
  receiveAsset: VaultSettlementRequestedAsset;
  setBorrowAmountUsd: (amount: number) => void;
  setReceiveAsset: (asset: VaultSettlementRequestedAsset) => void;
  maxBorrowableUsd: number | null;
}

export interface DepositVaultStore extends VaultStoreState {
  depositAmountBtc: number;
  setDepositAmountBtc: (amount: number) => void;
  availableBalanceBtc: number;
  setAvailableBalance: (balance: number) => void;
}

export interface RepayVaultStore extends VaultStoreState {
  repayAmountUsd: number;
  setRepayAmountUsd: (amount: number) => void;
  repayFundingAsset: VaultSettlementRequestedAsset;
  setRepayFundingAsset: (asset: VaultSettlementRequestedAsset) => void;
  maxRepayableUsd: number;
  availableRepayBalanceUsd: number;
  availableTurboUnitBalanceUsd: number;
  availableDirectUnitBalance: number;
  availableDirectUnitBalanceUsd: number;
  setAvailableRepayBalanceUsd: (balance: number) => void;
  setAvailableTurboUnitBalance: (balance: number) => void;
  setAvailableDirectUnitBalance: (balance: number) => void;
  estimatedUsdcIn: string | null;
  estimatedSepoliaFeeEth: string | null;
  estimatedTurboUnitIn: string | null;
  estimatedTurboUnitFee: string | null;
  setRepayQuote: (estimatedUsdcIn: string | null, estimatedSepoliaFeeEth: string | null) => void;
  setTurboRepayQuote: (estimatedTurboUnitIn: string | null, estimatedTurboUnitFee: string | null) => void;
}

export interface WithdrawVaultStore extends VaultStoreState {
  withdrawAmountBtc: number;
  setWithdrawAmountBtc: (amount: number) => void;
  maxWithdrawable: number;
}

export interface VaultOperationHookState {
  isLoading: boolean;
  borrow?: () => Promise<unknown>;
  deposit?: () => Promise<unknown>;
  repay?: () => Promise<unknown>;
  withdraw?: () => Promise<unknown>;
  execute?: () => Promise<unknown>;
}

/**
 * Operation-specific amount configuration
 */
export interface AmountConfig {
  /** Current amount value */
  value: number;
  /** Set amount callback */
  setValue: (amount: number) => void;
  /** Maximum amount allowed */
  maxValue: number;
  /** Slider label */
  label: string;
  /** Whether slider uses UNIT (true) or BTC (false) */
  isUnitAmount: boolean;
  /** Display unit label for the amount control */
  displayUnitLabel?: 'UNIT' | 'USD';
  /** Whether to hide available balance on slider */
  hideAvailable?: boolean;
}

/**
 * Preview of vault state after operation
 */
export interface VaultPreview {
  newCollateral: number;
  newDebt: number;
  newHealth: number;
  newLiqPrice: number;
}

/**
 * Validation result for the operation
 */
export interface ValidationResult {
  canContinue: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Empty state configuration
 */
export interface EmptyStateConfig {
  icon: 'alert-circle-outline' | 'checkmark-circle-outline' | 'warning-outline';
  iconColor: string;
  title: string;
  subtitle?: string;
}

/**
 * Screen route configuration
 */
export interface VaultRoutes {
  input: string;
  selection?: string;
  confirm: string;
  processing: string;
  success: string;
}

/**
 * Input screen configuration
 */
export interface VaultInputScreenConfig<
  TStore extends VaultStoreState = VaultStoreState,
  TAdditionalData = unknown,
> {
  /** Operation type */
  operationType: VaultOperationType;

  /** Screen title */
  title: string;

  /** Asset being operated on */
  asset: VaultAssetType;

  /** Route names for navigation */
  routes: VaultRoutes;

  /** Get amount configuration from store state */
  getAmountConfig: (state: TStore) => AmountConfig;

  /** Compute preview values */
  computePreview: (
    amount: number,
    effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    bitcoinPrice: number | null
  ) => VaultPreview;

  /** Validate current state */
  validate: (
    amount: number,
    maxAmount: number,
    effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    preview: VaultPreview,
    hasSufficientBtcForFees: boolean,
    additionalData?: TAdditionalData
  ) => ValidationResult;

  /** Get empty state configuration */
  getEmptyState: (
    effectiveBtcLocked: number,
    effectiveUnitBorrowed: number,
    additionalData?: TAdditionalData
  ) => EmptyStateConfig | null;

  /** Whether to check for min health violation */
  checksMinHealth: boolean;

  /** VaultChangesCard action type */
  changesActionType?: 'debt' | 'collateral';
}

/**
 * Confirm screen configuration
 */
export interface VaultConfirmScreenConfig<TStore extends VaultStoreState = VaultStoreState> {
  /** Operation type */
  operationType: VaultOperationType;

  /** Screen title */
  title: string;

  /** Auth prompt message */
  authMessage: string;

  /** Route names for navigation */
  routes: VaultRoutes;

  /** Get primary amount from store */
  getPrimaryAmount: (state: TStore) => { amount: number; unit: 'BTC' | 'USD' | 'UNIT' };

  /** Execute the operation */
  executeOperation: () => Promise<{ txid: string } | null>;

  /** Get summary rows for the confirm card */
  getSummaryRows: (state: TStore, btcPrice: number | null) => SummaryRow[];
}

/**
 * Summary row in confirm screen
 */
export interface SummaryRow {
  label: string;
  currentValue: string | number;
  currentUnit?: string;
  newValue?: string | number;
  newUnit?: string;
  showArrow?: boolean;
  valueColor?: string;
  newValueColor?: string;
  badgeAsset?: VaultSettlementRequestedAsset;
}

/**
 * Processing screen configuration
 */
export interface VaultProcessingScreenConfig {
  /** Operation type */
  operationType: VaultOperationType;

  /** Screen title (e.g., "Borrowing UNIT") */
  title: string;

  /** Subtitle shown while processing */
  subtitle: string;

  /** Error subtitle */
  errorSubtitle: string;

  /** Route names for navigation */
  routes: VaultRoutes;

  /** Get status message for each step */
  getStatusMessage: (step: number) => string;
}

/**
 * Navigation prop type
 */
export type VaultScreenNavigationProp = NavigationProp<Record<string, object | undefined>>;
