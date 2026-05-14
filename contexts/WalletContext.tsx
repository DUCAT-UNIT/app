import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { InteractionManager } from 'react-native';
import * as WalletService from '../services/walletService';
import { saveCachedAddresses, saveToMultiAccountCache } from '../services/secureStorageService';
import { getWalletDerivationMode } from '../services/walletDerivationService';
import {
  DEFAULT_WALLET_DERIVATION_MODE,
  getWalletProfileForDerivationMode,
  type WalletDerivationMode,
  type WalletImportProfile,
} from '../constants/bitcoin';
import { logger } from '../utils/logger';
import { clearP2PKCache } from '../services/cashu/cashuWalletService';
import { resetE2eVaultState } from '../utils/e2eVaultState';
import { analytics } from '../services/analyticsService';

export interface WalletAddresses {
  legacyAddress?: string;
  segwitAddress: string;
  taprootAddress: string;
  legacyPubkey?: string;
  segwitPubkey: string;
  taprootPubkey: string;
}

export type WalletAccountSwitchOptions = WalletService.SwitchAccountOptions;

interface WalletContextValue {
  wallet: WalletAddresses | null;
  currentAccount: number;
  walletDerivationMode: WalletDerivationMode;
  walletProfile: WalletImportProfile;
  loadWallet: () => Promise<{
    exists: boolean;
    addresses?: WalletAddresses;
    walletProfile?: WalletImportProfile;
    walletDerivationMode?: WalletDerivationMode;
  }>;
  setWalletAddresses: (addresses: WalletAddresses, accountIndex?: number) => void;
  switchAccount: (
    accountIndex: number,
    options?: WalletAccountSwitchOptions
  ) => Promise<WalletAddresses>;
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
  // Wallet state
  const [wallet, setWallet] = useState<WalletAddresses | null>(null);
  const [currentAccount, setCurrentAccount] = useState(0);
  const [walletDerivationMode, setWalletDerivationModeState] = useState<WalletDerivationMode>(
    DEFAULT_WALLET_DERIVATION_MODE
  );
  const [walletProfile, setWalletProfileState] = useState<WalletImportProfile>(
    getWalletProfileForDerivationMode(DEFAULT_WALLET_DERIVATION_MODE)
  );

  const scheduleAnalyticsIdentify = useCallback((address: string) => {
    const task = InteractionManager.runAfterInteractions(() => {
      analytics.hashAddress(address).then((hashed) => {
        analytics.identifyHashed(hashed);
      });
    });

    return () => task.cancel();
  }, []);

