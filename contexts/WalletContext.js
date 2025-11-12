import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WalletService from '../services/walletService';
import { SECURE_KEYS } from '../utils/constants';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
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
  const resetWallet = useCallback(() => {
    setWallet(null);
    setCurrentAccount(0);
  }, []);

  // Switch account
  const switchAccount = useCallback(async (accountIndex) => {
    try {
      const { addresses } = await WalletService.switchToAccount(accountIndex);
      if (!addresses) {
        throw new Error('No wallet found');
      }

      setWallet({
        segwitAddress: addresses.segwitAddress,
        taprootAddress: addresses.taprootAddress,
        taprootPubkey: addresses.taprootPubkey,
      });
      setCurrentAccount(accountIndex);

      // Save new account index
      await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, accountIndex.toString());

      return addresses;
    } catch (error) {
      throw error;
    }
  }, []);

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
