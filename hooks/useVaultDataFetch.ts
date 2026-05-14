/**
 * useVaultDataFetch Hook
 * Manages vault data state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  fetchVaultData,
  fetchVaultHistory,
  VaultData,
  VaultHistoryTransaction,
  type FetchVaultHistoryOptions,
} from '../services/vaultService';
import { e2eVaultState } from '../utils/e2eVaultState';
import { isE2E } from '../utils/e2e';
import { logger } from '../utils/logger';
import { usePriceStore } from '../stores/priceStore';
import type { WalletAddresses } from '../contexts/WalletContext';

export interface UseVaultDataFetchReturn {
  vaultData: VaultData | null;
  loadingVault: boolean;
  vaultIsRefreshing: boolean;
  vaultLastUpdated: number | null;
  vaultIsStale: boolean;
  vaultError: string | null;
  fetchVault: (vaultPubkeyOverride?: string) => Promise<void>;
  resetVaultData: () => void;
  // Vault transactions (cached like BTC transaction history)
  vaultTransactions: VaultHistoryTransaction[];
  loadingVaultTransactions: boolean;
  vaultTransactionsIsRefreshing: boolean;
  vaultTransactionsLastUpdated: number | null;
  vaultTransactionsIsStale: boolean;
  fetchVaultTransactions: (
    vaultPubkeyOverride?: string,
    options?: FetchVaultHistoryOptions
  ) => Promise<void>;
}

const VAULT_STALE_AFTER_MS = 60_000;
const INITIAL_VAULT_HISTORY_LIMIT = 50;
const INITIAL_VAULT_HISTORY_LOOKBACK_DAYS = 120;

/**
 * Deep equality check for vault data
 * Only compares key fields to avoid unnecessary updates
 */
function isVaultDataEqual(prev: VaultData | null, next: VaultData | null): boolean {
  if (!prev && !next) return true;
  if (!prev || !next) return false;

  return (
    prev.vaultId === next.vaultId &&
    prev.totalCollateral === next.totalCollateral &&
    prev.totalDebt === next.totalDebt &&
    prev.vaultTag === next.vaultTag &&
    prev.currentPrice === next.currentPrice
  );
}

const seedBtcPriceFromVault = (data: VaultData | null): void => {
  if (typeof data?.currentPrice === 'number') {
    usePriceStore.getState().setFallbackBtcPrice(data.currentPrice);
  }
};

