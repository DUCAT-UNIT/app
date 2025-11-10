/**
 * VaultContext - Manages vault access, credentials, and navigation
 */

import React, { createContext, useContext, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';
import { deriveAddressesFromMnemonic } from '../utils/bitcoin';

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
    try {
      // Switch to vault tab immediately for better UX
      setActiveTab('vault');

      // Get mnemonic
      const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
      if (!mnemonic) {
        return;
      }

      // Derive addresses and public keys for current account
      const addresses = deriveAddressesFromMnemonic(mnemonic, currentAccount);

      // Set credentials for vault WebView
      setVaultCredentials({
        satsAddress: addresses.segwitAddress,
        satsPubkey: addresses.segwitPubkey,
        runesAddress: addresses.taprootAddress,
        runesPubkey: addresses.taprootPubkey,
        vaultAddress: addresses.taprootAddress,
        vaultPubkey: addresses.taprootPubkey,
      });

      // Trigger auto-create if requested by incrementing counter
      if (shouldAutoCreate) {
        setAutoCreateVaultTrigger(prev => prev + 1);
      }
    } catch (error) {
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
