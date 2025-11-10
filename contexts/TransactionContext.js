/**
 * TransactionContext - Provides transaction state and methods to the entire app
 * Manages send/receive transaction flows
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import * as TransactionService from '../services/transactionService';
import * as BackgroundTaskService from '../services/backgroundTaskService';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';

const TransactionContext = createContext();

export const useTransaction = () => {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransaction must be used within a TransactionProvider');
  }
  return context;
};

export const TransactionProvider = ({
  children,
  wallet,
  currentAccount,
  showToast,
  startTransactionPolling,
  sendTransactionConfirmedNotification,
  notificationsEnabled,
  fetchBalance,
}) => {
  // Transaction state
  const [sendIntent, setSendIntent] = useState(null);
  const [intentStep, setIntentStep] = useState('idle'); // 'idle' | 'selecting_asset' | 'entering_amount' | 'entering_address' | 'creating' | 'reviewing' | 'signing' | 'broadcasting' | 'pending' | 'confirmed'
  const [sendAssetType, setSendAssetType] = useState(null); // 'btc' | 'unit'
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAddressType, setSendAddressType] = useState('taproot'); // 'segwit' | 'taproot'
  const [broadcastedTxid, setBroadcastedTxid] = useState(null);
  const [toastDismissed, setToastDismissed] = useState(false);

  // Auto-manage transaction completion flow
  useEffect(() => {
    if (intentStep === 'confirmed') {
      // Reset toast dismissed state when confirmed (so it shows again)
      setToastDismissed(false);

      // Clear transaction fields so they don't persist
      setSendRecipient('');
      setSendAmount('');
      setSendAssetType(null);

      // Auto-hide toast after 10 seconds when confirmed
      const timer = setTimeout(() => {
        setIntentStep('idle');
        setBroadcastedTxid(null);
        setToastDismissed(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [intentStep]);

  // Create BTC transaction using TransactionService
  const createBtcIntent = async () => {
    try {
      const intent = await TransactionService.createBtcIntent(
        sendRecipient,
        sendAmount,
        wallet.segwitAddress,
        currentAccount
      );

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error) {
      showToast(parseErrorMessage(error), 'error');
      setIntentStep('idle');
      throw error;
    }
  };

  // Create UNIT (Rune) transaction using TransactionService
  const createUnitIntent = async () => {
    try {
      if (!wallet || !wallet.taprootAddress || !wallet.segwitAddress) {
        throw new Error('Wallet not initialized');
      }

      const intent = await TransactionService.createUnitIntent(
        sendRecipient,
        sendAmount,
        wallet.taprootAddress,
        wallet.segwitAddress,
        currentAccount
      );

      setSendIntent(intent);
      setIntentStep('reviewing');
    } catch (error) {
      showToast(parseErrorMessage(error), 'error');
      setIntentStep('idle');
      throw error;
    }
  };

  // Main create intent function (routes to BTC or UNIT)
  const createSendIntent = async () => {
    try {
      const trimmedRecipient = sendRecipient.trim();
      setIntentStep('creating');

      // Validate inputs
      if (!trimmedRecipient || !sendAmount) {
        showToast(ERRORS.MISSING_RECIPIENT_AMOUNT, 'error');
        setIntentStep('idle');
        return;
      }

      // Update the state with trimmed recipient
      setSendRecipient(trimmedRecipient);

      // Branch based on asset type
      if (sendAssetType === 'btc') {
        await createBtcIntent();
      } else if (sendAssetType === 'unit') {
        await createUnitIntent();
      } else {
        showToast(ERRORS.ASSET_SELECTION_REQUIRED, 'error');
        setIntentStep('idle');
      }
    } catch (error) {
      showToast(parseErrorMessage(error), 'error');
      setIntentStep('idle');
    }
  };

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
    } catch (error) {
      showToast(parseErrorMessage(error), 'error');
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
        (error) => {
          // Error polling, but don't block the user - just mark as confirmed after timeout
          setIntentStep('confirmed');
          fetchBalance();
        }
      );
    } catch (error) {
      showToast(parseErrorMessage(error), 'error');
      setIntentStep('reviewing');
    }
  };

  const value = {
    // State
    sendIntent,
    intentStep,
    sendAssetType,
    sendAmount,
    sendRecipient,
    sendAddressType,
    broadcastedTxid,
    toastDismissed,

    // Setters
    setSendIntent,
    setIntentStep,
    setSendAssetType,
    setSendAmount,
    setSendRecipient,
    setSendAddressType,
    setBroadcastedTxid,
    setToastDismissed,

    // Handlers
    createSendIntent,
    signIntent,
    broadcastIntent,
  };

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
};
