import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import * as WalletService from '../services/walletService';
import { useNotifications } from '../stores/notificationStore';
import { logger } from '../utils/logger';
import { clearP2PKCache } from '../services/cashu/p2pk';

export interface WalletAddresses {
  segwitAddress: string;
  taprootAddress: string;
  taprootPubkey: string;
  [key: string]: unknown;
}

interface WalletContextValue {
  wallet: WalletAddresses | null;
  currentAccount: number;
  loadWallet: () => Promise<{ exists: boolean; addresses?: WalletAddresses }>;
  setWalletAddresses: (addresses: WalletAddresses, accountIndex?: number) => void;
  switchAccount: (accountIndex: number) => Promise<WalletAddresses>;
  resetWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export const useWallet = (): WalletContextValue => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  // Get toast notifications
  const { showToast } = useNotifications();

  // Wallet state
  const [wallet, setWallet] = useState<WalletAddresses | null>(null);
  const [currentAccount, setCurrentAccount] = useState(0);

  // Load wallet from secure storage
  const loadWallet = useCallback(async (): Promise<{ exists: boolean; addresses?: WalletAddresses }> => {
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
    } catch (error: unknown) {
      return { exists: false };
    }
  }, []);

  // Set wallet addresses (for creating/importing wallet)
  const setWalletAddresses = useCallback((addresses: WalletAddresses, accountIndex = 0) => {
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.warn('[WalletContext] Failed to clear P2PK cache on reset:', { error: error.message });
      }
    }
  }, []);

  // Switch account
  const switchAccount = useCallback(async (accountIndex: number): Promise<WalletAddresses> => {
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

    // Note: Toast notification moved to useAccountSwitcher (shown after data loads)

    // Clear P2PK cache in background (fire and forget - non-critical)
    // Note: Account index is already saved in WalletService.switchToAccount
    clearP2PKCache()
      .catch(err => {
        if (err instanceof Error) {
          logger.warn('[WalletContext] Failed to clear P2PK cache:', { error: err.message });
        }
      });

    return addresses;
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
