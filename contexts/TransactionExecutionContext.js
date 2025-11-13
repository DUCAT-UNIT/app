/**
 * TransactionExecutionContext - Handles transaction signing and broadcasting
 * Signs PSBTs, broadcasts to network, and monitors confirmation
 * Depends on TransactionBuildContext for the intent and SendFlowContext for metadata
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import * as bitcoin from 'bitcoinjs-lib';
import * as TransactionService from '../services/transactionService';
import * as BackgroundTaskService from '../services/backgroundTaskService';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';
import { MUTINYNET_NETWORK } from '../utils/bitcoin';
import { useSendFlow } from './SendFlowContext';
import { useTransactionBuild } from './TransactionBuildContext';
import { usePendingTransactions } from './PendingTransactionsContext';
import { useWallet } from './WalletContext';

const TransactionExecutionContext = createContext();

export const useTransactionExecution = () => {
  const context = useContext(TransactionExecutionContext);
  if (!context) {
    throw new Error('useTransactionExecution must be used within a TransactionExecutionProvider');
  }
  return context;
};

export const TransactionExecutionProvider = ({
  children,
  currentAccount,
  showToast,
  startTransactionPolling,
  sendTransactionConfirmedNotification,
  notificationsEnabled,
  fetchBalance,
}) => {
  const { setIntentStep, sendAssetType, sendAmount } = useSendFlow();
  const { sendIntent, setSendIntent } = useTransactionBuild();
  const { wallet } = useWallet();
  const { addPendingTransaction, confirmTransaction, invalidateTransaction, pendingTransactions } = usePendingTransactions();

  // Execution state
  const [broadcastedTxid, setBroadcastedTxid] = useState(null);
  const [toastDismissed, setToastDismissed] = useState(false);

  // Reset toast dismissed state when confirmed
  useEffect(() => {
    if (broadcastedTxid) {
      setToastDismissed(false);
    }
  }, [broadcastedTxid]);

  // Broadcast the signed transaction
  const broadcastIntent = useCallback(async (intent = sendIntent) => {
    try {
      if (!intent || !intent.signedTxHex) {
        showToast(ERRORS.TRANSACTION_CANCELLED, 'error');
        return;
      }

      const txid = await TransactionService.broadcastTransaction(intent.signedTxHex);

      // Store txid and move to pending state
      setBroadcastedTxid(txid);
      setIntentStep('pending');
      setToastDismissed(false);

      // Extract outputs from signed transaction for pending tracking
      try {
        const tx = bitcoin.Transaction.fromHex(intent.signedTxHex);
        const outputs = [];

        // Check if any inputs are from pending transactions (for parent-child tracking)
        let parentTxid = null;
        for (const input of tx.ins) {
          const inputTxid = Buffer.from(input.hash).reverse().toString('hex');
          // Check if this input is spending from a pending transaction
          if (pendingTransactions[inputTxid] && pendingTransactions[inputTxid].status === 'pending') {
            parentTxid = inputTxid;
            break; // We only need one parent for tracking
          }
        }

        // For UNIT transactions, calculate rune change amount
        let runeChangeAmount = 0;
        if (sendAssetType === 'unit' && intent.runeUtxo && intent.amount) {
          runeChangeAmount = intent.runeUtxo.runeAmount - intent.amount;
        }

        // Decode each output
        tx.outs.forEach((output, vout) => {
          try {
            const address = bitcoin.address.fromOutputScript(output.script, MUTINYNET_NETWORK);
            const value = Number(output.value);

            // Check if this is a change output (going back to our wallet)
            const isChange =
              address === wallet?.segwitAddress ||
              address === wallet?.taprootAddress;

            if (isChange) {
              const outputData = {
                address,
                value,
                vout,
              };

              // For UNIT transactions, output 0 is the rune return (change)
              if (sendAssetType === 'unit' && vout === 0 && runeChangeAmount > 0) {
                outputData.runeAmount = runeChangeAmount;
              }

              outputs.push(outputData);
            }
          } catch (_error) {
            // Could be OP_RETURN or other non-standard output, skip
          }
        });

        // If we have change outputs, store them as pending with parent tracking
        if (outputs.length > 0) {
          const assetType = sendAssetType === 'unit' ? 'UNIT' : 'BTC';
          await addPendingTransaction(txid, outputs, assetType, parentTxid);
        }
      } catch (error) {
        console.error('❌ Error extracting change outputs:', error);
        console.error('Error details:', error.message, error.stack);
        // Non-critical error, continue with broadcast
      }

      // Add to background monitoring
      const assetType = sendAssetType === 'unit' ? 'UNIT' : 'BTC';
      await BackgroundTaskService.addPendingTransaction(txid, assetType, sendAmount, 'withdraw');

      // Start polling for confirmation
      startTransactionPolling(
        txid,
        (isConfirmed) => {
          if (isConfirmed) {
            if (notificationsEnabled) {
              sendTransactionConfirmedNotification(assetType, sendAmount, txid, 'withdraw');
            }
            BackgroundTaskService.removePendingTransaction(txid);
            // Mark pending transaction as confirmed
            confirmTransaction(txid);
          }
          setIntentStep('confirmed');
          fetchBalance();
        },
        (_error) => {
          // Error polling, but don't block the user - just mark as confirmed after timeout
          setIntentStep('confirmed');
          fetchBalance();
        }
      );
    } catch (_error) {
      showToast(parseErrorMessage(_error), 'error');
      setIntentStep('reviewing');

      // Invalidate the transaction if broadcast failed
      if (intent?.txid) {
        await invalidateTransaction(intent.txid, 'Transaction broadcast failed');
      }
    }
  }, [sendIntent, wallet, showToast, setIntentStep, sendAssetType, sendAmount, startTransactionPolling, notificationsEnabled, sendTransactionConfirmedNotification, fetchBalance, addPendingTransaction, confirmTransaction, invalidateTransaction, pendingTransactions]);

  // Sign the PSBT
  const signIntent = useCallback(async () => {
    try {
      setIntentStep('signing');

      if (!sendIntent) {
        showToast(ERRORS.TRANSACTION_CANCELLED, 'error');
        setIntentStep('idle');
        return false;
      }

      const { signedTxHex, txid } = await TransactionService.signIntent(sendIntent, currentAccount);

      // Update intent with signed transaction
      const signedIntent = {
        ...sendIntent,
        signedTxHex,
        txid,
      };

      setSendIntent(signedIntent);
      setIntentStep('broadcasting');

      // Automatically broadcast
      await broadcastIntent(signedIntent);
      return true;
    } catch (_error) {
      console.error('Error signing transaction:', _error);
      showToast(parseErrorMessage(_error), 'error');
      setIntentStep('reviewing');
      return false;
    }
  }, [sendIntent, currentAccount, setIntentStep, setSendIntent, showToast, broadcastIntent]);

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
