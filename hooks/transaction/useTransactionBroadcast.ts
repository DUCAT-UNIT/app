/**
 * useTransactionBroadcast Hook
 * Handles transaction broadcasting and confirmation polling
 */

import { useCallback } from 'react';
import { broadcastTransaction } from '../../services/transaction';
import * as BackgroundTaskService from '../../services/backgroundTaskService';
import { watchTransaction } from '../../services/pushNotificationService';
import { parseErrorMessage } from '../../utils/errorParser';
import { ERRORS } from '../../utils/messages';
import { logger } from '../../utils/logger';
import type { SendIntent } from '../../contexts/TransactionBuildContext';
import type { PendingTransactionOutput } from '../../stores/pendingTransactionsStore';
import type { SnackbarParams } from '../../stores/notificationStore';
import type { IntentStep, AssetType } from '../../stores/sendFlowStore';
import { useOutputExtraction } from './useOutputExtraction';

export interface BroadcastOptions {
  skipAutoConfirm?: boolean;
}

export interface UseTransactionBroadcastOptions {
  wallet: {
    segwitAddress?: string;
    taprootAddress?: string;
  } | null;
  pendingTransactions: Record<string, { status: string }>;
  getPendingTransactions?: () => Record<string, { status: string }>;
  sendAssetType: AssetType;
  sendAmount: string;
  setSendIntent: (intent: SendIntent | null) => void;
  setIntentStep: (step: IntentStep) => void;
  setBroadcastedTxid: (txid: string | null) => void;
  setToastDismissed: (dismissed: boolean) => void;
  showSnackbar: (params: SnackbarParams) => void;
  getSnackbarAction: () => string;
  markUtxoAsSpent: (txid: string, vout: number) => Promise<void>;
  markUtxosAsSpent: (inputs: Array<{ txid: string; vout: number }>) => Promise<void>;
  unmarkUtxosAsSpent: (inputs: Array<{ txid: string; vout: number }>) => Promise<void>;
  addPendingTransaction: (
    txid: string,
    outputs: PendingTransactionOutput[],
    assetType: 'BTC' | 'UNIT',
    parentTxid?: string | null,
    sentAmount?: number,
    inputUtxos?: Array<{ txid: string; vout: number }>
  ) => Promise<void>;
  confirmTransaction: (txid: string) => void;
  invalidateTransaction: (txid: string, reason?: string) => Promise<string[]>;
  startTransactionPolling: (
    txid: string,
    onSuccess: (isConfirmed: boolean) => void,
    onError: (error: unknown) => void
  ) => void;
  sendTransactionConfirmedNotification: (
    assetType: string,
    amount: number,
    txid: string,
    action: string
  ) => void;
  notificationsEnabled: boolean;
  fetchBalance: () => Promise<void>;
  fetchTransactionHistory?: () => Promise<void>;
}

export interface UseTransactionBroadcastResult {
  /** Broadcast a signed intent to the network */
  broadcast: (intent: SendIntent, options?: BroadcastOptions) => Promise<string | null>;
}

