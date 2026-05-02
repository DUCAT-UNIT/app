/**
 * useVaultConfirmScreen Hook
 * Shared logic for all vault confirm screens
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback,useMemo,useRef,useState } from 'react';
import { Alert } from 'react-native';
import { useSettingsHandlers } from '../../../contexts/NavigationHandlersContext';
import { useBalance } from '../../../contexts/WalletDataContext';
import type { VaultSettlementRequestedAsset } from '../../../stores/vaultSettlementStore';
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
  isLoading: boolean;
  error: string | null;

  // Actions
  handleConfirm: () => Promise<void>;
  handleClose: () => void;
  handleBack: () => void;
}

function getReceiveAssetIfPresent(store: VaultStoreState): VaultSettlementRequestedAsset | null {
  return 'receiveAsset' in store
    ? ((store as { receiveAsset?: VaultSettlementRequestedAsset }).receiveAsset ?? null)
    : null;
}

export function useVaultConfirmScreen<TStore extends VaultStoreState, THook extends VaultOperationHookState>(
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
  const confirmInFlightRef = useRef(false);

  // Primary amount from config
  const primaryAmount = config.getPrimaryAmount(store);

  // Summary rows from config
  const summaryRows = config.getSummaryRows(store, btcPrice);
  const selectedFeeRate = store.selectedFeeRate;
  const storedReceiveAsset = getReceiveAssetIfPresent(store);
  const receiveAsset = usdcFeaturesEnabled ? storedReceiveAsset : storedReceiveAsset ? 'UNIT' : null;

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
      config.operationType === 'borrow' && receiveAsset === 'USDC'
        ? getVaultSettlementReserveSats(selectedFeeRate)
        : 0;
    return baseFee + settlementReserve;
  }, [config.operationType, receiveAsset, selectedFeeRate, utxos]);

  const feeUsdValue = btcPrice ? (estimatedFeeSats / 100_000_000) * btcPrice : 0;

  // Handle confirm with biometric authentication
  const handleConfirm = useCallback(async () => {
    if (confirmInFlightRef.current) {
      return;
    }

    confirmInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      setIsAuthenticating(true);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!isE2E() && hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: config.authMessage,
          fallbackLabel: 'Use PIN',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });

        if (!result.success) {
          if (result.error !== 'user_cancel') {
            Alert.alert('Authentication Failed', 'Please try again');
          }
          setIsAuthenticating(false);
          setIsSubmitting(false);
          confirmInFlightRef.current = false;
          return;
        }
      }

      setIsAuthenticating(false);
      store.setCurrentStep('processing');
      navigation.navigate(config.routes.processing);

      // Execute the vault operation
      const executeOp = getOperationExecutor(vaultHook, config.operationType);
      if (executeOp) {
        await executeOp();
      }
    } catch (err) {
      setIsAuthenticating(false);
      Alert.alert('Error', `Failed to complete ${config.operationType}. Please try again.`);
    } finally {
      setIsSubmitting(false);
      confirmInFlightRef.current = false;
    }
  }, [config, store, vaultHook, navigation]);

  const handleBack = useCallback(() => {
    store.setCurrentStep(config.routes.selection && usdcFeaturesEnabled ? 'payout' : 'input');
    navigation.goBack();
  }, [config.routes.selection, store, navigation, usdcFeaturesEnabled]);

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
    isLoading: vaultHook.isLoading,
    error: store.error,

    // Actions
    handleConfirm,
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
