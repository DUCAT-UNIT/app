/**
 * WalletDataContext - Consolidated wallet data management
 * Merges BalanceContext, TransactionHistoryContext, and VaultDataContext
 * Manages all wallet-related data fetching with unified auto-refresh logic
 */

import React, { createContext, useContext, useEffect, useCallback, useMemo, useRef, useState, ReactNode } from 'react';
import { useWallet } from './WalletContext';
import { usePendingTransactionsStore } from '../stores/pendingTransactionsStore';
import { useCashuBalanceState } from './CashuContext';
import { usePolling } from '../hooks/usePolling';
import { useBalanceData, UseBalanceDataReturn } from '../hooks/useBalanceData';
import { useTransactionHistoryFetch, UseTransactionHistoryFetchReturn } from '../hooks/useTransactionHistoryFetch';
import { useVaultDataFetch, UseVaultDataFetchReturn } from '../hooks/useVaultDataFetch';
import { getSentLockedTokens, getReceivedTokens, subscribeToTokenChanges } from '../services/cashu/cashuLockedTokensService';
import { loadTokensWithStatus, TokenWithStatus } from '../services/cashu/tokenStatusService';
import { usePendingVaultTransactionStore } from '../stores/pendingVaultTransactionStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useSendFlowStore } from '../stores/sendFlowStore';
import { logger } from '../utils/logger';

// Polling intervals (in milliseconds)
const POLL_INTERVAL = 10000; // 10 seconds - for balance and vault data

// Use hook return types directly for consistency
export type BalanceDataValue = UseBalanceDataReturn;
export type TransactionHistoryValue = UseTransactionHistoryFetchReturn;
export type VaultDataValue = UseVaultDataFetchReturn;

// Ecash tokens context value
export interface EcashTokensValue {
  ecashTokens: TokenWithStatus[];
  loadingEcashTokens: boolean;
  fetchEcashTokens: () => Promise<void>;
  resetEcashTokens: () => void;
}

// PERFORMANCE: Split into 4 separate contexts to prevent unnecessary re-renders
// When balance changes, only components using useBalance() will re-render
// When history changes, only components using useTransactionHistory() will re-render
// When vault changes, only components using useVaultData() will re-render
// When ecash tokens change, only components using useEcashTokens() will re-render
const BalanceContext = createContext<BalanceDataValue | undefined>(undefined);
const HistoryContext = createContext<TransactionHistoryValue | undefined>(undefined);
const VaultDataContext = createContext<VaultDataValue | undefined>(undefined);
const EcashTokensContext = createContext<EcashTokensValue | undefined>(undefined);
// OPTIMIZED: Direct context access - no re-render unless balance changes
export const useBalance = (): BalanceDataValue => {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error('useBalance must be used within a WalletDataProvider');
  }
  return context;
};

// OPTIMIZED: Direct context access - no re-render unless history changes
export const useTransactionHistory = (): TransactionHistoryValue => {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useTransactionHistory must be used within a WalletDataProvider');
  }
  return context;
};

// OPTIMIZED: Direct context access - no re-render unless vault changes
export const useVaultData = (): VaultDataValue => {
  const context = useContext(VaultDataContext);
  if (!context) {
    throw new Error('useVaultData must be used within a WalletDataProvider');
  }
  return context;
};

// OPTIMIZED: Direct context access - no re-render unless ecash tokens change
export const useEcashTokens = (): EcashTokensValue => {
  const context = useContext(EcashTokensContext);
  if (!context) {
    throw new Error('useEcashTokens must be used within a WalletDataProvider');
  }
  return context;
};

interface WalletDataProviderProps {
  children: ReactNode;
}

