/**
 * useVaultDataFetch Hook
 * Manages vault data state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchVaultData, fetchVaultHistory, VaultData, VaultHistoryTransaction } from '../services/vaultService';
import { e2eVaultState } from '../utils/e2eVaultState';
import logger from '../utils/logger';
import type { WalletAddresses } from '../contexts/WalletContext';

export interface UseVaultDataFetchReturn {
  vaultData: VaultData | null;
  loadingVault: boolean;
  vaultError: string | null;
  fetchVault: () => Promise<void>;
  resetVaultData: () => void;
  // Vault transactions (cached like BTC transaction history)
  vaultTransactions: VaultHistoryTransaction[];
  loadingVaultTransactions: boolean;
  fetchVaultTransactions: () => Promise<void>;
}

/**
 * Deep equality check for vault data
 * Only compares key fields to avoid unnecessary updates
 */
function isVaultDataEqual(prev: VaultData | null, next: VaultData | null): boolean {
  if (!prev && !next) return true;
  if (!prev || !next) return false;

  return (
    prev.totalCollateral === next.totalCollateral &&
    prev.totalDebt === next.totalDebt &&
    prev.vaultTag === next.vaultTag
  );
}

export function useVaultDataFetch(wallet: WalletAddresses | null): UseVaultDataFetchReturn {
  // Vault data state
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [loadingVault, setLoadingVault] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  // Vault transactions state (cached like BTC transaction history)
  const [vaultTransactions, setVaultTransactions] = useState<VaultHistoryTransaction[]>([]);
  const [loadingVaultTransactions, setLoadingVaultTransactions] = useState(false);

  // Keep a ref to previous vault data for comparison
  const prevVaultDataRef = useRef<VaultData | null>(null);
  const prevWalletPubkeyRef = useRef<string | undefined>(undefined);
  const prevVaultTransactionsRef = useRef<VaultHistoryTransaction[]>([]);

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
  const fetchVault = useCallback(async (): Promise<void> => {
    const vaultPubkey = wallet?.taprootPubkey;

    if (!vaultPubkey) {
      return;
    }

    try {
      setLoadingVault(true);
      setVaultError(null);

      // E2E bypass: return fake vault data when vault was "created" via bypass
      if (__DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true' && e2eVaultState.vaultCreated) {
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
        setLoadingVault(false);
        return;
      }

      const data = await fetchVaultData(vaultPubkey);

      // Only update state if vault data has actually changed
      if (!isVaultDataEqual(prevVaultDataRef.current, data)) {
        prevVaultDataRef.current = data;
        setVaultData(data);
      }
    } catch (error: unknown) {
      logger.error('[useVaultDataFetch] Failed to fetch vault data', { error: error instanceof Error ? error.message : String(error) });
      setVaultError('Failed to fetch vault data');
    } finally {
      setLoadingVault(false);
    }
  }, [wallet]);

  /**
   * Fetch vault transactions (history) from validator API
   * Cached in context to avoid refetching on every screen visit
   */
  const fetchVaultTransactions = useCallback(async (): Promise<void> => {
    const vaultPubkey = wallet?.taprootPubkey;

    if (!vaultPubkey) {
      return;
    }

    try {
      // Only show loading on initial fetch, not background refreshes
      if (vaultTransactions.length === 0) {
        setLoadingVaultTransactions(true);
      }

      const transactions = await fetchVaultHistory(vaultPubkey);

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
    } catch (error: unknown) {
      logger.error('[useVaultDataFetch] Failed to fetch vault transactions', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoadingVaultTransactions(false);
    }
  }, [wallet, vaultTransactions.length]);

  /**
   * Reset vault data (called when wallet is reset)
   */
  const resetVaultData = useCallback((): void => {
    setVaultData(null);
    setVaultTransactions([]);
    prevVaultDataRef.current = null;
    prevVaultTransactionsRef.current = [];
  }, []);

  return {
    // State
    vaultData,
    loadingVault,
    vaultError,
    // Vault transactions
    vaultTransactions,
    loadingVaultTransactions,
    // Functions
    fetchVault,
    resetVaultData,
    fetchVaultTransactions,
  };
}
