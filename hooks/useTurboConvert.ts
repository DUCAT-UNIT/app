/**
 * useTurboConvert Hook
 * Handles converting on-chain UNIT to e-cash (Turbo operation)
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { releaseOrphanedUtxos } from '../utils/pendingTransactionsUtils';
import { getRunesAmount } from '../utils/runesHelper';
import type { RuneBalance } from '../services/balanceService';
import type { MinimalNavigation } from '../navigation/types';
import type { UtxoRef } from '../types/assets';

interface UseTurboConvertParams {
  runesBalance: RuneBalance[] | null;
  navigation: MinimalNavigation;
  getSpentUtxos: () => Set<string>;
  unmarkUtxosAsSpent: (utxos: UtxoRef[]) => Promise<void>;
}

interface UseTurboConvertReturn {
  handleTurboPress: () => Promise<void>;
}

export function useTurboConvert({
  runesBalance,
  navigation,
  getSpentUtxos,
  unmarkUtxosAsSpent,
}: UseTurboConvertParams): UseTurboConvertReturn {
  const handleTurboPress = useCallback(async () => {
    const unitRunesAmount = getRunesAmount(runesBalance);

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
    } catch (error: unknown) {
      Alert.alert('Error', `Failed to convert: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [runesBalance, navigation, getSpentUtxos, unmarkUtxosAsSpent]);

  return { handleTurboPress };
}
