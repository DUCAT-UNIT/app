/**
 * useVaultConfirmScreen Hook
 * Shared logic for all vault confirm screens
 */

import { useState, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { usePrice } from '../../../stores/priceStore';
import { useBalance } from '../../../contexts/WalletDataContext';
import { getOpCostOpen } from '../../../utils/vaultUtils';
import type { VaultConfirmScreenConfig, SummaryRow } from '../types';

interface UseVaultConfirmScreenOptions {
  config: VaultConfirmScreenConfig;
  store: any; // Operation-specific store hook result
  vaultHook: any; // Operation-specific vault hook result (e.g., useBorrowVault)
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
  isLoading: boolean;
  error: string | null;

  // Actions
  handleConfirm: () => Promise<void>;
  handleBack: () => void;
}

export function useVaultConfirmScreen(
  options: UseVaultConfirmScreenOptions,
  navigation: any
): UseVaultConfirmScreenResult {
  const { config, store, vaultHook } = options;

  const { btcPrice } = usePrice();
  const { utxos } = useBalance();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Primary amount from config
  const primaryAmount = config.getPrimaryAmount(store);

  // Summary rows from config
  const summaryRows = config.getSummaryRows(store, btcPrice);

  // Dynamic fee calculation
  const estimatedFeeSats = useMemo(() => {
    return getOpCostOpen(store.selectedFeeRate, utxos);
  }, [store.selectedFeeRate, utxos]);

  const feeUsdValue = btcPrice ? (estimatedFeeSats / 100_000_000) * btcPrice : 0;

  // Handle confirm with biometric authentication
  const handleConfirm = useCallback(async () => {
    try {
      setIsAuthenticating(true);

      // Skip biometric auth in E2E mode
      const isE2E = __DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true';

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!isE2E && hasHardware && isEnrolled) {
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
          return;
        }
      }

      setIsAuthenticating(false);
      store.setCurrentStep('processing');
      navigation.navigate(config.routes.processing);

      // Execute the operation - the hook internally sets store.vaultTxid and store.currentStep
      // The VaultProcessingScreen watches these store values and navigates to success
      const executeOp = vaultHook[getOperationFunction(config.operationType)];
      if (executeOp) {
        await executeOp();
      }
    } catch (err) {
      setIsAuthenticating(false);
      Alert.alert('Error', `Failed to complete ${config.operationType}. Please try again.`);
    }
  }, [config, store, vaultHook, navigation]);

  const handleBack = useCallback(() => {
    store.setCurrentStep('input');
    navigation.goBack();
  }, [store, navigation]);

  return {
    // Primary amount
    primaryAmount,

    // Summary
    summaryRows,

    // Fees
    estimatedFeeSats,
    feeUsdValue,
    selectedFeeRate: store.selectedFeeRate,

    // State
    isAuthenticating,
    isLoading: vaultHook.isLoading,
    error: store.error,

    // Actions
    handleConfirm,
    handleBack,
  };
}

// Map operation type to the correct hook function name
function getOperationFunction(operationType: string): string {
  switch (operationType) {
    case 'borrow':
      return 'borrowMore';
    case 'deposit':
      return 'deposit';
    case 'repay':
      return 'repay';
    case 'withdraw':
      return 'withdraw';
    default:
      return 'execute';
  }
}
