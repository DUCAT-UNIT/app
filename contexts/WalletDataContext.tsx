/**
 * WalletDataContext - Slim coordinator for wallet data sub-providers
 * Composes BalanceProvider, VaultProvider, TransactionHistoryProvider, EcashTokensProvider
 * Owns polling logic and initialization sequencing
 */

import React, { ReactNode, useCallback, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useAuthSession } from './AuthContext';
import { EvmAssetsProvider } from './EvmAssetsContext';
import { usePolling } from '../hooks/usePolling';
import { runWalletReconciliationCycle } from '../services/reconciliationWorker';
import { logger } from '../utils/logger';
import { BalanceProvider, useBalance } from './BalanceContext';
import { useCashuBalanceState } from './CashuContext';
import { EcashTokensProvider, useEcashTokens } from './EcashTokensContext';
import { useEvmAssets } from './EvmAssetsContext';
import { TransactionHistoryProvider, useTransactionHistory } from './TransactionHistoryContext';
import { VaultProvider, useVaultData } from './VaultContext';
import { useWallet } from './WalletContext';

// Re-export hooks and types so existing imports from WalletDataContext keep working
export { useBalance, type BalanceDataValue } from './BalanceContext';
export { useTransactionHistory, type TransactionHistoryValue } from './TransactionHistoryContext';
export { useVaultData, type VaultDataValue } from './VaultContext';
export { useEcashTokens, type EcashTokensValue } from './EcashTokensContext';
export { useEvmAssets, type EvmAssetsValue } from './EvmAssetsContext';

// Polling intervals (milliseconds)
const BALANCE_POLL_INTERVAL = 15000;
const SECONDARY_POLL_INTERVAL = 45000;
const RECONCILIATION_POLL_INTERVAL = 30000;

interface WalletDataProviderProps {
  children: ReactNode;
}

/**
 * Inner component that has access to all four sub-contexts.
 * Owns: polling, init sequencing, wallet-change resets.
 */
