/**
 * useVaultInputScreen Hook
 * Shared logic for all vault input screens
 */

import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { useSettingsHandlers } from '../../../contexts/NavigationHandlersContext';
import { useBalance,useVaultData } from '../../../contexts/WalletDataContext';
import {
  requiresVaultSettlementUnitSend,
  resolveVaultSettlementRequestedAsset,
  type VaultSettlementRequestedAsset,
} from '../../../stores/vaultSettlementStore';
import { usePriceStore } from '../../../stores/priceStore';
import {
  computeHealthFactor,
  computeLiquidationPrice,
  getOpCostBorrow,
  getOpCostDeposit,
  getOpCostRepay,
  getVaultSettlementReserveSats,
} from '../../../utils/vaultUtils';
import { dismissVaultActionFlow } from '../navigation';
import type {
  AmountConfig,
  DepositVaultStore,
  EmptyStateConfig,
  ValidationResult,
  VaultInputScreenConfig,
  VaultPreview,
  VaultScreenNavigationProp,
  VaultStoreState,
} from '../types';

interface UseVaultInputScreenOptions<TStore extends VaultStoreState, TAdditionalData = unknown> {
  config: VaultInputScreenConfig<TStore, TAdditionalData>;
  store: TStore;
  loadVaultData: () => void;
  additionalData?: TAdditionalData;
}

interface UseVaultInputScreenResult {
  // Vault state
  effectiveBtcLocked: number;
  effectiveUnitBorrowed: number;
  vaultLoaded: boolean;
  isInitializing: boolean;
  isContinuing: boolean;
  btcPrice: number | null;

  // Amount state
  amountConfig: AmountConfig;
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

function getReceiveAssetIfPresent(store: VaultStoreState): VaultSettlementRequestedAsset | null {
  return 'receiveAsset' in store
    ? ((store as { receiveAsset?: VaultSettlementRequestedAsset }).receiveAsset ?? null)
    : null;
}

export function useVaultInputScreen<TStore extends VaultStoreState, TAdditionalData = unknown>(
  options: UseVaultInputScreenOptions<TStore, TAdditionalData>,
  navigation: VaultScreenNavigationProp
): UseVaultInputScreenResult {
  const { config, store, loadVaultData, additionalData } = options;

  const { btcPrice, fetchBtcPrice } = usePriceStore();
  const { settingsHandlers } = useSettingsHandlers();
  const usdcFeaturesEnabled = settingsHandlers.usdcFeaturesEnabled;
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
  const [isContinuing, setIsContinuing] = useState(false);
  const continueUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Consider vault loaded if we have effective data
  const hasVaultData = effectiveBtcLocked > 0 || effectiveUnitBorrowed > 0;
  const vaultLoaded = vaultData !== null || hasVaultData;

  // Get amount config from store
  const amountConfig = config.getAmountConfig(store);

  // Local preview state for real-time updates during drag
  const [previewAmount, setPreviewAmount] = useState(amountConfig.value);

  // BTC balance for fee validation
  const btcBalanceSats = Math.round((segwitBalance || 0) * 100_000_000);
  const storedReceiveAsset = getReceiveAssetIfPresent(store);
  const receiveAsset = storedReceiveAsset
    ? resolveVaultSettlementRequestedAsset(storedReceiveAsset, usdcFeaturesEnabled)
    : null;

  // Calculate estimated fee
  const estimatedFeeSats = useMemo(() => {
    switch (config.operationType) {
      case 'borrow':
        return getOpCostBorrow(store.selectedFeeRate, utxos) +
          (requiresVaultSettlementUnitSend(receiveAsset) ? getVaultSettlementReserveSats(store.selectedFeeRate) : 0);
      case 'repay':
        return getOpCostRepay(store.selectedFeeRate, utxos);
      case 'deposit':
        return getOpCostDeposit(store.selectedFeeRate, utxos);
      case 'withdraw':
        // Withdraw spends from the vault itself and does not require separate
        // wallet sats funding.
        return 0;
      default:
        return 0;
    }
  }, [config.operationType, receiveAsset, store.selectedFeeRate, utxos]);

  // Check fee balance
  const hasSufficientBtc = btcBalanceSats >= estimatedFeeSats;
  const feeErrorMessage = !hasSufficientBtc
    ? btcBalanceSats === 0
      ? 'You need BTC in your wallet for transaction fees'
      : `Need ${(estimatedFeeSats / 100_000_000).toFixed(8)} BTC for fees, have ${(btcBalanceSats / 100_000_000).toFixed(8)} BTC`
    : null;
  const setAvailableBalance = (store as Partial<DepositVaultStore>).setAvailableBalance;

  // Sync available balance into store for deposit/withdraw operations
  useEffect(() => {
    if (setAvailableBalance && btcBalanceSats > 0) {
      const availableSats = Math.max(0, btcBalanceSats - estimatedFeeSats);
      setAvailableBalance(availableSats);
    }
  }, [btcBalanceSats, estimatedFeeSats, setAvailableBalance]);

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

  useEffect(() => () => {
    if (continueUnlockTimerRef.current) {
      clearTimeout(continueUnlockTimerRef.current);
      continueUnlockTimerRef.current = null;
    }
  }, []);

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
    dismissVaultActionFlow(navigation);
  }, [store, navigation]);

  const handleContinue = useCallback(() => {
    if (!validation.canContinue || isContinuing) return;
    setIsContinuing(true);
    if (continueUnlockTimerRef.current) {
      clearTimeout(continueUnlockTimerRef.current);
    }
    continueUnlockTimerRef.current = setTimeout(() => {
      continueUnlockTimerRef.current = null;
      setIsContinuing(false);
    }, 900);
    (continueUnlockTimerRef.current as { unref?: () => void }).unref?.();

    if (storedReceiveAsset && receiveAsset && storedReceiveAsset !== receiveAsset && 'setReceiveAsset' in store) {
      (store as { setReceiveAsset: (asset: VaultSettlementRequestedAsset) => void }).setReceiveAsset(receiveAsset);
    }
    if (config.routes.selection) {
      store.setCurrentStep('payout');
      navigation.navigate(config.routes.selection);
      return;
    }
    store.setCurrentStep('confirm');
    navigation.navigate(config.routes.confirm);
  }, [validation.canContinue, isContinuing, storedReceiveAsset, receiveAsset, store, navigation, config.routes.selection, config.routes.confirm]);

  const handleLiveValueChange = useCallback((val: number) => {
    setPreviewAmount(val);
  }, []);

  return {
    // Vault state
    effectiveBtcLocked,
    effectiveUnitBorrowed,
    vaultLoaded,
    isInitializing,
    isContinuing,
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
