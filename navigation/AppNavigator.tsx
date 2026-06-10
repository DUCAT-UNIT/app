/**
 * AppNavigator - Main navigation controller
 * Orchestrates context setup and delegates to child components
 */

import React, { useRef, useCallback } from 'react';

// Contexts
import { useAuthSession } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useBalance, useTransactionHistory as useTransactionHistoryContext } from '../contexts/WalletDataContext';

// Hooks
import { useNotifications as useNotificationsHook } from '../hooks/useNotifications';
import { useTransactionPolling } from '../hooks/useTransactionPolling';
import { useNotificationsPreference } from '../hooks/useNotificationsPreference';

// Local components
import AppProvidersWrapper from './AppProvidersWrapper';

/**
 * Main app navigator component
 * Gathers context values and passes them to the providers wrapper
 */
export default function AppNavigator(): React.JSX.Element {
  // Get wallet and auth contexts (available from App.js providers)
  const {
    wallet,
    currentAccount,
    walletProfile,
  } = useWallet();
  const { fetchBalance } = useBalance();
  const historyContext = useTransactionHistoryContext();

  // Safely extract fetchTransactionHistory with fallback
  const fetchTransactionHistory = useCallback(() => {
    if (historyContext?.fetchTransactionHistory) {
      historyContext.fetchTransactionHistory();
    }
  }, [historyContext]);

  const {
    isBiometricSupported,
    setIsAuthenticated,
  } = useAuthSession();

  // Hooks
  const { sendTransactionConfirmedNotification } = useNotificationsHook();
  const { startPolling } = useTransactionPolling();

  // Wallet exists ref (shared between components)
  const walletExists = useRef(false);

  // Load notificationsEnabled early so we can pass to TransactionProvider
  const { notificationsEnabled } = useNotificationsPreference();

  // Wrap with remaining providers (AuthProvider already provided by App.js)
  return (
    <AppProvidersWrapper
      wallet={wallet}
      currentAccount={currentAccount}
      walletProfile={walletProfile}
      notificationsEnabled={notificationsEnabled}
      startPolling={startPolling}
      sendTransactionConfirmedNotification={sendTransactionConfirmedNotification}
      fetchBalance={fetchBalance}
      fetchTransactionHistory={fetchTransactionHistory}
      setIsAuthenticated={setIsAuthenticated}
      isBiometricSupported={isBiometricSupported}
      walletExists={walletExists}
    />
  );
}
