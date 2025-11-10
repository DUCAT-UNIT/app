/**
 * VaultContext - Manages vault access, credentials, and navigation
 */

import React, { createContext, useContext, useState } from 'react';
import { SECURE_KEYS } from '../utils/constants';
import { deriveAddressesFromMnemonic } from '../utils/bitcoin';
import { withMnemonic } from '../services/authService';

const VaultContext = createContext();

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};

export const VaultProvider = ({ children, currentAccount }) => {
  const [vaultCredentials, setVaultCredentials] = useState(null);
  const [autoCreateVaultTrigger, setAutoCreateVaultTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState('wallet');

  const openVault = async (shouldAutoCreate = false) => {
    console.log('[VaultContext] openVault called:', { shouldAutoCreate, currentAccount });
    try {
      // Switch to vault tab immediately for better UX
      setActiveTab('vault');
      console.log('[VaultContext] Switched to vault tab');

      // Use withMnemonic to ensure proper cleanup of sensitive data
      await withMnemonic(async (mnemonic) => {
        // Derive addresses and public keys for current account
        const addresses = deriveAddressesFromMnemonic(mnemonic, currentAccount);
        console.log('[VaultContext] Derived addresses:', {
          segwit: addresses.segwitAddress,
          taproot: addresses.taprootAddress,
        });

        // Set credentials for vault WebView
        setVaultCredentials({
          satsAddress: addresses.segwitAddress,
          satsPubkey: addresses.segwitPubkey,
          runesAddress: addresses.taprootAddress,
          runesPubkey: addresses.taprootPubkey,
          vaultAddress: addresses.taprootAddress,
          vaultPubkey: addresses.taprootPubkey,
        });
        console.log('[VaultContext] Set vault credentials');

        // Trigger auto-create if requested by incrementing counter
        if (shouldAutoCreate) {
          setAutoCreateVaultTrigger(prev => {
            const newValue = prev + 1;
            console.log('[VaultContext] Incrementing autoCreateVaultTrigger:', prev, '->', newValue);
            return newValue;
          });
        }
      });
      console.log('[VaultContext] openVault completed successfully');
    } catch (error) {
      console.error('[VaultContext] openVault error:', error);
      setActiveTab('vault');
    }
  };

  const value = {
    vaultCredentials,
    autoCreateVaultTrigger,
    activeTab,
    setActiveTab,
    openVault,
  };

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
};
