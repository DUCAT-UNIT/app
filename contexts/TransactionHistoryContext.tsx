/**
 * TransactionHistoryContext - Manages transaction history state
 * Extracted from WalletDataContext for single-responsibility
 */

import React, { createContext, ReactNode, useContext } from 'react';
import { useTransactionHistoryFetch, UseTransactionHistoryFetchReturn } from '../hooks/useTransactionHistoryFetch';
import { useWallet } from './WalletContext';

export type TransactionHistoryValue = UseTransactionHistoryFetchReturn;

const HistoryCtx = createContext<TransactionHistoryValue | undefined>(undefined);

export const useTransactionHistory = (): TransactionHistoryValue => {
  const context = useContext(HistoryCtx);
  if (!context) {
    throw new Error('useTransactionHistory must be used within a TransactionHistoryProvider');
  }
  return context;
};

interface TransactionHistoryProviderProps {
  children: ReactNode;
}

export const TransactionHistoryProvider: React.FC<TransactionHistoryProviderProps> = ({ children }) => {
  const { wallet } = useWallet();

  const history = useTransactionHistoryFetch(wallet);

  return <HistoryCtx.Provider value={history}>{children}</HistoryCtx.Provider>;
};
