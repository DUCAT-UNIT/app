import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import * as WalletService from '../services/walletService';
import { useNotifications } from './NotificationContext';
import { logger } from '../utils/logger';
import { clearP2PKCache } from '../services/cashu/p2pk';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  // Get toast notifications
  const { showToast } = useNotifications();

  // Wallet state
  const [wallet, setWallet] = useState(null); // { segwitAddress, taprootAddress, taprootPubkey }
  const [currentAccount, setCurrentAccount] = useState(0);

  // Load wallet from secure storage
  const loadWallet = useCallback(async () => {
    try {
      const { addresses, accountIndex } = await WalletService.loadWalletFromStorage();

      if (addresses) {
        setWallet({
          segwitAddress: addresses.segwitAddress,
          taprootAddress: addresses.taprootAddress,
          taprootPubkey: addresses.taprootPubkey,
        });
        setCurrentAccount(accountIndex);

        return { exists: true, addresses };
      }

      return { exists: false };
    } catch (error) {
      return { exists: false };
    }
  }, []);

  // Set wallet addresses (for creating/importing wallet)
  const setWalletAddresses = useCallback((addresses, accountIndex = 0) => {
    setWallet({
      segwitAddress: addresses.segwitAddress,
      taprootAddress: addresses.taprootAddress,
      taprootPubkey: addresses.taprootPubkey,
    });
    setCurrentAccount(accountIndex);
  }, []);

  // Reset wallet (for logout/delete)
  const resetWallet = useCallback(async () => {
    setWallet(null);
    setCurrentAccount(0);

    // Clear P2PK cache on wallet reset
    try {
      await clearP2PKCache();
    } catch (error) {
      logger.warn('[WalletContext] Failed to clear P2PK cache on reset:', error.message);
    }
  }, []);

  // Switch account
  const switchAccount = useCallback(async (accountIndex) => {
    try {
      const { addresses } = await WalletService.switchToAccount(accountIndex);
      if (!addresses) {
        throw new Error('No wallet found');
      }

      // Update state immediately (this is what triggers UI update)
      setWallet({
        segwitAddress: addresses.segwitAddress,
        taprootAddress: addresses.taprootAddress,
        taprootPubkey: addresses.taprootPubkey,
      });
      setCurrentAccount(accountIndex);

      // Show toast notification immediately
      showToast(`Switched to Account ${accountIndex + 1}`, 'success');

      // Clear P2PK cache in background (fire and forget - non-critical)
      // Note: Account index is already saved in WalletService.switchToAccount
      clearP2PKCache()
        .catch(err => logger.warn('[WalletContext] Failed to clear P2PK cache:', err.message));

      return addresses;
    } catch (error) {
      throw error;
    }
  }, [showToast]);

  // Memoize the value object to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      // Wallet state
      wallet,
      currentAccount,

      // Functions
      loadWallet,
      setWalletAddresses,
      switchAccount,
      resetWallet,
    }),
    [wallet, currentAccount, loadWallet, setWalletAddresses, switchAccount, resetWallet]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