const WalletDataCoordinator: React.FC<WalletDataProviderProps> = ({ children }) => {
  const { wallet } = useWallet();
  const { isAuthenticated } = useAuthSession();
  const activeWallet = isAuthenticated ? wallet : null;
  const { isLoading: loadingCashu, balance: cashuBalance } = useCashuBalanceState();

  const balance = useBalance();
  const history = useTransactionHistory();
  const vault = useVaultData();
  const { fetchEcashTokens, resetEcashTokens } = useEcashTokens();
  const {
    refreshEvmBalances,
    refreshUsdcHistory,
    refreshEthHistory,
  } = useEvmAssets();
  const {
    fetchBalance,
    resetBalances,
    loadingBalance,
    runesBalance,
  } = balance;
  const {
    fetchVault,
    fetchVaultTransactions,
    resetVaultData,
  } = vault;
  const {
    fetchTransactionHistory,
    resetTransactionHistory,
  } = history;

  // Track previous wallet to detect changes
  const prevWalletRef = useRef<typeof wallet | null>(null);

  // Consolidated fetch-state tracking
  const fetchStateRef = useRef({ initialBalancesLoaded: false, initialHistoryFetched: false });
  const initialSecondaryTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);

  // Check if both balances have loaded at least once
  const hasRunesData = runesBalance !== null && runesBalance !== undefined && !loadingBalance;
  const hasCashuData = cashuBalance !== null && cashuBalance !== undefined;
  const bothBalancesLoaded = hasRunesData && hasCashuData;

  useEffect(() => {
    if (bothBalancesLoaded && !fetchStateRef.current.initialBalancesLoaded) {
      logger.debug('[WalletDataContext] Both balances loaded, starting coordinated polling');
      fetchStateRef.current.initialBalancesLoaded = true;
    }
  }, [bothBalancesLoaded]);

  const pollBalancesAndVault = useCallback(() => {
    if (!activeWallet) return;

    fetchBalance();
    fetchVault();
  }, [activeWallet, fetchBalance, fetchVault]);

  const pollSecondaryData = useCallback(() => {
    if (!activeWallet) return;

    if (fetchStateRef.current.initialBalancesLoaded) {
      fetchTransactionHistory();
      fetchVaultTransactions();
      fetchEcashTokens();
    } else {
      logger.debug('[WalletDataContext] Skipping transaction history - waiting for balances to load', {
        hasRunesData,
        hasCashuData,
        loadingBalance,
        loadingCashu,
      });
    }
  }, [activeWallet, fetchVaultTransactions, fetchTransactionHistory, fetchEcashTokens, hasRunesData, hasCashuData, loadingBalance, loadingCashu]);

  const pollReconciliation = useCallback(() => {
    if (!activeWallet || !fetchStateRef.current.initialBalancesLoaded) return;

    runWalletReconciliationCycle({
      enabled: true,
      fetchBalance,
      fetchVault,
      fetchVaultTransactions,
      fetchTransactionHistory,
      fetchEcashTokens,
      refreshEvmBalances,
      refreshUsdcHistory,
      refreshEthHistory,
    }).catch((error) => {
      logger.debug('[WalletDataContext] Reconciliation cycle failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, [
    activeWallet,
    fetchBalance,
    fetchVault,
    fetchVaultTransactions,
    fetchTransactionHistory,
    fetchEcashTokens,
    refreshEvmBalances,
    refreshUsdcHistory,
    refreshEthHistory,
  ]);

  // Handle wallet changes - reset on removal, fetch on first load
  useEffect(() => {
    const prevWallet = prevWalletRef.current;
    prevWalletRef.current = activeWallet;

    if (!activeWallet) {
      initialSecondaryTaskRef.current?.cancel();
      initialSecondaryTaskRef.current = null;
      resetBalances();
      resetTransactionHistory();
      resetVaultData();
      resetEcashTokens();
      fetchStateRef.current.initialBalancesLoaded = false;
      fetchStateRef.current.initialHistoryFetched = false;
    } else if (!prevWallet && activeWallet) {
      fetchBalance();
      fetchVault();
    }
  }, [activeWallet, resetBalances, fetchBalance, resetTransactionHistory, resetVaultData, fetchVault, resetEcashTokens]);

  // Trigger initial history/vault-tx/ecash load ONCE after both balances first load
  useEffect(() => {
    if (bothBalancesLoaded && fetchStateRef.current.initialBalancesLoaded && !fetchStateRef.current.initialHistoryFetched) {
      fetchStateRef.current.initialHistoryFetched = true;
      initialSecondaryTaskRef.current?.cancel();
      initialSecondaryTaskRef.current = InteractionManager.runAfterInteractions(() => {
        logger.debug('[WalletDataContext] Both balances ready - fetching secondary wallet data after interactions');
        fetchTransactionHistory();
        fetchVaultTransactions();
        fetchEcashTokens();
      });
    }
    return () => {
      initialSecondaryTaskRef.current?.cancel();
      initialSecondaryTaskRef.current = null;
    };
  }, [bothBalancesLoaded, fetchTransactionHistory, fetchVaultTransactions, fetchEcashTokens]);

  // Single unified polling mechanism — NOT immediate (wallet change effect handles first fetch)
  usePolling({
    onPoll: pollBalancesAndVault,
    interval: BALANCE_POLL_INTERVAL,
    enabled: !!activeWallet,
    immediate: false,
  });

  usePolling({
    onPoll: pollSecondaryData,
    interval: SECONDARY_POLL_INTERVAL,
    enabled: !!activeWallet,
    immediate: false,
  });

  usePolling({
    onPoll: pollReconciliation,
    interval: RECONCILIATION_POLL_INTERVAL,
    enabled: !!activeWallet,
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
            <EvmAssetsProvider>
              <WalletDataCoordinator>{children}</WalletDataCoordinator>
            </EvmAssetsProvider>
          </EcashTokensProvider>
        </TransactionHistoryProvider>
      </VaultProvider>
    </BalanceProvider>
  );
};