export function useTransactionBroadcast({
  wallet,
  pendingTransactions,
  getPendingTransactions,
  sendAssetType,
  sendAmount,
  setSendIntent,
  setIntentStep,
  setBroadcastedTxid,
  setToastDismissed,
  showSnackbar,
  getSnackbarAction,
  markUtxoAsSpent,
  markUtxosAsSpent,
  unmarkUtxosAsSpent,
  addPendingTransaction,
  confirmTransaction,
  invalidateTransaction,
  startTransactionPolling,
  sendTransactionConfirmedNotification,
  notificationsEnabled,
  fetchBalance,
  fetchTransactionHistory,
}: UseTransactionBroadcastOptions): UseTransactionBroadcastResult {
  const { extractOutputs, btcToSats } = useOutputExtraction({
    wallet,
    pendingTransactions,
    getPendingTransactions,
    markUtxoAsSpent,
  });

  const broadcast = useCallback(
    async (intent: SendIntent, options: BroadcastOptions = {}): Promise<string | null> => {
      const { skipAutoConfirm = false } = options;
      let preparedTxid: string | null = null;
      let broadcastAttempted = false;
      let pendingTrackedBeforeBroadcast = false;
      let spentInputsForRollback: Array<{ txid: string; vout: number }> = [];

      try {
        if (!intent || !intent.signedTxHex) {
          showSnackbar({
            type: 'error',
            action: getSnackbarAction(),
            message: ERRORS.TRANSACTION_CANCELLED,
          });
          return null;
        }

        logger.debug('📡 Broadcasting transaction...', { skipAutoConfirm });

        // Log inputs based on asset type
        if (intent.assetType === 'BTC') {
          logger.debug(
            'Intent inputs:',
            intent.inputs.map((i) => `${i.txid}:${i.vout}`)
          );
        } else if (intent.assetType === 'UNIT') {
          if (intent.runeUtxo)
            logger.debug('Rune UTXO:', `${intent.runeUtxo.transaction}:${intent.runeUtxo.vout}`);
          if (intent.satUtxo)
            logger.debug('Sat UTXO:', `${intent.satUtxo.txid}:${intent.satUtxo.vout}`);
        }

        preparedTxid = intent.txid ?? null;
        if (!preparedTxid) {
          throw new Error('Signed transaction is missing its txid.');
        }

        const { outputs, spentInputs, parentTxid } = await extractOutputs(
          intent,
          sendAssetType || 'btc',
          sendAmount
        );
        spentInputsForRollback = spentInputs;
        const assetType = sendAssetType === 'unit' ? 'UNIT' : 'BTC';
        const sentAmountSmallest =
          sendAssetType === 'unit'
            ? Math.round((parseFloat(sendAmount) || 0) * 100)
            : btcToSats(sendAmount);

        if (spentInputs.length > 0) {
          logger.debug('📝 Re-confirming', spentInputs.length, 'UTXOs are spent before broadcast');
          await markUtxosAsSpent(spentInputs);
        }

        if (outputs.length > 0 || spentInputs.length > 0) {
          logger.debug('💾 Pre-tracking pending transaction:', preparedTxid, 'with', outputs.length, 'outputs');
          await addPendingTransaction(
            preparedTxid,
            outputs,
            assetType,
            parentTxid,
            sentAmountSmallest,
            spentInputs
          );
          pendingTrackedBeforeBroadcast = true;
        } else {
          logger.debug('⚠️ No change outputs found to save before broadcast');
        }

        broadcastAttempted = true;
        const txid = await broadcastTransaction(intent.signedTxHex);
        logger.debug('✅ Broadcast successful, txid:', txid);

        if (txid !== preparedTxid && (outputs.length > 0 || spentInputs.length > 0)) {
          logger.warn('Broadcast txid differed from signed intent txid; tracking returned txid too', {
            preparedTxid,
            txid,
          });
          await addPendingTransaction(
            txid,
            outputs,
            assetType,
            parentTxid,
            sentAmountSmallest,
            spentInputs
          );
        }

        // Register TX for push-notification monitoring (fire-and-forget)
        void watchTransaction(txid, wallet?.segwitAddress || '');

        // Update state after outputs are extracted
        setBroadcastedTxid(txid);
        setIntentStep('pending');
        setToastDismissed(false);

        // Clear the send intent after successful broadcast
        setSendIntent(null);

        // Add to background monitoring
        await BackgroundTaskService.addPendingTransaction(txid, assetType, sendAmount, 'send');

        // Immediately fetch transaction history
        if (fetchTransactionHistory) {
          fetchTransactionHistory();
        }

        // Start polling for confirmation
        startTransactionPolling(
          txid,
          (isConfirmed) => {
            if (isConfirmed) {
              if (notificationsEnabled) {
                sendTransactionConfirmedNotification(
                  assetType,
                  Number(sendAmount) || 0,
                  txid,
                  'send'
                );
              }
              BackgroundTaskService.removePendingTransaction(txid);
              confirmTransaction(txid);
              showSnackbar({
                type: 'success',
                action: getSnackbarAction(),
                txid,
              });
            }
            if (!skipAutoConfirm) {
              logger.debug('Polling: Setting intentStep to confirmed');
              setIntentStep('confirmed');
            } else {
              logger.debug('Polling: Skipping auto-confirm for turbo mint flow');
            }
            fetchBalance();
            if (fetchTransactionHistory) {
              fetchTransactionHistory();
            }
          },
          (_error) => {
            if (!skipAutoConfirm) {
              logger.debug('Polling error: Setting intentStep to confirmed');
              setIntentStep('confirmed');
            } else {
              logger.debug('Polling error: Skipping auto-confirm for turbo mint flow');
            }
            fetchBalance();
            if (fetchTransactionHistory) {
              fetchTransactionHistory();
            }
          }
        );

        return txid;
      } catch (error) {
        logger.error('❌ Broadcast failed:', {
          error: error instanceof Error ? error.message : String(error),
        });

        if (broadcastAttempted && preparedTxid) {
          logger.warn('Broadcast result is unknown; keeping signed tx pending', {
            txid: preparedTxid,
            pendingTrackedBeforeBroadcast,
          });
          setBroadcastedTxid(preparedTxid);
          setIntentStep('pending');
          setToastDismissed(false);
          showSnackbar({
            type: 'error',
            action: getSnackbarAction(),
            message: `Broadcast status unknown. ${parseErrorMessage(error)}`,
          });
          return preparedTxid;
        }

        showSnackbar({
          type: 'error',
          action: getSnackbarAction(),
          message: parseErrorMessage(error),
        });
        setIntentStep('reviewing');

        if (spentInputsForRollback.length > 0) {
          try {
            await unmarkUtxosAsSpent(spentInputsForRollback);
          } catch (rollbackError) {
            logger.error('Failed to roll back pre-broadcast UTXO locks:', {
              error:
                rollbackError instanceof Error
                  ? rollbackError.message
                  : String(rollbackError),
            });
          }
        }

        if (intent?.txid) {
          await invalidateTransaction(intent.txid, 'Transaction broadcast failed');
        }

        return null;
      }
    },
    [
      extractOutputs,
      btcToSats,
      sendAssetType,
      sendAmount,
      setSendIntent,
      setIntentStep,
      setBroadcastedTxid,
      setToastDismissed,
      showSnackbar,
      getSnackbarAction,
      markUtxosAsSpent,
      unmarkUtxosAsSpent,
      addPendingTransaction,
      confirmTransaction,
      invalidateTransaction,
      startTransactionPolling,
      sendTransactionConfirmedNotification,
      notificationsEnabled,
      fetchBalance,
      fetchTransactionHistory,
    ]
  );

  return { broadcast };
}
