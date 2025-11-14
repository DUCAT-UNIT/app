/**
 * VaultContext - Manages vault access, credentials, and navigation
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

import { deriveAddressesFromMnemonic } from '../utils/bitcoin';
import { withMnemonic } from '../services/authService';
import { logger } from '../utils/logger';

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

  // Load vault credentials in background whenever account changes
  useEffect(() => {
    const loadVaultCredentials = async () => {
      try {
        logger.debug('🏦 Loading vault credentials in background for account:', currentAccount);

        // Use withMnemonic to ensure proper cleanup of sensitive data
        await withMnemonic(async (mnemonic) => {
          // Derive addresses and public keys for current account
          const addresses = deriveAddressesFromMnemonic(mnemonic, currentAccount);

          // Set credentials for vault WebView (loads in background)
          setVaultCredentials({
            satsAddress: addresses.segwitAddress,
            satsPubkey: addresses.segwitPubkey,
            runesAddress: addresses.taprootAddress,
            runesPubkey: addresses.taprootPubkey,
            vaultAddress: addresses.taprootAddress,
            vaultPubkey: addresses.taprootPubkey,
          });
        });
      } catch (error) {
        // Silently handle - no mnemonic is expected for new users
        // Only log if it's a different error
        if (error.message !== 'Mnemonic not found') {
          logger.error('❌ Error loading vault credentials:', error);
        }
      }
    };

    loadVaultCredentials();
  }, [currentAccount]);

  const openVault = useCallback(async (shouldAutoCreate = false) => {
    try {
      // Switch to vault tab immediately for better UX
      setActiveTab('vault');

      // Trigger auto-create if requested by incrementing counter
      // Only increment if credentials are loaded successfully
      if (shouldAutoCreate && vaultCredentials) {
        setAutoCreateVaultTrigger((prev) => prev + 1);
      }
    } catch (error) {
      setActiveTab('vault');
    }
  }, [vaultCredentials]);

  const value = useMemo(
    () => ({
      vaultCredentials,
      autoCreateVaultTrigger,
      activeTab,
      setActiveTab,
      openVault,
    }),
    [vaultCredentials, autoCreateVaultTrigger, activeTab, openVault]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
};
