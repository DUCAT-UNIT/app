/**
 * useFuseEcash Hook
 * Handles converting e-cash to on-chain UNIT (Fuse operation)
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { analytics } from '../services/analyticsService';
import { CASHU_EVENTS } from '../constants/analyticsEvents';
import { logger } from '../utils/logger';
import { requestMaxMelt, completeMeltWithoutCleanup, cleanupMeltProofs } from '../services/cashu/cashuWalletService';

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

const CASHU_UNIT_DISPLAY_SCALE = 100;

const formatTurboUnitAmount = (amount: number): string =>
  (amount / CASHU_UNIT_DISPLAY_SCALE).toFixed(2);

export function useFuseEcash({
  cashuBalance,
  taprootAddress,
  transactionHistory,
  fetchTransactionHistory,
}: UseFuseEcashParams): UseFuseEcashReturn {
  const handleFusePress = useCallback(async () => {
    if (cashuBalance <= 0) {
      Alert.alert('No TurboUNIT', 'You don\'t have any TurboUNIT to withdraw.');
      return;
    }

    Alert.alert(
      'Withdraw TurboUNIT?',
      `Convert up to ${formatTurboUnitAmount(cashuBalance)} TurboUNIT to on-chain UNIT? Network fees are deducted from the withdrawal amount.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async () => {
            try {
              // Request the largest quote the current balance can cover after fees.
              const quote = await requestMaxMelt(taprootAddress, cashuBalance);
              analytics.track(CASHU_EVENTS.CASHU_MELT_STARTED, {
                amount: quote.amount,
                availableAmount: cashuBalance,
                fee: quote.fee,
              });

              // Complete melt but keep proofs until we see the tx
              const meltResult = await completeMeltWithoutCleanup(quote.quoteId, quote.total);

              // Clean up proofs immediately after successful melt
              logger.debug('[Fuse] Melt successful, cleaning up proofs');
              await cleanupMeltProofs(meltResult.proofsToRemove, meltResult.changeProofs);

              Alert.alert(
                'Withdrawal submitted',
                `Withdrawing ${formatTurboUnitAmount(quote.amount)} UNIT. Waiting for transaction to appear on-chain...`
              );

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
                Alert.alert('Success', 'TurboUNIT successfully withdrawn to on-chain UNIT.');
              } else {
                Alert.alert(
                  'Pending',
                  'Withdrawal submitted successfully. Transaction will appear on-chain shortly.'
                );
              }
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : String(error);
              Alert.alert('Withdrawal failed', `Your TurboUNIT tokens remain valid. ${message}`);
            }
          },
        },
      ]
    );
  }, [cashuBalance, taprootAddress, fetchTransactionHistory, transactionHistory]);

  return { handleFusePress };
}
