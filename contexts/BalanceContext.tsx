/**
 * BalanceContext - Manages wallet balance state
 * Extracted from WalletDataContext for single-responsibility
 */

import React, { createContext, ReactNode, useContext } from 'react';
import { useBalanceData, UseBalanceDataReturn } from '../hooks/useBalanceData';
import { usePendingTransactionsStore } from '../stores/pendingTransactionsStore';
import { useAuthSession } from './AuthContext';
import { useWallet } from './WalletContext';

export type BalanceDataValue = UseBalanceDataReturn;

const BalanceCtx = createContext<BalanceDataValue | undefined>(undefined);

export const useBalance = (): BalanceDataValue => {
  const context = useContext(BalanceCtx);
  if (!context) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
};

interface BalanceProviderProps {
  children: ReactNode;
}

export const BalanceProvider: React.FC<BalanceProviderProps> = ({ children }) => {
  const { wallet } = useWallet();
  const { isAuthenticated } = useAuthSession();
  const { getUnconfirmedBalance, getUnconfirmedUTXOs } = usePendingTransactionsStore();

  const balance = useBalanceData(isAuthenticated ? wallet : null, getUnconfirmedBalance, getUnconfirmedUTXOs);

  return <BalanceCtx.Provider value={balance}>{children}</BalanceCtx.Provider>;
};