export const WalletDataProvider: React.FC<WalletDataProviderProps> = ({ children }) => {
  const { wallet } = useWallet();
  const { getUnconfirmedBalance, getUnconfirmedUTXOs } = usePendingTransactionsStore();
  const { isLoading: loadingCashu, balance: cashuBalance } = useCashuBalanceState();

  // ============================================================
  // USE EXTRACTED HOOKS FOR DATA MANAGEMENT
  // ============================================================

  // Balance data hook - pass getUnconfirmedUTXOs to filter out already-confirmed UTXOs
  const balance = useBalanceData(wallet, getUnconfirmedBalance, getUnconfirmedUTXOs);

  // Transaction history data hook
  const history = useTransactionHistoryFetch(wallet);

  // Vault data hook
  const vault = useVaultDataFetch(wallet);

  // ============================================================
  // ECASH TOKENS STATE (pre-loaded for instant access)
  // ============================================================
  const [ecashTokens, setEcashTokens] = useState<TokenWithStatus[]>([]);
  const [loadingEcashTokens, setLoadingEcashTokens] = useState(false);
  const ecashFetchingRef = useRef(false);

  // Fetch ecash tokens for the current wallet
  const fetchEcashTokens = useCallback(async () => {
    if (!wallet?.taprootAddress || ecashFetchingRef.current) return;

    ecashFetchingRef.current = true;
    // Only show loading on initial fetch, not background refreshes
    if (ecashTokens.length === 0) {
      setLoadingEcashTokens(true);
    }

    try {
      const tokensWithStatus = await loadTokensWithStatus(
        wallet.taprootAddress,
        getSentLockedTokens,
        getReceivedTokens
      );
      setEcashTokens(tokensWithStatus);
    } catch (error: unknown) {
      logger.error('[WalletDataContext] Failed to load ecash tokens:', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoadingEcashTokens(false);
      ecashFetchingRef.current = false;
    }
  }, [wallet?.taprootAddress, ecashTokens.length]);

  // Reset ecash tokens
  const resetEcashTokens = useCallback(() => {
    setEcashTokens([]);
    setLoadingEcashTokens(false);
  }, []);

  // Subscribe to token changes (send/receive) to auto-refresh
  useEffect(() => {
    if (!wallet) return;

    const unsubscribe = subscribeToTokenChanges(() => {
      logger.debug('[WalletDataContext] Token change detected, refreshing ecash tokens');
      void fetchEcashTokens();
    });

    return () => {
      unsubscribe();
    };
  }, [wallet, fetchEcashTokens]);

  // ============================================================
  // VAULT TRANSACTION CONFIRMATION CHECK
  // ============================================================
  // Check if pending vault transaction has been confirmed (appears in history)
  const pendingVaultTx = usePendingVaultTransactionStore((state) => state.pendingTransaction);

  useEffect(() => {
    if (pendingVaultTx && vault.vaultTransactions.length > 0) {
      logger.debug('[WalletDataContext] Checking vault tx confirmation', {
        pendingTxid: pendingVaultTx.txid,
        pendingVaultTxid: pendingVaultTx.vaultTxid,
        pendingAction: pendingVaultTx.action,
        historyCount: vault.vaultTransactions.length,
        historyTxIds: vault.vaultTransactions.slice(0, 5).map(tx => tx.transaction_id),
      });

      // Check if the pending transaction's txid matches any in the history
      const isConfirmed = vault.vaultTransactions.some(
        tx => tx.transaction_id === pendingVaultTx.txid ||
              tx.transaction_id === pendingVaultTx.vaultTxid
      );

      logger.debug('[WalletDataContext] Confirmation check result', { isConfirmed });

      if (isConfirmed) {
        // Transaction confirmed - clear pending state and show success snackbar
        const confirmedAction = pendingVaultTx.action;
        const confirmedTxid = pendingVaultTx.vaultTxid || pendingVaultTx.txid;
        logger.info('[WalletDataContext] Vault transaction confirmed', { action: confirmedAction, txid: confirmedTxid });
        usePendingVaultTransactionStore.getState().clearPendingTransaction();
        // Only show snackbar if no other snackbar is active and no send flow in progress —
        // avoids overwriting swap/send confirmation banners
        const currentSnackbar = useNotificationStore.getState().snackbar;
        const intentStep = useSendFlowStore.getState().intentStep;
        if (!currentSnackbar && intentStep === 'idle') {
          useNotificationStore.getState().showSnackbar({
            type: 'success',
            action: confirmedAction,
            txid: confirmedTxid,
          });
        } else {
          logger.debug('[WalletDataContext] Skipping vault confirmation snackbar', { hasSnackbar: !!currentSnackbar, intentStep });
        }
      }
    }
  }, [pendingVaultTx, vault.vaultTransactions]);

  // ============================================================
  // UNIFIED AUTO-REFRESH POLLING
  // ============================================================

  // Track previous wallet to detect changes (account switches)
  const prevWalletRef = useRef<typeof wallet | null>(null);

  // Track if initial balances have loaded (both runes and cashu)
  const initialBalancesLoadedRef = useRef(false);

  // Check if both balances have loaded at least once
  const hasRunesData = balance.runesBalance && balance.runesBalance.length >= 0;
  const hasCashuData = cashuBalance !== null && cashuBalance !== undefined;
  const bothBalancesLoaded = hasRunesData && hasCashuData;

  // Update ref when both balances have loaded
  if (bothBalancesLoaded && !initialBalancesLoadedRef.current) {
    logger.debug('[WalletDataContext] Both balances loaded, enabling transaction history fetch', {
      runesBalance: balance.runesBalance,
      cashuBalance,
    });
    initialBalancesLoadedRef.current = true;
  }

  // Unified polling callback - fetches all data on a coordinated schedule
  const pollAllData = useCallback(() => {
    if (!wallet) return;

    // Always fetch balance and vault
    balance.fetchBalance();
    vault.fetchVault();

    // Only fetch transaction history, vault transactions, and ecash tokens after both balances have loaded at least once
    if (initialBalancesLoadedRef.current) {
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

  // Handle wallet changes - reset data when removed, fetch on first load
  // NOTE: Account switches are handled by useAccountSwitcher in NavigationHandlersContext
  // which coordinates reset + fetch synchronously for snappier switching
  useEffect(() => {
    const prevWallet = prevWalletRef.current;
    prevWalletRef.current = wallet;

    if (!wallet) {
      // Wallet removed - reset all data
      balance.resetBalances();
      history.resetTransactionHistory();
      vault.resetVaultData();
      resetEcashTokens();
      initialBalancesLoadedRef.current = false;
    } else if (!prevWallet && wallet) {
      // Wallet just loaded for first time (import/creation) - fetch balances first
      // Transaction history and ecash tokens will be fetched by pollAllData once balances load
      balance.fetchBalance();
      vault.fetchVault();
    }
    // Account switches are handled by useAccountSwitcher - no action needed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, balance.resetBalances, balance.fetchBalance, history.resetTransactionHistory, vault.resetVaultData, vault.fetchVault, resetEcashTokens]);

  // Trigger initial transaction history, vault transactions, and ecash tokens load once both balances have loaded
  useEffect(() => {
    if (bothBalancesLoaded && initialBalancesLoadedRef.current) {
      logger.debug('[WalletDataContext] Both balances ready - fetching transaction history, vault transactions, and ecash tokens');
      history.fetchTransactionHistory();
      vault.fetchVaultTransactions();
      fetchEcashTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothBalancesLoaded]);

  // Single unified polling mechanism
  usePolling({
    onPoll: pollAllData,
    interval: POLL_INTERVAL,
    enabled: !!wallet,
    immediate: true,
  });

  // ============================================================
  // PERFORMANCE OPTIMIZATION: 4 Separate Memoized Values
  // ============================================================
  // Each value is memoized independently - only changes when its own data changes
  // This prevents cross-contamination of re-renders

  // Balance context value - only updates when balance data changes
  const balanceValue = useMemo(() => balance, [balance]);

  // History context value - only updates when history data changes
  const historyValue = useMemo(() => history, [history]);

  // Vault context value - only updates when vault data changes
  const vaultValue = useMemo(() => vault, [vault]);

  // Ecash tokens context value - only updates when ecash tokens change
  const ecashValue = useMemo((): EcashTokensValue => ({
    ecashTokens,
    loadingEcashTokens,
    fetchEcashTokens,
    resetEcashTokens,
  }), [ecashTokens, loadingEcashTokens, fetchEcashTokens, resetEcashTokens]);

  return (
    <BalanceContext.Provider value={balanceValue}>
      <HistoryContext.Provider value={historyValue}>
        <VaultDataContext.Provider value={vaultValue}>
          <EcashTokensContext.Provider value={ecashValue}>
            {children}
          </EcashTokensContext.Provider>
        </VaultDataContext.Provider>
      </HistoryContext.Provider>
    </BalanceContext.Provider>
  );
};
