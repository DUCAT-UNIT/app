/**
 * TransactionExecutionContext - Handles transaction signing and broadcasting
 * Signs PSBTs, broadcasts to network, and monitors confirmation
 * Depends on TransactionBuildContext for the intent and SendFlowContext for metadata
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import * as bitcoin from 'bitcoinjs-lib';
import { signIntent as signIntentService, broadcastTransaction } from '../services/transaction';
import type { TransactionIntent as SigningTransactionIntent } from '../services/transactionSigningService';
import * as BackgroundTaskService from '../services/backgroundTaskService';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';
import { MUTINYNET_NETWORK } from '../utils/bitcoin';
import { useSendFlow } from './SendFlowContext';
import { useTransactionBuild } from './TransactionBuildContext';
import type { SendIntent } from './TransactionBuildContext';
import { usePendingTransactions, PendingTransactionOutput } from './PendingTransactionsContext';
import { useWallet } from './WalletContext';
import { logger } from '../utils/logger';
import type { SnackbarParams } from './NotificationContext';

interface BroadcastOptions {
  skipAutoConfirm?: boolean;
}

interface SignOptions {
  skipAutoConfirm?: boolean;
}

interface TransactionExecutionContextValue {
  broadcastedTxid: string | null;
  toastDismissed: boolean;
  setBroadcastedTxid: React.Dispatch<React.SetStateAction<string | null>>;
  setToastDismissed: React.Dispatch<React.SetStateAction<boolean>>;
  signIntent: (options?: SignOptions) => Promise<boolean>;
  broadcastIntent: (intent?: SendIntent | null, options?: BroadcastOptions) => Promise<void>;
}

const TransactionExecutionContext = createContext<TransactionExecutionContextValue | undefined>(undefined);

export const useTransactionExecution = (): TransactionExecutionContextValue => {
  const context = useContext(TransactionExecutionContext);
  if (!context) {
    throw new Error('useTransactionExecution must be used within a TransactionExecutionProvider');
  }
  return context;
};

interface TransactionExecutionProviderProps {
  children: ReactNode;
  currentAccount: number;
  showSnackbar: (params: SnackbarParams) => void;
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

export const TransactionExecutionProvider: React.FC<TransactionExecutionProviderProps> = ({
  children,
  currentAccount,
  showSnackbar,
  startTransactionPolling,
  sendTransactionConfirmedNotification,
  notificationsEnabled,
  fetchBalance,
  fetchTransactionHistory,
}) => {
  const { setIntentStep, sendAssetType, sendAmount } = useSendFlow();
  const { sendIntent, setSendIntent } = useTransactionBuild();
  const { wallet } = useWallet();
  const { addPendingTransaction, confirmTransaction, invalidateTransaction, pendingTransactions, markUtxoAsSpent, markUtxosAsSpent } = usePendingTransactions();

  // Execution state
  const [broadcastedTxid, setBroadcastedTxid] = useState<string | null>(null);
  const [toastDismissed, setToastDismissed] = useState(false);

  // Reset toast dismissed state when confirmed
  useEffect(() => {
    if (broadcastedTxid) {
      setToastDismissed(false);
    }
  }, [broadcastedTxid]);

  // Broadcast the signed transaction
  const broadcastIntent = useCallback(async (intent: SendIntent | null = sendIntent, options: BroadcastOptions = {}) => {
    const { skipAutoConfirm = false } = options; // Skip auto-setting intentStep='confirmed' for turbo mint flows
    try {
      if (!intent || !intent.signedTxHex) {
        showSnackbar({
          type: 'error',
          action: sendAssetType === 'unit' ? 'swap' : 'withdraw',
          message: ERRORS.TRANSACTION_CANCELLED,
        });
        return;
      }

      logger.debug('📡 Broadcasting transaction...', { skipAutoConfirm });
      // Log inputs based on asset type
      if (intent.assetType === 'BTC') {
        logger.debug('Intent inputs:', intent.inputs.map(i => `${i.txid}:${i.vout}`));
      } else if (intent.assetType === 'UNIT') {
        if (intent.runeUtxo) logger.debug('Rune UTXO:', `${intent.runeUtxo.transaction}:${intent.runeUtxo.vout}`);
        if (intent.satUtxo) logger.debug('Sat UTXO:', `${intent.satUtxo.txid}:${intent.satUtxo.vout}`);
      }

      const txid = await broadcastTransaction(intent.signedTxHex);
      logger.debug('✅ Broadcast successful, txid:', txid);

      // Extract outputs from signed transaction for pending tracking FIRST
      // This must happen before setting intentStep to 'pending' so that the outputs
      // are available for the next transaction if the user creates one immediately
      try {
        const tx = bitcoin.Transaction.fromHex(intent.signedTxHex);
        const outputs: PendingTransactionOutput[] = [];

        logger.debug('🔍 Extracting outputs from broadcasted tx:', txid);
        logger.debug('Total outputs in tx:', tx.outs.length);

        // Mark ALL inputs as spent to prevent reuse
        const spentInputs: Array<{ txid: string; vout: number }> = [];
        let parentTxid: string | null = null;

        for (const input of tx.ins) {
          const inputTxid = Buffer.from(input.hash).reverse().toString('hex');
          const inputVout = input.index;

          logger.debug('Input:', inputTxid, 'vout:', inputVout);

          // Add to spent list
          spentInputs.push({ txid: inputTxid, vout: inputVout });

          // Check if this input is spending from a pending transaction (for parent-child tracking)
          if (pendingTransactions[inputTxid] && pendingTransactions[inputTxid].status === 'pending') {
            if (!parentTxid) {
              parentTxid = inputTxid; // Set first pending input as parent
            }

            logger.debug('Removing pending output:', inputTxid, 'vout:', inputVout);
            // Mark this pending UTXO as spent (removes it from pending outputs)
            await markUtxoAsSpent(inputTxid, inputVout);
          }
        }

        // NOTE: UTXOs are now locked immediately after intent creation (see TransactionBuildContext)
        // This call is kept as a safety net and to ensure pending transaction inputs are properly tracked
        // It's idempotent - marking an already-spent UTXO as spent again is harmless
        if (spentInputs.length > 0) {
          logger.debug('📝 Re-confirming', spentInputs.length, 'UTXOs are spent (safety check)');
          await markUtxosAsSpent(spentInputs);
        }

        // For UNIT transactions, calculate rune change amount
        let runeChangeAmount = 0;
        if (sendAssetType === 'unit' && intent.assetType === 'UNIT' && intent.runeUtxo?.runeAmount && intent.amount) {
          const intentAmount = typeof intent.amount === 'string' ? parseFloat(intent.amount) : intent.amount;
          runeChangeAmount = intent.runeUtxo.runeAmount - intentAmount;
          logger.debug('Rune change amount:', runeChangeAmount);
        }

        // Decode each output
        tx.outs.forEach((output, vout) => {
          try {
            const address = bitcoin.address.fromOutputScript(output.script, MUTINYNET_NETWORK);
            const value = Number(output.value);

            logger.debug(`Output ${vout}: ${address} = ${value} sats`);

            // Check if this is a change output (going back to our wallet)
            const isChange =
              address === wallet?.segwitAddress ||
              address === wallet?.taprootAddress;

            logger.debug(`Is change? ${isChange} (segwit: ${wallet?.segwitAddress}, taproot: ${wallet?.taprootAddress})`);

            if (isChange) {
              const outputData: PendingTransactionOutput = {
                address,
                value,
                vout,
              };

              // For UNIT transactions, output 0 is the rune return (change)
              if (sendAssetType === 'unit' && vout === 0 && runeChangeAmount > 0) {
                outputData.runeAmount = runeChangeAmount;
              }

              logger.debug('✅ Adding change output:', outputData);
              outputs.push(outputData);
            }
          } catch (_error) {
            logger.debug(`Output ${vout}: OP_RETURN or non-standard`);
            // Could be OP_RETURN or other non-standard output, skip
          }
        });

        logger.debug('Total change outputs found:', outputs.length);

        // If we have change outputs, store them as pending with parent tracking
        if (outputs.length > 0) {
          const assetType = sendAssetType === 'unit' ? 'UNIT' : 'BTC';
          logger.debug('💾 Adding pending transaction:', txid, 'with', outputs.length, 'outputs');
          await addPendingTransaction(txid, outputs, assetType, parentTxid);
        } else {
          logger.debug('⚠️ No change outputs found to save');
        }
      } catch (error: unknown) {
        logger.error('❌ Error extracting change outputs:', { error: error instanceof Error ? error.message : String(error) });
        // Non-critical error, continue with broadcast
      }

      // NOW move to pending state after outputs are extracted and saved
      // This ensures the outputs are available for the next transaction
      setBroadcastedTxid(txid);
      setIntentStep('pending');
      setToastDismissed(false);

      // CRITICAL: Clear the send intent after successful broadcast
      // This prevents the old intent from being used as exclusion criteria
      // when creating the next transaction. Without this, the next transaction
      // would exclude UTXOs that were inputs to this (now broadcast) transaction,
      // even though those UTXOs are already spent on-chain.
      setSendIntent(null);

      // Add to background monitoring
      const assetType = sendAssetType === 'unit' ? 'UNIT' : 'BTC';
      await BackgroundTaskService.addPendingTransaction(txid, assetType, sendAmount, 'withdraw');

      // Immediately fetch transaction history to show the new tx
      if (fetchTransactionHistory) {
        fetchTransactionHistory();
      }

      // Start polling for confirmation
      startTransactionPolling(
        txid,
        (isConfirmed) => {
          if (isConfirmed) {
            if (notificationsEnabled) {
              sendTransactionConfirmedNotification(assetType, Number(sendAmount) || 0, txid, 'withdraw');
            }
            BackgroundTaskService.removePendingTransaction(txid);
            // Mark pending transaction as confirmed
            confirmTransaction(txid);
          }
          // Only auto-set intentStep='confirmed' if not doing turbo mint (which handles it manually)
          if (!skipAutoConfirm) {
            logger.debug('Polling: Setting intentStep to confirmed');
            setIntentStep('confirmed');
          } else {
            logger.debug('Polling: Skipping auto-confirm for turbo mint flow');
          }
          fetchBalance();
          if (fetchTransactionHistory) {
            fetchTransactionHistory(); // Update transaction list when confirmed
          }
        },
        (_error) => {
          // Error polling, but don't block the user - just mark as confirmed after timeout
          if (!skipAutoConfirm) {
            logger.debug('Polling error: Setting intentStep to confirmed');
            setIntentStep('confirmed');
          } else {
            logger.debug('Polling error: Skipping auto-confirm for turbo mint flow');
          }
          fetchBalance();
          if (fetchTransactionHistory) {
            fetchTransactionHistory(); // Update transaction list even on error
          }
        }
      );
    } catch (_error) {
      logger.error('❌ Broadcast failed:', { error: _error instanceof Error ? _error.message : String(_error) });
      showSnackbar({
        type: 'error',
        action: sendAssetType === 'unit' ? 'swap' : 'withdraw',
        message: parseErrorMessage(_error),
      });
      setIntentStep('reviewing');

      // Invalidate the transaction if broadcast failed
      if (intent?.txid) {
        await invalidateTransaction(intent.txid, 'Transaction broadcast failed');
      }
    }
  }, [sendIntent, setSendIntent, wallet, showSnackbar, setIntentStep, sendAssetType, sendAmount, startTransactionPolling, notificationsEnabled, sendTransactionConfirmedNotification, fetchBalance, fetchTransactionHistory, addPendingTransaction, confirmTransaction, invalidateTransaction, pendingTransactions, markUtxoAsSpent, markUtxosAsSpent]);

  // Sign the PSBT
  const signIntent = useCallback(async (options: SignOptions = {}): Promise<boolean> => {
    try {
      setIntentStep('signing');

      if (!sendIntent) {
        showSnackbar({
          type: 'error',
          action: sendAssetType === 'unit' ? 'swap' : 'withdraw',
          message: ERRORS.TRANSACTION_CANCELLED,
        });
        setIntentStep('idle');
        return false;
      }

      const { signedTxHex, txid } = await signIntentService(sendIntent as SigningTransactionIntent, currentAccount);

      // Update intent with signed transaction
      const signedIntent: SendIntent = {
        ...sendIntent,
        signedTxHex,
        txid,
      };

      setSendIntent(signedIntent);
      setIntentStep('broadcasting');

      // Automatically broadcast (pass options through)
      await broadcastIntent(signedIntent, options);
      return true;
    } catch (_error) {
      logger.error('Error signing transaction:', { error: _error instanceof Error ? _error.message : String(_error) });
      showSnackbar({
        type: 'error',
        action: sendAssetType === 'unit' ? 'swap' : 'withdraw',
        message: parseErrorMessage(_error),
      });
      setIntentStep('reviewing');
      return false;
    }
  }, [sendIntent, currentAccount, setIntentStep, setSendIntent, showSnackbar, sendAssetType, broadcastIntent]);

  // Memoize the value object to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      // State
      broadcastedTxid,
      toastDismissed,

      // Setters
      setBroadcastedTxid,
      setToastDismissed,

      // Handlers
      signIntent,
      broadcastIntent,
    }),
    [broadcastedTxid, toastDismissed, signIntent, broadcastIntent]
  );

  return (
    <TransactionExecutionContext.Provider value={value}>
      {children}
    </TransactionExecutionContext.Provider>
  );
};
