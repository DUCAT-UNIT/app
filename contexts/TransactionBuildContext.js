/**
 * TransactionBuildContext - Handles transaction PSBT creation
 * Builds unsigned PSBTs from user inputs
 * Depends on SendFlowContext for form data
 */

import React, { createContext, useContext, useState } from 'react';
import * as TransactionService from '../services/transactionService';
import { parseErrorMessage } from '../utils/errorParser';
import { ERRORS } from '../utils/messages';
import { useSendFlow } from './SendFlowContext';

const TransactionBuildContext = createContext();

export const useTransactionBuild = () => {
  const context = useContext(TransactionBuildContext);
  if (!context) {
    throw new Error('useTransactionBuild must be used within a TransactionBuildProvider');
  }
  return context;
};

export const TransactionBuildProvider = ({ children, wallet, currentAccount, showToast }) => {
  const { sendRecipient, sendAmount, sendAssetType, setIntentStep, setSendRecipient } =
    useSendFlow();

  // The created PSBT intent
  const [sendIntent, setSendIntent] = useState(null);

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
      // Show error toast first, then transition after a brief delay
      showToast(parseErrorMessage(error), 'error');
      // Small delay to ensure toast is visible before screen transition
      setTimeout(() => {
        setIntentStep('entering_amount');
      }, 100);
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
      // Show error toast first, then transition after a brief delay
      showToast(parseErrorMessage(error), 'error');
      // Small delay to ensure toast is visible before screen transition
      setTimeout(() => {
        setIntentStep('entering_amount');
      }, 100);
    }
  };

  // Main create intent function (routes to BTC or UNIT)
  const createSendIntent = async () => {
    const trimmedRecipient = sendRecipient.trim();
    setIntentStep('creating');

    // Validate inputs
    if (!trimmedRecipient || !sendAmount) {
      showToast(ERRORS.MISSING_RECIPIENT_AMOUNT, 'error');
      setTimeout(() => {
        setIntentStep('entering_amount');
      }, 100);
      return;
    }

    // Update the state with trimmed recipient
    setSendRecipient(trimmedRecipient);

    // Branch based on asset type
    // Error handling is done within each specific create function
    if (sendAssetType === 'btc') {
      await createBtcIntent();
    } else if (sendAssetType === 'unit') {
      await createUnitIntent();
    } else {
      showToast(ERRORS.ASSET_SELECTION_REQUIRED, 'error');
      setTimeout(() => {
        setIntentStep('selecting_asset');
      }, 100);
    }
  };

  const value = {
    // State
    sendIntent,

    // Setters
    setSendIntent,

    // Handlers
    createSendIntent,
  };

  return (
    <TransactionBuildContext.Provider value={value}>{children}</TransactionBuildContext.Provider>
  );
};
