/**
 * useVaultDataFetch Hook
 * Manages vault data state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchVaultData, VaultData } from '../services/vaultService';
import logger from '../utils/logger';
import type { WalletAddresses } from '../contexts/WalletContext';

interface UseVaultDataFetchReturn {
  vaultData: VaultData | null;
  loadingVault: boolean;
  vaultError: string | null;
  fetchVault: () => Promise<void>;
  resetVaultData: () => void;
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

  // Keep a ref to previous vault data for comparison
  const prevVaultDataRef = useRef<VaultData | null>(null);
  const prevWalletPubkeyRef = useRef<string | undefined>(undefined);

  // Reset prevVaultDataRef when wallet pubkey changes
  useEffect(() => {
    const currentPubkey = wallet?.taprootPubkey;
    if (currentPubkey !== prevWalletPubkeyRef.current) {
      logger.debug('[useVaultDataFetch] Wallet pubkey changed, resetting prevVaultDataRef', {
        prev: prevWalletPubkeyRef.current,
        current: currentPubkey,
      });
      prevVaultDataRef.current = null;
      prevWalletPubkeyRef.current = currentPubkey;
    }
  }, [wallet?.taprootPubkey]);

  /**
   * Fetch vault data from validator API
   */
  const fetchVault = useCallback(async (): Promise<void> => {
    const vaultPubkey = wallet?.taprootPubkey;

    if (!vaultPubkey) {
      logger.debug('[useVaultDataFetch] No vault pubkey, skipping fetch');
      return;
    }

    try {
      setLoadingVault(true);
      setVaultError(null);
      logger.debug('[useVaultDataFetch] Fetching vault data...');
      const data = await fetchVaultData(vaultPubkey);
      logger.debug('[useVaultDataFetch] Vault data fetched', data);

      // Only update state if vault data has actually changed
      const dataChanged = !isVaultDataEqual(prevVaultDataRef.current, data);
      logger.debug('[useVaultDataFetch] Vault data change check', {
        prevData: prevVaultDataRef.current,
        newData: data,
        changed: dataChanged,
      });

      if (dataChanged) {
        logger.debug('[useVaultDataFetch] Setting new vault data in state');
        prevVaultDataRef.current = data;
        setVaultData(data);
      } else {
        logger.debug('[useVaultDataFetch] Vault data unchanged, skipping state update');
      }
    } catch (error) {
      logger.error('[useVaultDataFetch] Failed to fetch vault data', { error: error instanceof Error ? error.message : String(error) });
      setVaultError('Failed to fetch vault data');
    } finally {
      setLoadingVault(false);
    }
  }, [wallet]);

  /**
   * Reset vault data (called when wallet is reset)
   */
  const resetVaultData = useCallback((): void => {
    setVaultData(null);
    prevVaultDataRef.current = null;
  }, []);

  return {
    // State
    vaultData,
    loadingVault,
    vaultError,
    // Functions
    fetchVault,
    resetVaultData,
  };
}
