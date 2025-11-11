import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchVaultData } from '../services/vaultService';
import { useWallet } from './WalletContext';

const VaultDataContext = createContext();

export const useVaultData = () => {
  const context = useContext(VaultDataContext);
  if (!context) {
    throw new Error('useVaultData must be used within a VaultDataProvider');
  }
  return context;
};

export const VaultDataProvider = ({ children }) => {
  const { wallet } = useWallet();

  // Vault data state
  const [vaultData, setVaultData] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);

  /**
   * Fetch vault data from validator API
   */
  const fetchVault = useCallback(async () => {
    const vaultPubkey = wallet?.taprootPubkey;

    if (!vaultPubkey) return;

    try {
      setLoadingVault(true);
      const data = await fetchVaultData(vaultPubkey);
      setVaultData(data);
    } catch (error) {
      setVaultData(null);
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

  // Auto-refresh vault data every 10 seconds when wallet exists
  useEffect(() => {
    if (!wallet) {
      resetVaultData();
      return;
    }

    // Fetch vault data immediately
    fetchVault();

    // Set up interval to fetch every 10 seconds
    const interval = setInterval(() => {
      fetchVault();
    }, 10000);

    // Cleanup interval on unmount or when wallet changes
    return () => clearInterval(interval);
  }, [wallet, fetchVault, resetVaultData]);

  const value = {
    // State
    vaultData,
    loadingVault,

    // Functions
    fetchVault,
    resetVaultData,
  };

  return (
    <VaultDataContext.Provider value={value}>
      {children}
    </VaultDataContext.Provider>
  );
};
