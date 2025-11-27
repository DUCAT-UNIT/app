/**
 * TransactionBuildContext - Handles transaction PSBT creation
 * Builds unsigned PSBTs from user inputs
 * Depends on SendFlowContext for form data
 */

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { useSendFlow } from './SendFlowContext';
import { usePendingTransactions } from './PendingTransactionsContext';
import { useBalance } from './WalletDataContext';
import { useTransactionBuilder } from '../hooks/useTransactionBuilder';
import type { SendIntent, RuneBalanceItem } from '../hooks/useTransactionBuilder';
import type { WalletAddresses } from './WalletContext';
import type { TransactionIntent } from '../utils/pendingTransactionsUtils';

// Re-export SendIntent from the hook for consumers
export type { SendIntent } from '../hooks/useTransactionBuilder';

interface TransactionBuildContextValue {
  sendIntent: SendIntent | null;
  setSendIntent: React.Dispatch<React.SetStateAction<SendIntent | null>>;
  createSendIntent: () => Promise<void>;
  cancelIntent: () => void;
}

const TransactionBuildContext = createContext<TransactionBuildContextValue | undefined>(undefined);

export const useTransactionBuild = (): TransactionBuildContextValue => {
  const context = useContext(TransactionBuildContext);
  if (!context) {
    throw new Error('useTransactionBuild must be used within a TransactionBuildProvider');
  }
  return context;
};

interface TransactionBuildProviderProps {
  children: ReactNode;
  wallet: WalletAddresses | null;
  currentAccount: number;
}

export const TransactionBuildProvider: React.FC<TransactionBuildProviderProps> = ({
  children,
  wallet,
  currentAccount,
}) => {
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
  const [sendIntent, setSendIntent] = useState<SendIntent | null>(null);

  // Transaction building logic
  const { createSendIntent, cancelIntent } = useTransactionBuilder({
    wallet,
    currentAccount,
    sendRecipient,
    sendAmount,
    sendAssetType,
    requireConfirmedUtxos,
    runesBalance: runesBalance,
    sendIntent,
    setSendIntent,
    setIntentStep,
    getUnconfirmedUTXOs: (addressType, excludeFromIntent) =>
      getUnconfirmedUTXOs(addressType, excludeFromIntent as TransactionIntent | null),
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
