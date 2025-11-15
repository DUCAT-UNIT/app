/**
 * useVaultDataFetch Hook
 * Manages vault data state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 */

import { useState, useCallback, useRef } from 'react';
import { fetchVaultData } from '../services/vaultService';

/**
 * Deep equality check for vault data
 * Only compares key fields to avoid unnecessary updates
 */
function isVaultDataEqual(prev, next) {
  if (!prev && !next) return true;
  if (!prev || !next) return false;

  return (
    prev.totalCollateral === next.totalCollateral &&
    prev.totalDebt === next.totalDebt &&
    prev.vaultTag === next.vaultTag
  );
}

export function useVaultDataFetch(wallet) {
  // Vault data state
  const [vaultData, setVaultData] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);
  const [vaultError, setVaultError] = useState(null);

  // Keep a ref to previous vault data for comparison
  const prevVaultDataRef = useRef(null);

  /**
   * Fetch vault data from validator API
   */
  const fetchVault = useCallback(async () => {
    const vaultPubkey = wallet?.taprootPubkey;

    if (!vaultPubkey) {
      return;
    }

    try {
      setLoadingVault(true);
      setVaultError(null);
      const data = await fetchVaultData(vaultPubkey);

      // Only update state if vault data has actually changed
      if (!isVaultDataEqual(prevVaultDataRef.current, data)) {
        console.log('[VaultFetch] UPDATING STATE - vault data changed');
        prevVaultDataRef.current = data;
        setVaultData(data);
      } else {
        console.log('[VaultFetch] SKIPPING UPDATE - vault data unchanged');
      }
    } catch (error) {
      setVaultError('Failed to fetch vault data');
    } finally {
      setLoadingVault(false);
    }
  }, [wallet]);

  /**
   * Reset vault data (called when wallet is reset)
   */
  const resetVaultData = useCallback(() => {
    setVaultData(null);
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