export function useVaultDataFetch(wallet: WalletAddresses | null): UseVaultDataFetchReturn {
  // Vault data state
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [loadingVault, setLoadingVault] = useState(false);
  const [vaultIsRefreshing, setVaultIsRefreshing] = useState(false);
  const [vaultLastUpdated, setVaultLastUpdated] = useState<number | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);

  // Vault transactions state (cached like BTC transaction history)
  const [vaultTransactions, setVaultTransactions] = useState<VaultHistoryTransaction[]>([]);
  const [loadingVaultTransactions, setLoadingVaultTransactions] = useState(false);
  const [vaultTransactionsIsRefreshing, setVaultTransactionsIsRefreshing] = useState(false);
  const [vaultTransactionsLastUpdated, setVaultTransactionsLastUpdated] = useState<number | null>(null);

  // Keep a ref to previous vault data for comparison
  const prevVaultDataRef = useRef<VaultData | null>(null);
  const prevWalletPubkeyRef = useRef<string | undefined>(undefined);
  const prevVaultTransactionsRef = useRef<VaultHistoryTransaction[]>([]);
  const vaultLoadedOnceRef = useRef(false);
  const vaultTxLoadedOnceRef = useRef(false);
  const vaultFetchInFlightRef = useRef(false);
  const vaultTxFetchInFlightRef = useRef(false);

  // Reset refs when wallet pubkey changes
  useEffect(() => {
    const currentPubkey = wallet?.taprootPubkey;
    if (currentPubkey !== prevWalletPubkeyRef.current) {
      prevVaultDataRef.current = null;
      prevVaultTransactionsRef.current = [];
      prevWalletPubkeyRef.current = currentPubkey;
    }
  }, [wallet?.taprootPubkey]);

  /**
   * Fetch vault data from validator API
   */
  const fetchVault = useCallback(async (vaultPubkeyOverride?: string): Promise<void> => {
    const vaultPubkey = vaultPubkeyOverride ?? wallet?.taprootPubkey;

    if (!vaultPubkey || vaultFetchInFlightRef.current) {
      return;
    }

    vaultFetchInFlightRef.current = true;
    try {
      // Only show loading on first fetch — avoids flicker on poll cycles
      if (!vaultLoadedOnceRef.current) {
        setLoadingVault(true);
      } else {
        setVaultIsRefreshing(true);
      }

      // E2E bypass: return fake vault data when vault was "created" via bypass
      if (isE2E() && e2eVaultState.vaultCreated) {
        const fakeData: VaultData = {
          vaultId: 'e2e-vault-001',
          vaultTag: 'e2e-test',
          totalDebt: e2eVaultState.unitBorrowed,
          totalCollateral: e2eVaultState.btcLocked,
          currentPrice: 100000,
          vaultInfo: {
            vault_id: 'e2e-vault-001',
            vault_tag: 'e2e-test',
            vault_pubkey: vaultPubkey,
            btc_locked: Math.round(e2eVaultState.btcLocked * 100_000_000),
            unit_borrowed: Math.round(e2eVaultState.unitBorrowed * 100),
            collateral_ratio: 200,
            creation_account: 'e2e-account',
            guard_pubkey: 'e2e-guard-pubkey',
            master_id: 'e2e-master-id',
            liquidation_hash: 'e2e-liq-hash',
            liquidation_price: 50000,
            oracle_price: 100000,
            oracle_timestamp: Math.floor(Date.now() / 1000),
            utxo: `e2e-vault-${Date.now().toString(16)}:0`,
            vault_last_action: 'open',
            vault_version: 1,
          },
        };
        if (!isVaultDataEqual(prevVaultDataRef.current, fakeData)) {
          prevVaultDataRef.current = fakeData;
          setVaultData(fakeData);
        }
        seedBtcPriceFromVault(fakeData);
        setVaultLastUpdated(Date.now());
        setVaultError(null);
        if (!vaultLoadedOnceRef.current) {
          vaultLoadedOnceRef.current = true;
          setLoadingVault(false);
        }
        return;
      }

      const data = await fetchVaultData(vaultPubkey);
      seedBtcPriceFromVault(data);

      if (data === null && prevVaultDataRef.current !== null) {
        setVaultError('Failed to fetch vault data');
        if (!vaultLoadedOnceRef.current) {
          vaultLoadedOnceRef.current = true;
          setLoadingVault(false);
        }
        return;
      }

      // Only update state if vault data has actually changed
      if (!isVaultDataEqual(prevVaultDataRef.current, data)) {
        prevVaultDataRef.current = data;
        setVaultData(data);
      }
      setVaultLastUpdated(Date.now());
      setVaultError(null);

      if (!vaultLoadedOnceRef.current) {
        vaultLoadedOnceRef.current = true;
        setLoadingVault(false);
      }
    } catch (error: unknown) {
      logger.error('[useVaultDataFetch] Failed to fetch vault data', { error: error instanceof Error ? error.message : String(error) });
      setVaultError('Failed to fetch vault data');
      if (!vaultLoadedOnceRef.current) {
        vaultLoadedOnceRef.current = true;
        setLoadingVault(false);
      }
    } finally {
      vaultFetchInFlightRef.current = false;
      setVaultIsRefreshing(false);
    }
  }, [wallet]);

  /**
   * Fetch vault transactions (history) from validator API
   * Cached in context to avoid refetching on every screen visit
   */
  const fetchVaultTransactions = useCallback(async (
    vaultPubkeyOverride?: string,
    options: FetchVaultHistoryOptions = {}
  ): Promise<void> => {
    const vaultPubkey = vaultPubkeyOverride ?? wallet?.taprootPubkey;

    if (!vaultPubkey || vaultTxFetchInFlightRef.current) {
      return;
    }

    vaultTxFetchInFlightRef.current = true;
    try {
      // Only show loading on first fetch, not background refreshes
      if (!vaultTxLoadedOnceRef.current) {
        setLoadingVaultTransactions(true);
      } else {
        setVaultTransactionsIsRefreshing(true);
      }

      const vaultId = options.vaultId ?? prevVaultDataRef.current?.vaultId;
      const transactions = await fetchVaultHistory(vaultPubkey, {
        vaultId,
        limit: options.limit ?? INITIAL_VAULT_HISTORY_LIMIT,
        maxPages: options.maxPages ?? 1,
        lookbackDays: options.lookbackDays ?? INITIAL_VAULT_HISTORY_LOOKBACK_DAYS,
      });

      // Only update state if transactions have actually changed
      // Compare by checking first and last transaction timestamps and length
      const prev = prevVaultTransactionsRef.current;
      const hasChanged =
        transactions.length !== prev.length ||
        (transactions.length > 0 && prev.length > 0 &&
          (transactions[0].timestamp !== prev[0].timestamp ||
           transactions[transactions.length - 1].timestamp !== prev[prev.length - 1].timestamp));

      if (hasChanged || prev.length === 0) {
        prevVaultTransactionsRef.current = transactions;
        setVaultTransactions(transactions);
      }
      setVaultTransactionsLastUpdated(Date.now());

      if (!vaultTxLoadedOnceRef.current) {
        vaultTxLoadedOnceRef.current = true;
        setLoadingVaultTransactions(false);
      }
    } catch (error: unknown) {
      logger.error('[useVaultDataFetch] Failed to fetch vault transactions', { error: error instanceof Error ? error.message : String(error) });
      if (!vaultTxLoadedOnceRef.current) {
        vaultTxLoadedOnceRef.current = true;
        setLoadingVaultTransactions(false);
      }
    } finally {
      vaultTxFetchInFlightRef.current = false;
      setVaultTransactionsIsRefreshing(false);
    }
  }, [wallet]);

  /**
   * Reset vault data (called when wallet is reset)
   */
  const resetVaultData = useCallback((): void => {
    setVaultData(null);
    setVaultTransactions([]);
    setVaultIsRefreshing(false);
    setVaultLastUpdated(null);
    setVaultTransactionsIsRefreshing(false);
    setVaultTransactionsLastUpdated(null);
    prevVaultDataRef.current = null;
    prevVaultTransactionsRef.current = [];
    vaultLoadedOnceRef.current = false;
    vaultTxLoadedOnceRef.current = false;
    vaultFetchInFlightRef.current = false;
    vaultTxFetchInFlightRef.current = false;
  }, []);

  return useMemo(() => ({
    // State
    vaultData,
    loadingVault,
    vaultIsRefreshing,
    vaultLastUpdated,
    vaultIsStale: vaultLastUpdated !== null && Date.now() - vaultLastUpdated > VAULT_STALE_AFTER_MS,
    vaultError,
    // Vault transactions
    vaultTransactions,
    loadingVaultTransactions,
    vaultTransactionsIsRefreshing,
    vaultTransactionsLastUpdated,
    vaultTransactionsIsStale: vaultTransactionsLastUpdated !== null && Date.now() - vaultTransactionsLastUpdated > VAULT_STALE_AFTER_MS,
    // Functions
    fetchVault,
    resetVaultData,
    fetchVaultTransactions,
  }), [
    vaultData,
    loadingVault,
    vaultIsRefreshing,
    vaultLastUpdated,
    vaultError,
    vaultTransactions,
    loadingVaultTransactions,
    vaultTransactionsIsRefreshing,
    vaultTransactionsLastUpdated,
    fetchVault,
    resetVaultData,
    fetchVaultTransactions,
  ]);
}
