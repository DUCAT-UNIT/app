/**
 * TransactionBuildContext - Handles transaction PSBT creation
 * Builds unsigned PSBTs from user inputs
 * Depends on SendFlowContext for form data
 */

import React, { createContext, useContext, useState, useMemo } from 'react';
import { useSendFlow } from './SendFlowContext';
import { usePendingTransactions } from './PendingTransactionsContext';
import { useBalance } from './WalletDataContext';
import { useTransactionBuilder } from '../hooks/useTransactionBuilder';

const TransactionBuildContext = createContext();

export const useTransactionBuild = () => {
  const context = useContext(TransactionBuildContext);
  if (!context) {
    throw new Error('useTransactionBuild must be used within a TransactionBuildProvider');
  }
  return context;
};

export const TransactionBuildProvider = ({ children, wallet, currentAccount, showToast }) => {
  const {
    sendRecipient,
    sendAmount,
    sendAssetType,
    requireConfirmedUtxos,
    setIntentStep,
    setSendRecipient,
  } = useSendFlow();

  const {
    getUnconfirmedUTXOs,
    getSpentUtxos,
    unmarkUtxosAsSpent,
    markUtxosAsSpent,
  } = usePendingTransactions();

  const { runesBalance } = useBalance();

  // The created PSBT intent
  const [sendIntent, setSendIntent] = useState(null);

  // Transaction building logic
  const { createSendIntent, cancelIntent } = useTransactionBuilder({
    wallet,
    currentAccount,
    sendRecipient,
    sendAmount,
    sendAssetType,
    requireConfirmedUtxos,
    runesBalance,
    sendIntent,
    setSendIntent,
    setIntentStep,
    showToast,
    getUnconfirmedUTXOs,
    getSpentUtxos,
    markUtxosAsSpent,
    unmarkUtxosAsSpent,
    setSendRecipient,
  });

  const value = useMemo(
    () => ({
      sendIntent,
      setSendIntent,
      createSendIntent,
      cancelIntent,
    }),
    [sendIntent, createSendIntent, cancelIntent]
  );

  return (
    <TransactionBuildContext.Provider value={value}>{children}</TransactionBuildContext.Provider>
  );
};
