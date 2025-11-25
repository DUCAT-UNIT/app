/**
 * useTurboConvert Hook
 * Handles converting on-chain UNIT to e-cash (Turbo operation)
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { releaseOrphanedUtxos } from '../utils/pendingTransactionsUtils';

export function useTurboConvert({
  runesBalance,
  navigation,
  getSpentUtxos,
  unmarkUtxosAsSpent,
}) {
  const handleTurboPress = useCallback(async () => {
    const unitRunesAmount = runesBalance && runesBalance.length > 0
      ? parseFloat(runesBalance[0][1])
      : 0;

    if (unitRunesAmount === 0) {
      Alert.alert('No On-chain UNIT', 'You don\'t have any on-chain UNIT to convert.');
      return;
    }

    // Clear any stuck spent UTXOs before starting
    await releaseOrphanedUtxos(getSpentUtxos, unmarkUtxosAsSpent);

    try {
      const { requestMint } = await import('../services/cashu/cashuWalletService');

      // Request mint quote
      const mintQuote = await requestMint(unitRunesAmount);

      // Navigate to TurboLoading screen
      navigation.navigate('SendFlow', {
        screen: 'TurboLoading',
        params: {
          assetType: 'unit',
          prefillAddress: mintQuote.depositAddress,
          prefillAmount: unitRunesAmount,
          mintQuoteId: mintQuote.quoteId,
          mintAmount: unitRunesAmount,
          isTurbo: true,
        }
      });
    } catch (error) {
      Alert.alert('Error', `Failed to convert: ${error.message}`);
    }
  }, [runesBalance, navigation, getSpentUtxos, unmarkUtxosAsSpent]);

  return { handleTurboPress };
}
