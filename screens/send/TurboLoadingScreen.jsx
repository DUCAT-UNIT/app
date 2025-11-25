/**
 * TurboLoadingScreen - Loading screen for Turbo mode
 * Shows while preparing the transaction
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { COLORS } from '../../theme';
import { useSendFlow } from '../../contexts/SendFlowContext';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { usePendingTransactions } from '../../contexts/PendingTransactionsContext';
import { logger } from '../../utils/logger';
import { releaseOrphanedUtxos } from '../../utils/pendingTransactionsUtils';

export default function TurboLoadingScreen({ navigation, route }) {
  const { prefillAddress, prefillAmount, assetType, isTurbo, mintQuoteId, mintAmount } = route.params || {};
  const { setSendAssetType, setSendAmount, setSendRecipient, setRequireConfirmedUtxos, intentStep, resetSendFlow, sendAssetType: currentAssetType, sendAmount: currentAmount, sendRecipient: currentRecipient } = useSendFlow();
  const { createSendIntent, sendIntent } = useTransactionBuild();
  const { getSpentUtxos, unmarkUtxosAsSpent } = usePendingTransactions();
  const hasStarted = useRef(false);
  const hasNavigated = useRef(false);
  const errorTimeout = useRef(null);
  const intentCreated = useRef(false);
  const stateInitialized = useRef(false);

  // Reset refs when component mounts with new params
  useEffect(() => {
    hasStarted.current = false;
    hasNavigated.current = false;
    intentCreated.current = false;
    stateInitialized.current = false;
  }, [prefillAddress, prefillAmount, assetType]);

  // Set the send flow values - this happens once when the component mounts
  useEffect(() => {
    if (!hasStarted.current && assetType && prefillAmount !== undefined && prefillAddress) {
      hasStarted.current = true;
      logger.debug('[TurboLoading] Setting state:', { assetType, prefillAmount, prefillAddress });

      // Set send flow values
      setSendAssetType(assetType);
      setSendAmount(prefillAmount.toString());
      setSendRecipient(prefillAddress);
      setRequireConfirmedUtxos(true); // Turbo requires confirmed UTXOs only
    }
  }, [assetType, prefillAmount, prefillAddress, setSendAssetType, setSendAmount, setSendRecipient, setRequireConfirmedUtxos]);

  // Watch for state to be initialized, then create intent
  // This ensures the state has been updated before we call createSendIntent
  useEffect(() => {
    logger.debug('[TurboLoading] State check:', {
      hasStarted: hasStarted.current,
      stateInitialized: stateInitialized.current,
      currentAssetType,
      currentAmount,
      currentRecipient
    });

    // Check that all required state values are set (allow "0" or any numeric string for amount)
    if (hasStarted.current && !stateInitialized.current && currentAssetType && currentAmount !== '' && currentAmount !== null && currentRecipient) {
      logger.debug('[TurboLoading] Creating intent...');
      // State is now initialized, create the intent
      stateInitialized.current = true;
      createSendIntent();
    }
  }, [currentAssetType, currentAmount, currentRecipient, createSendIntent]);

  // Watch for intent creation to complete
  useEffect(() => {
    logger.debug('[TurboLoading] Intent watch:', {
      hasStarted: hasStarted.current,
      hasNavigated: hasNavigated.current,
      stateInitialized: stateInitialized.current,
      intentStep,
      hasSendIntent: !!sendIntent
    });

    // Only proceed if we've started and haven't navigated yet
    if (!hasStarted.current || hasNavigated.current) {
      return;
    }

    // Success case: intent created and ready for review
    if (intentStep === 'reviewing' && sendIntent) {
      logger.debug('[TurboLoading] Navigating to Review...');
      hasNavigated.current = true;
      intentCreated.current = true;
      if (errorTimeout.current) {
        clearTimeout(errorTimeout.current);
      }
      navigation.replace('Review', {
        isTurbo,
        mintQuoteId,
        mintAmount,
      });
    }
    // Error case: went back to entering_amount step (validation failed)
    else if (stateInitialized.current && intentStep === 'entering_amount') {
      logger.debug('[TurboLoading] Error detected, showing alert...');
      // Error - show alert and go back
      hasNavigated.current = true;
      if (errorTimeout.current) {
        clearTimeout(errorTimeout.current);
      }

      // Clean up any stuck UTXOs before showing error
      const cleanupAndShowError = async () => {
        await releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent);

        // Reset send flow to clear any stale state
        resetSendFlow();

        const parent = navigation.getParent();
        Alert.alert(
          'Unable to Convert',
          'Failed to create transaction. Your UTXOs may be temporarily locked. Please try again in a moment.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (parent) {
                  parent.goBack();
                }
              }
            }
          ]
        );
      };

      cleanupAndShowError();
    }
  }, [intentStep, sendIntent, navigation, isTurbo, getSpentUtxos, unmarkUtxosAsSpent, mintQuoteId, mintAmount, resetSendFlow]);

  // Set a timeout to detect if intent creation is taking too long
  useEffect(() => {
    if (hasStarted.current && !hasNavigated.current) {
      errorTimeout.current = setTimeout(async () => {
        if (!hasNavigated.current) {
          hasNavigated.current = true;

          // Clean up any stuck UTXOs
          await releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent);

          // Reset send flow
          resetSendFlow();

          const parent = navigation.getParent();
          Alert.alert(
            'Taking Too Long',
            'Transaction creation is taking longer than expected. Please try again.',
            [
              {
                text: 'OK',
                onPress: () => {
                  if (parent) {
                    parent.goBack();
                  }
                }
              }
            ]
          );
        }
      }, 10000); // 10 second timeout

      return () => {
        if (errorTimeout.current) {
          clearTimeout(errorTimeout.current);
        }
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup effect: Release UTXOs if component unmounts before transaction is created
  useEffect(() => {
    return () => {
      // Only cleanup if we started but didn't successfully create an intent
      if (hasStarted.current && !intentCreated.current) {
        const cleanup = async () => {
          await releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent);
          resetSendFlow();
        };
        cleanup();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
      <Text style={styles.loadingText}>Preparing to fall off the map</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.VERY_LIGHT_GRAY,
  },
});
