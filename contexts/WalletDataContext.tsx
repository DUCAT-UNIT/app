/**
 * WalletDataContext - Slim coordinator for wallet data sub-providers
 * Composes BalanceProvider, VaultProvider, TransactionHistoryProvider, EcashTokensProvider
 * Owns polling logic and initialization sequencing
 */

import React, { ReactNode, useCallback, useEffect, useRef } from 'react';
import { usePolling } from '../hooks/usePolling';
import { logger } from '../utils/logger';
import { BalanceProvider, useBalance } from './BalanceContext';
import { useCashuBalanceState } from './CashuContext';
import { EcashTokensProvider, useEcashTokens } from './EcashTokensContext';
import { TransactionHistoryProvider, useTransactionHistory } from './TransactionHistoryContext';
import { VaultProvider, useVaultData } from './VaultContext';
import { useWallet } from './WalletContext';

// Re-export hooks and types so existing imports from WalletDataContext keep working
export { useBalance, type BalanceDataValue } from './BalanceContext';
export { useTransactionHistory, type TransactionHistoryValue } from './TransactionHistoryContext';
export { useVaultData, type VaultDataValue } from './VaultContext';
export { useEcashTokens, type EcashTokensValue } from './EcashTokensContext';

// Polling interval (milliseconds)
const POLL_INTERVAL = 10000;

interface WalletDataProviderProps {
  children: ReactNode;
}

/**
 * Inner component that has access to all four sub-contexts.
 * Owns: polling, init sequencing, wallet-change resets.
 */
const WalletDataCoordinator: React.FC<WalletDataProviderProps> = ({ children }) => {
  const { wallet } = useWallet();
  const { isLoading: loadingCashu, balance: cashuBalance } = useCashuBalanceState();

  const balance = useBalance();
  const history = useTransactionHistory();
  const vault = useVaultData();
  const { fetchEcashTokens, resetEcashTokens } = useEcashTokens();

  // Track previous wallet to detect changes
  const prevWalletRef = useRef<typeof wallet | null>(null);

  // Consolidated fetch-state tracking
  const fetchStateRef = useRef({ initialBalancesLoaded: false, initialHistoryFetched: false });

  // Check if both balances have loaded at least once
  const hasRunesData = balance.runesBalance !== null && balance.runesBalance !== undefined && !balance.loadingBalance;
  const hasCashuData = cashuBalance !== null && cashuBalance !== undefined;
  const bothBalancesLoaded = hasRunesData && hasCashuData;

  useEffect(() => {
    if (bothBalancesLoaded && !fetchStateRef.current.initialBalancesLoaded) {
      logger.debug('[WalletDataContext] Both balances loaded, starting coordinated polling');
      fetchStateRef.current.initialBalancesLoaded = true;
    }
  }, [bothBalancesLoaded]);

  // Unified polling callback
  const pollAllData = useCallback(() => {
    if (!wallet) return;

    balance.fetchBalance();
    vault.fetchVault();

    if (fetchStateRef.current.initialBalancesLoaded) {
      history.fetchTransactionHistory();
      vault.fetchVaultTransactions();
      fetchEcashTokens();
    } else {
      logger.debug('[WalletDataContext] Skipping transaction history - waiting for balances to load', {
        hasRunesData,
        hasCashuData,
        loadingBalance: balance.loadingBalance,
        loadingCashu,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, balance.fetchBalance, vault.fetchVault, vault.fetchVaultTransactions, history.fetchTransactionHistory, fetchEcashTokens]);

  // Handle wallet changes - reset on removal, fetch on first load
  useEffect(() => {
    const prevWallet = prevWalletRef.current;
    prevWalletRef.current = wallet;

    if (!wallet) {
      balance.resetBalances();
      history.resetTransactionHistory();
      vault.resetVaultData();
      resetEcashTokens();
      fetchStateRef.current.initialBalancesLoaded = false;
      fetchStateRef.current.initialHistoryFetched = false;
    } else if (!prevWallet && wallet) {
      balance.fetchBalance();
      vault.fetchVault();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, balance.resetBalances, balance.fetchBalance, history.resetTransactionHistory, vault.resetVaultData, vault.fetchVault, resetEcashTokens]);

  // Trigger initial history/vault-tx/ecash load ONCE after both balances first load
  useEffect(() => {
    if (bothBalancesLoaded && fetchStateRef.current.initialBalancesLoaded && !fetchStateRef.current.initialHistoryFetched) {
      fetchStateRef.current.initialHistoryFetched = true;
      logger.debug('[WalletDataContext] Both balances ready - fetching transaction history, vault transactions, and ecash tokens');
      history.fetchTransactionHistory();
      vault.fetchVaultTransactions();
      fetchEcashTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothBalancesLoaded]);

  // Single unified polling mechanism — NOT immediate (wallet change effect handles first fetch)
  usePolling({
    onPoll: pollAllData,
    interval: POLL_INTERVAL,
    enabled: !!wallet,
    immediate: false,
  });

  return <>{children}</>;
};

export const WalletDataProvider: React.FC<WalletDataProviderProps> = ({ children }) => {
  return (
    <BalanceProvider>
      <VaultProvider>
        <TransactionHistoryProvider>
          <EcashTokensProvider>
            <WalletDataCoordinator>{children}</WalletDataCoordinator>
          </EcashTokensProvider>
        </TransactionHistoryProvider>
      </VaultProvider>
    </BalanceProvider>
  );
};
