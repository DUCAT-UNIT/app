/**
 * SpectreLoadingScreen - Loading screen for Spectre mode
 * Shows while preparing the transaction
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { COLORS } from '../../theme';
import { useSendFlow } from '../../contexts/SendFlowContext';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { usePendingTransactions } from '../../contexts/PendingTransactionsContext';

export default function SpectreLoadingScreen({ navigation, route }) {
  const { prefillAddress, prefillAmount, assetType, isSpectre, mintQuoteId, mintAmount } = route.params || {};
  const { setSendAssetType, setSendAmount, setSendRecipient, setRequireConfirmedUtxos, intentStep } = useSendFlow();
  const { createSendIntent, sendIntent } = useTransactionBuild();
  const { getSpentUtxos, unmarkUtxosAsSpent } = usePendingTransactions();
  const hasStarted = useRef(false);
  const hasNavigated = useRef(false);
  const errorTimeout = useRef(null);

  // Set the send flow values and create intent immediately
  useEffect(() => {
    if (!hasStarted.current && assetType && prefillAmount && prefillAddress) {
      hasStarted.current = true;

      // Set send flow values synchronously
      setSendAssetType(assetType);
      setSendAmount(prefillAmount.toString());
      setSendRecipient(prefillAddress);
      setRequireConfirmedUtxos(true); // Spectre requires confirmed UTXOs only

      // Create intent on next tick to allow state updates to process
      // This prevents race conditions with UTXO locking
      setTimeout(() => {
        createSendIntent();
      }, 0);
    }
  }, [assetType, prefillAmount, prefillAddress, setSendAssetType, setSendAmount, setSendRecipient, setRequireConfirmedUtxos, createSendIntent]);

  // Watch for intent creation to complete
  useEffect(() => {
    if (hasStarted.current && !hasNavigated.current) {
      if (intentStep === 'reviewing' && sendIntent) {
        // Success - navigate to review screen
        hasNavigated.current = true;
        if (errorTimeout.current) {
          clearTimeout(errorTimeout.current);
        }
        navigation.replace('Review', {
          isSpectre,
          mintQuoteId,
          mintAmount,
        });
      } else if (intentStep === 'entering_amount') {
        // Error - show alert and go back
        hasNavigated.current = true;
        if (errorTimeout.current) {
          clearTimeout(errorTimeout.current);
        }

        // Clean up any stuck UTXOs before showing error
        const cleanupAndShowError = async () => {
          const currentSpent = getSpentUtxos();
          if (currentSpent.size > 0) {
            await unmarkUtxosAsSpent(Array.from(currentSpent).map(key => {
              const [txid, vout] = key.split(':');
              return { txid, vout: parseInt(vout) };
            }));
          }

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
    }
  }, [intentStep, sendIntent, navigation, isSpectre]);

  // Set a timeout to detect if intent creation is taking too long
  useEffect(() => {
    if (hasStarted.current && !hasNavigated.current) {
      errorTimeout.current = setTimeout(async () => {
        if (!hasNavigated.current) {
          hasNavigated.current = true;

          // Clean up any stuck UTXOs
          const currentSpent = getSpentUtxos();
          if (currentSpent.size > 0) {
            await unmarkUtxosAsSpent(Array.from(currentSpent).map(key => {
              const [txid, vout] = key.split(':');
              return { txid, vout: parseInt(vout) };
            }));
          }

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
  }, [hasStarted.current, navigation, getSpentUtxos, unmarkUtxosAsSpent]);

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
