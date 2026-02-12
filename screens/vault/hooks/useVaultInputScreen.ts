/**
 * useVaultInputScreen Hook
 * Shared logic for all vault input screens
 */

import { useEffect, useMemo, useCallback, useState } from 'react';
import { usePriceStore } from '../../../stores/priceStore';
import { useBalance, useVaultData } from '../../../contexts/WalletDataContext';
import { computeHealthFactor, computeLiquidationPrice, getOpCostOpen } from '../../../utils/vaultUtils';
import type { VaultInputScreenConfig, VaultPreview, ValidationResult, EmptyStateConfig } from '../types';

interface UseVaultInputScreenOptions {
  config: VaultInputScreenConfig;
  store: any; // The operation-specific store hook result
  loadVaultData: () => void;
  additionalData?: any; // Operation-specific additional data (e.g., unitBalance for repay)
}

interface UseVaultInputScreenResult {
  // Vault state
  effectiveBtcLocked: number;
  effectiveUnitBorrowed: number;
  vaultLoaded: boolean;
  isInitializing: boolean;
  btcPrice: number | null;

  // Amount state
  amountConfig: ReturnType<VaultInputScreenConfig['getAmountConfig']>;
  previewAmount: number;
  setPreviewAmount: (amount: number) => void;

  // Health calculations
  currentHealth: number;
  currentLiqPrice: number;
  preview: VaultPreview;
  hasChanges: boolean;

  // Fees
  selectedFeeRate: number;
  setSelectedFeeRate: (rate: number) => void;
  estimatedFeeSats: number;
  hasSufficientBtc: boolean;
  feeErrorMessage: string | null;

  // Validation
  validation: ValidationResult;

  // Empty state
  emptyState: EmptyStateConfig | null;

  // Actions
  handleClose: () => void;
  handleContinue: () => void;
  handleLiveValueChange: (value: number) => void;

  // Slider color
  sliderColor: string;
}

// Health-based slider colors (matching VaultActionGauge)
const getHealthSliderColor = (health: number): string => {
  if (health <= 160) return '#d04c68'; // red
  if (health <= 200) return '#fde37b'; // yellow
  return '#59aa8a'; // green
};

