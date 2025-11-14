/**
 * useVaultDataFetch Hook
 * Manages vault data state and fetching logic
 * Extracted from WalletDataContext for better separation of concerns
 */

import { useState, useCallback } from 'react';
import { fetchVaultData } from '../services/vaultService';

export function useVaultDataFetch(wallet) {
  // Vault data state
  const [vaultData, setVaultData] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);
  const [vaultError, setVaultError] = useState(null);

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
      setVaultData(data);
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
