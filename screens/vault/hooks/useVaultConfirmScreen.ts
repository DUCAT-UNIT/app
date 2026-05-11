/**
 * useVaultConfirmScreen Hook
 * Shared logic for all vault confirm screens
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useSettingsHandlers } from '../../../contexts/NavigationHandlersContext';
import { useBalance } from '../../../contexts/WalletDataContext';
import { authenticateWithBiometrics } from '../../../services/biometricService';
import { verifyPin } from '../../../services/pinService';
import {
  requiresVaultSettlementUnitSend,
  resolveVaultSettlementRequestedAsset,
  type VaultSettlementRequestedAsset,
} from '../../../stores/vaultSettlementStore';
import { usePrice } from '../../../stores/priceStore';
import {
  getOpCostBorrow,
  getOpCostDeposit,
  getOpCostOpen,
  getOpCostRepay,
  getVaultSettlementReserveSats,
} from '../../../utils/vaultUtils';
import { isE2E } from '../../../utils/e2e';
import { dismissVaultActionFlow } from '../navigation';
import type {
  SummaryRow,
  VaultConfirmScreenConfig,
  VaultOperationHookState,
  VaultScreenNavigationProp,
  VaultStoreState,
} from '../types';

interface UseVaultConfirmScreenOptions<
  TStore extends VaultStoreState,
  THook extends VaultOperationHookState,
> {
  config: VaultConfirmScreenConfig<TStore>;
  store: TStore;
  vaultHook: THook;
}

interface UseVaultConfirmScreenResult {
  // Primary amount display
  primaryAmount: { amount: number; unit: string };

  // Summary rows for display
  summaryRows: SummaryRow[];

  // Fee information
  estimatedFeeSats: number;
  feeUsdValue: number;
  selectedFeeRate: number;

  // State
  isAuthenticating: boolean;
  isSubmitting: boolean;
  showPinFallback: boolean;
  pinFallbackError: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  handleConfirm: () => Promise<void>;
  handlePinFallbackSubmit: (pin: string) => Promise<void>;
  handlePinFallbackCancel: () => void;
  handleClose: () => void;
  handleBack: () => void;
}

function getReceiveAssetIfPresent(store: VaultStoreState): VaultSettlementRequestedAsset | null {
  return 'receiveAsset' in store
    ? ((store as { receiveAsset?: VaultSettlementRequestedAsset }).receiveAsset ?? null)
    : null;
}

export function useVaultConfirmScreen<
  TStore extends VaultStoreState,
  THook extends VaultOperationHookState,
>(
  options: UseVaultConfirmScreenOptions<TStore, THook>,
  navigation: VaultScreenNavigationProp
): UseVaultConfirmScreenResult {
  const { config, store, vaultHook } = options;

  const { btcPrice } = usePrice();
  const { settingsHandlers } = useSettingsHandlers();
  const usdcFeaturesEnabled = settingsHandlers.usdcFeaturesEnabled;
  const { utxos } = useBalance();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [pinFallbackError, setPinFallbackError] = useState<string | null>(null);
  const confirmInFlightRef = useRef(false);

  // Primary amount from config
  const primaryAmount = config.getPrimaryAmount(store);

  // Summary rows from config
  const summaryRows = config.getSummaryRows(store, btcPrice);
  const selectedFeeRate = store.selectedFeeRate;
  const storedReceiveAsset = getReceiveAssetIfPresent(store);
  const receiveAsset = storedReceiveAsset
    ? resolveVaultSettlementRequestedAsset(storedReceiveAsset, usdcFeaturesEnabled)
    : null;

  // Dynamic fee calculation
  const estimatedFeeSats = useMemo(() => {
    let baseFee = 0;
    switch (config.operationType) {
      case 'borrow':
        baseFee = getOpCostBorrow(selectedFeeRate, utxos);
        break;
      case 'repay':
        baseFee = getOpCostRepay(selectedFeeRate, utxos);
        break;
      case 'deposit':
        baseFee = getOpCostDeposit(selectedFeeRate, utxos);
        break;
      case 'withdraw':
        baseFee = 0;
        break;
      default:
        baseFee = getOpCostOpen(selectedFeeRate, utxos);
        break;
    }
    const settlementReserve =
      config.operationType === 'borrow' && requiresVaultSettlementUnitSend(receiveAsset)
        ? getVaultSettlementReserveSats(selectedFeeRate)
        : 0;
    return Math.max(0, Math.ceil(baseFee + settlementReserve));
  }, [config.operationType, receiveAsset, selectedFeeRate, utxos]);

  const feeUsdValue = btcPrice ? (estimatedFeeSats / 100_000_000) * btcPrice : 0;

  const executeVaultOperation = useCallback(async (): Promise<void> => {
    setIsAuthenticating(false);
    store.setCurrentStep('processing');
    navigation.navigate(config.routes.processing);

    const executeOp = getOperationExecutor(vaultHook, config.operationType);
    if (executeOp) {
      await executeOp();
    }
  }, [config.operationType, config.routes.processing, navigation, store, vaultHook]);

  const handleAuthFailure = useCallback((errorMessage?: string): void => {
    if (errorMessage === 'user_cancel') {
      return;
    }

    setPinFallbackError(null);
    setShowPinFallback(true);
  }, []);

  const handlePinFallbackSubmit = useCallback(
    async (pin: string): Promise<void> => {
      if (confirmInFlightRef.current) {
        return;
      }

      confirmInFlightRef.current = true;
      setPinFallbackError(null);
      setIsSubmitting(true);

      try {
        const pinResult = await verifyPin(pin);
        if (!pinResult.success) {
          setPinFallbackError(pinResult.error);
          return;
        }

        setShowPinFallback(false);
        await executeVaultOperation();
      } catch (err) {
        setIsAuthenticating(false);
        Alert.alert('Error', `Failed to complete ${config.operationType}. Please try again.`);
      } finally {
        setIsSubmitting(false);
        confirmInFlightRef.current = false;
      }
    },
    [config.operationType, executeVaultOperation]
  );

  const handlePinFallbackCancel = useCallback((): void => {
    if (isSubmitting) {
      return;
    }

    setPinFallbackError(null);
    setShowPinFallback(false);
  }, [isSubmitting]);

  // Handle confirm with biometric authentication
  const handleConfirm = useCallback(async () => {
    if (confirmInFlightRef.current) {
      return;
    }

    confirmInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      setIsAuthenticating(true);

      if (!isE2E()) {
        const result = await authenticateWithBiometrics(config.authMessage, 'Use PIN');

        if (!result.success) {
          handleAuthFailure(result.error);
          return;
        }
      }

      await executeVaultOperation();
    } catch (err) {
      setIsAuthenticating(false);
      Alert.alert('Error', `Failed to complete ${config.operationType}. Please try again.`);
    } finally {
      setIsSubmitting(false);
      confirmInFlightRef.current = false;
    }
  }, [config.authMessage, config.operationType, executeVaultOperation, handleAuthFailure]);

  const handleBack = useCallback(() => {
    store.setCurrentStep(config.routes.selection ? 'payout' : 'input');
    navigation.goBack();
  }, [config.routes.selection, store, navigation]);

  const handleClose = useCallback(() => {
    store.reset();
    dismissVaultActionFlow(navigation);
  }, [store, navigation]);

  return {
    // Primary amount
    primaryAmount,

    // Summary
    summaryRows,

    // Fees
    estimatedFeeSats,
    feeUsdValue,
    selectedFeeRate,

    // State
    isAuthenticating,
    isSubmitting,
    showPinFallback,
    pinFallbackError,
    isLoading: vaultHook.isLoading,
    error: store.error,

    // Actions
    handleConfirm,
    handlePinFallbackSubmit,
    handlePinFallbackCancel,
    handleClose,
    handleBack,
  };
}

// Get the typed operation executor from the hook state
function getOperationExecutor(
  hook: VaultOperationHookState,
  operationType: string
): (() => Promise<unknown>) | undefined {
  switch (operationType) {
    case 'borrow':
      return hook.borrow;
    case 'deposit':
      return hook.deposit;
    case 'repay':
      return hook.repay;
    case 'withdraw':
      return hook.withdraw;
    default:
      return hook.execute;
  }
}