export function useVaultInputScreen(
  options: UseVaultInputScreenOptions,
  navigation: any
): UseVaultInputScreenResult {
  const { config, store, loadVaultData, additionalData } = options;

  const { btcPrice, fetchBtcPrice } = usePriceStore();
  const { segwitBalance, utxos } = useBalance();
  const { vaultData } = useVaultData();

  // Use vault data directly from context for immediate display
  const contextBtcLocked = vaultData?.totalCollateral ?? 0;
  const contextUnitBorrowed = vaultData?.totalDebt ?? 0;

  // Use context values if store hasn't synced yet
  const effectiveBtcLocked = store.currentBtcLocked > 0 ? store.currentBtcLocked : contextBtcLocked;
  const effectiveUnitBorrowed = store.currentUnitBorrowed > 0 ? store.currentUnitBorrowed : contextUnitBorrowed;

  // Track initialization
  const [isInitializing, setIsInitializing] = useState(true);

  // Consider vault loaded if we have effective data
  const hasVaultData = effectiveBtcLocked > 0 || effectiveUnitBorrowed > 0;
  const vaultLoaded = vaultData !== null || hasVaultData;

  // Get amount config from store
  const amountConfig = config.getAmountConfig(store);

  // Local preview state for real-time updates during drag
  const [previewAmount, setPreviewAmount] = useState(amountConfig.value);

  // BTC balance for fee validation
  const btcBalanceSats = Math.round((segwitBalance || 0) * 100_000_000);

  // Calculate estimated fee
  const estimatedFeeSats = useMemo(() => {
    return getOpCostOpen(store.selectedFeeRate, utxos);
  }, [store.selectedFeeRate, utxos]);

  // Check fee balance
  const hasSufficientBtc = btcBalanceSats >= estimatedFeeSats;
  const feeErrorMessage = !hasSufficientBtc
    ? btcBalanceSats === 0
      ? 'You need BTC in your wallet for transaction fees'
      : `Need ${(estimatedFeeSats / 100_000_000).toFixed(8)} BTC for fees, have ${(btcBalanceSats / 100_000_000).toFixed(8)} BTC`
    : null;

  // Sync available balance into store for deposit/withdraw operations
  useEffect(() => {
    if (store.setAvailableBalance && btcBalanceSats > 0) {
      const availableSats = Math.max(0, btcBalanceSats - estimatedFeeSats);
      store.setAvailableBalance(availableSats);
    }
  }, [btcBalanceSats, estimatedFeeSats, store.setAvailableBalance]);

  // Fetch price and load vault data
  useEffect(() => {
    if (!btcPrice) {
      fetchBtcPrice();
    }
    if (vaultData) {
      loadVaultData();
    }
  }, [btcPrice, fetchBtcPrice, vaultData, loadVaultData]);

  // Mark initialization complete
  useEffect(() => {
    if (vaultLoaded && isInitializing) {
      const timer = setTimeout(() => setIsInitializing(false), 50);
      return () => clearTimeout(timer);
    }
  }, [vaultLoaded, isInitializing]);

  // Sync preview amount when store value changes
  useEffect(() => {
    setPreviewAmount(amountConfig.value);
  }, [amountConfig.value]);

  // Compute current health
  const currentHealth = useMemo(() => {
    if (!btcPrice || effectiveBtcLocked <= 0 || effectiveUnitBorrowed <= 0) return 0;
    return computeHealthFactor(effectiveBtcLocked, btcPrice, effectiveUnitBorrowed);
  }, [btcPrice, effectiveBtcLocked, effectiveUnitBorrowed]);

  const currentLiqPrice = useMemo(() => {
    if (effectiveBtcLocked <= 0 || effectiveUnitBorrowed <= 0) return 0;
    return computeLiquidationPrice(effectiveUnitBorrowed, effectiveBtcLocked);
  }, [effectiveBtcLocked, effectiveUnitBorrowed]);

  // Preview calculations
  const preview = useMemo(() => {
    return config.computePreview(previewAmount, effectiveBtcLocked, effectiveUnitBorrowed, btcPrice);
  }, [config, previewAmount, effectiveBtcLocked, effectiveUnitBorrowed, btcPrice]);

  const hasChanges = previewAmount > 0;

  // Validation
  const validation = useMemo(() => {
    return config.validate(
      amountConfig.value,
      amountConfig.maxValue,
      effectiveBtcLocked,
      effectiveUnitBorrowed,
      preview,
      hasSufficientBtc,
      additionalData
    );
  }, [config, amountConfig.value, amountConfig.maxValue, effectiveBtcLocked, effectiveUnitBorrowed, preview, hasSufficientBtc, additionalData]);

  // Empty state
  const emptyState = useMemo(() => {
    if (!vaultLoaded) return null;
    return config.getEmptyState(effectiveBtcLocked, effectiveUnitBorrowed, additionalData);
  }, [config, vaultLoaded, effectiveBtcLocked, effectiveUnitBorrowed, additionalData]);

  // Slider color
  const sliderColor = getHealthSliderColor(hasChanges ? preview.newHealth : currentHealth);

  // Actions
  const handleClose = useCallback(() => {
    store.reset();
    navigation.getParent()?.goBack();
  }, [store, navigation]);

  const handleContinue = useCallback(() => {
    if (!validation.canContinue) return;
    store.setCurrentStep('confirm');
    navigation.navigate(config.routes.confirm);
  }, [validation.canContinue, store, navigation, config.routes.confirm]);

  const handleLiveValueChange = useCallback((val: number) => {
    setPreviewAmount(val);
  }, []);

  return {
    // Vault state
    effectiveBtcLocked,
    effectiveUnitBorrowed,
    vaultLoaded,
    isInitializing,
    btcPrice,

    // Amount state
    amountConfig,
    previewAmount,
    setPreviewAmount,

    // Health calculations
    currentHealth,
    currentLiqPrice,
    preview,
    hasChanges,

    // Fees
    selectedFeeRate: store.selectedFeeRate,
    setSelectedFeeRate: store.setSelectedFeeRate,
    estimatedFeeSats,
    hasSufficientBtc,
    feeErrorMessage,

    // Validation
    validation,

    // Empty state
    emptyState,

    // Actions
    handleClose,
    handleContinue,
    handleLiveValueChange,

    // Slider color
    sliderColor,
  };
}
