/**
 * useFuseEcash Hook
 * Handles converting e-cash to on-chain UNIT (Fuse operation)
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { logger } from '../utils/logger';
import { requestMelt, completeMeltWithoutCleanup, cleanupMeltProofs } from '../services/cashu/cashuWalletService';

interface TransactionOutput {
  scriptpubkey_address?: string;
}

interface TransactionStatus {
  block_time?: number;
}

interface Transaction {
  txid: string;
  vout?: TransactionOutput[];
  status?: TransactionStatus;
}

interface UseFuseEcashParams {
  cashuBalance: number;
  taprootAddress: string;
  transactionHistory: Transaction[] | unknown[];
  fetchTransactionHistory: () => Promise<void> | void;
}

interface UseFuseEcashReturn {
  handleFusePress: () => Promise<void>;
}

export function useFuseEcash({
  cashuBalance,
  taprootAddress,
  transactionHistory,
  fetchTransactionHistory,
}: UseFuseEcashParams): UseFuseEcashReturn {
  const handleFusePress = useCallback(async () => {
    if (cashuBalance === 0) {
      Alert.alert('No E-cash', 'You don\'t have any e-cash to fuse.');
      return;
    }

    Alert.alert(
      'Fuse E-cash to UNIT?',
      `Convert all ${cashuBalance.toFixed(2)} tUNIT to on-chain UNIT?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fuse',
          onPress: async () => {
            try {
              // Request melt quote
              const quote = await requestMelt(taprootAddress, cashuBalance);

              // Complete melt but keep proofs until we see the tx
              const meltResult = await completeMeltWithoutCleanup(quote.quoteId, quote.total);

              // Clean up proofs immediately after successful melt
              logger.debug('[Fuse] Melt successful, cleaning up proofs');
              await cleanupMeltProofs(meltResult.proofsToRemove, meltResult.changeProofs);

              Alert.alert('Processing', 'Waiting for transaction to appear on-chain...');

              // Poll for transaction
              let txFound = false;
              let attempts = 0;
              const maxAttempts = 30;

              while (!txFound && attempts < maxAttempts) {
                attempts++;
                logger.debug(`[Fuse] Polling attempt ${attempts}/${maxAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 2000));

                await fetchTransactionHistory();

                txFound = transactionHistory.some((rawTx) => {
                  const tx = rawTx as Transaction;
                  const hasOurAddress = tx.vout?.some((output: TransactionOutput) =>
                    output.scriptpubkey_address === taprootAddress
                  );
                  if (!hasOurAddress) return false;

                  const txTime = tx.status?.block_time;
                  if (!txTime) {
                    logger.debug(`[Fuse] Found unconfirmed transaction: ${tx.txid}`);
                    return true;
                  }

                  const now = Math.floor(Date.now() / 1000);
                  return (now - txTime) < 120;
                });

                if (txFound) break;
              }

              await fetchTransactionHistory();

              if (txFound) {
                Alert.alert('Success', 'E-cash successfully fused to on-chain UNIT!');
              } else {
                Alert.alert(
                  'Pending',
                  'Melt completed successfully. Transaction will appear on-chain shortly.'
                );
              }
            } catch (error: unknown) {
              Alert.alert('Error', `Failed to fuse e-cash: ${error instanceof Error ? error.message : String(error)}`);
            }
          },
        },
      ]
    );
  }, [cashuBalance, taprootAddress, fetchTransactionHistory, transactionHistory]);

  return { handleFusePress };
}
