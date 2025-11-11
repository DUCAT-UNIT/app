/**
 * TransactionExecutionContext - Handles transaction signing and broadcasting
 * Signs PSBTs, broadcasts to network, and monitors confirmation
 * Depends on TransactionBuildContext for the intent and SendFlowContext for metadata
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import * as TransactionService from '../services/transactionService';
import * as BackgroundTaskService from '../services/backgroundTaskService';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';
import { useSendFlow } from './SendFlowContext';
import { useTransactionBuild } from './TransactionBuildContext';

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

  // Execution state
  const [broadcastedTxid, setBroadcastedTxid] = useState(null);
  const [toastDismissed, setToastDismissed] = useState(false);

  // Reset toast dismissed state when confirmed
  useEffect(() => {
    if (broadcastedTxid) {
      setToastDismissed(false);
    }
  }, [broadcastedTxid]);

  // Sign the PSBT
  const signIntent = async () => {
    try {
      setIntentStep('signing');

      if (!sendIntent) {
        showToast(ERRORS.TRANSACTION_CANCELLED, 'error');
        setIntentStep('idle');
        return;
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
    } catch (_error) {
      showToast(parseErrorMessage(_error), 'error');
      setIntentStep('reviewing');
    }
  };

  // Broadcast the signed transaction
  const broadcastIntent = async (intent = sendIntent) => {
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
    }
  };

  const value = {
    // State
    broadcastedTxid,
    toastDismissed,

    // Setters
    setBroadcastedTxid,
    setToastDismissed,

    // Handlers
    signIntent,
    broadcastIntent,
  };

  return (
    <TransactionExecutionContext.Provider value={value}>
      {children}
    </TransactionExecutionContext.Provider>
  );
};