  // Load wallet from secure storage
  const loadWallet = useCallback(async (): Promise<{
    exists: boolean;
    addresses?: WalletAddresses;
    walletProfile?: WalletImportProfile;
    walletDerivationMode?: WalletDerivationMode;
  }> => {
    try {
      const {
        addresses,
        accountIndex,
        derivationMode: loadedDerivationMode,
        walletProfile: loadedWalletProfile,
      } = await WalletService.loadWalletFromStorage();
      const derivationMode = loadedDerivationMode ?? DEFAULT_WALLET_DERIVATION_MODE;
      const walletProfile =
        loadedWalletProfile ?? getWalletProfileForDerivationMode(derivationMode);
      setWalletDerivationModeState(derivationMode);
      setWalletProfileState(walletProfile);

      if (addresses) {
        setWallet({
          legacyAddress: addresses.legacyAddress,
          segwitAddress: addresses.segwitAddress,
          taprootAddress: addresses.taprootAddress,
          legacyPubkey: addresses.legacyPubkey,
          segwitPubkey: addresses.segwitPubkey,
          taprootPubkey: addresses.taprootPubkey,
        });
        setCurrentAccount(accountIndex);
        scheduleAnalyticsIdentify(addresses.segwitAddress);

        return {
          exists: true,
          addresses,
          walletDerivationMode: derivationMode,
          walletProfile,
        };
      }

      return { exists: false };
    } catch (error: unknown) {
      logger.error('[WalletContext] Failed to load wallet into context', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [scheduleAnalyticsIdentify]);

  // Set wallet addresses (for creating/importing wallet)
  const setWalletAddresses = useCallback(
    (addresses: WalletAddresses, accountIndex = 0) => {
      setWallet({
        legacyAddress: addresses.legacyAddress,
        segwitAddress: addresses.segwitAddress,
        taprootAddress: addresses.taprootAddress,
        legacyPubkey: addresses.legacyPubkey,
        segwitPubkey: addresses.segwitPubkey,
        taprootPubkey: addresses.taprootPubkey,
      });
      setCurrentAccount(accountIndex);

      // Identify user with hashed address for analytics
      scheduleAnalyticsIdentify(addresses.segwitAddress);

      getWalletDerivationMode()
        .then((derivationMode) => {
          setWalletDerivationModeState(derivationMode);
          setWalletProfileState(getWalletProfileForDerivationMode(derivationMode));

          return Promise.all([
            saveCachedAddresses(accountIndex, addresses, derivationMode),
            saveToMultiAccountCache(accountIndex, addresses, derivationMode),
          ]);
        })
        .catch((error: unknown) => {
          logger.warn('[WalletContext] Failed to cache wallet addresses', {
            accountIndex,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    },
    [scheduleAnalyticsIdentify]
  );

  // Reset wallet (for logout/delete)
  const resetWallet = useCallback(async () => {
    analytics.reset();
    setWallet(null);
    setCurrentAccount(0);
    setWalletDerivationModeState(DEFAULT_WALLET_DERIVATION_MODE);
    setWalletProfileState(getWalletProfileForDerivationMode(DEFAULT_WALLET_DERIVATION_MODE));
    resetE2eVaultState();

    // Clear P2PK cache on wallet reset
    try {
      await clearP2PKCache();
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.warn('[WalletContext] Failed to clear P2PK cache on reset:', {
          error: error.message,
        });
      }
    }
  }, []);

  // Switch account
  const switchAccount = useCallback(
    async (
      accountIndex: number,
      options?: WalletAccountSwitchOptions
    ): Promise<WalletAddresses> => {
      const {
        addresses,
        derivationMode: nextDerivationMode,
        walletProfile: returnedWalletProfile,
      } = await WalletService.switchToAccount(accountIndex, options);
      if (!addresses) {
        throw new Error('No wallet found');
      }
      const derivationMode = nextDerivationMode ?? DEFAULT_WALLET_DERIVATION_MODE;
      const nextWalletProfile =
        returnedWalletProfile ?? getWalletProfileForDerivationMode(derivationMode);

      // Update state immediately (this is what triggers UI update)
      setWallet({
        legacyAddress: addresses.legacyAddress,
        segwitAddress: addresses.segwitAddress,
        taprootAddress: addresses.taprootAddress,
        legacyPubkey: addresses.legacyPubkey,
        segwitPubkey: addresses.segwitPubkey,
        taprootPubkey: addresses.taprootPubkey,
      });
      setCurrentAccount(accountIndex);
      setWalletDerivationModeState(derivationMode);
      setWalletProfileState(nextWalletProfile);

      // Note: Toast notification moved to useAccountSwitcher (shown after data loads)

      // Clear P2PK cache in background (fire and forget - non-critical)
      // Note: Account index is already saved in WalletService.switchToAccount
      clearP2PKCache().catch((err) => {
        if (err instanceof Error) {
          logger.warn('[WalletContext] Failed to clear P2PK cache:', { error: err.message });
        }
      });

      return addresses;
    },
    []
  );

  // Memoize the value object to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      // Wallet state
      wallet,
      currentAccount,
      walletDerivationMode,
      walletProfile,

      // Functions
      loadWallet,
      setWalletAddresses,
      switchAccount,
      resetWallet,
    }),
    [
      wallet,
      currentAccount,
      walletDerivationMode,
      walletProfile,
      loadWallet,
      setWalletAddresses,
      switchAccount,
      resetWallet,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
