/**
 * Vault Store (Zustand)
 * Manages vault access, credentials, and navigation between wallet/vault tabs
 *
 * MIGRATION: Replaces VaultContext
 * Benefits: No provider needed, selective re-renders, simpler state management
 */

import { create } from 'zustand';
import { deriveAddressesFromMnemonic } from '../utils/bitcoin';
import { withMnemonic } from '../services/secureStorageService';
import { logger } from '../utils/logger';

export interface VaultCredentials {
  satsAddress: string;
  satsPubkey: string;
  runesAddress: string;
  runesPubkey: string;
  vaultAddress: string;
  vaultPubkey: string;
}

export type ActiveTab = 'wallet' | 'vault';

interface VaultState {
  vaultCredentials: VaultCredentials | null;
  autoCreateVaultTrigger: number;
  activeTab: ActiveTab;
  hasRetried: boolean;
  currentAccount: number;
}

interface VaultActions {
  setActiveTab: (tab: ActiveTab) => void;
  openVault: (shouldAutoCreate?: boolean) => void;
  clearVaultCredentials: () => void;
  loadCredentials: (accountIndex: number) => Promise<void>;
  retryLoadCredentials: () => Promise<void>;
}

type VaultStore = VaultState & VaultActions;

const initialState: VaultState = {
  vaultCredentials: null,
  autoCreateVaultTrigger: 0,
  activeTab: 'wallet',
  hasRetried: false,
  currentAccount: 0,
};

export const useVaultStore = create<VaultStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Actions
  setActiveTab: (tab) => {
    set({ activeTab: tab });

    // If switching to vault and credentials are missing, trigger a retry
    const state = get();
    if (tab === 'vault' && !state.vaultCredentials && !state.hasRetried) {
      logger.debug('🔄 Vault tab opened but credentials missing - retrying load');
      set({ hasRetried: true });

      setTimeout(() => {
        get().retryLoadCredentials();
      }, 500);
    }
  },

  openVault: (shouldAutoCreate = false) => {
    const state = get();

    // Switch to vault tab immediately for better UX
    set({ activeTab: 'vault' });

    // Trigger auto-create if requested by incrementing counter
    // Only increment if credentials are loaded successfully
    if (shouldAutoCreate && state.vaultCredentials) {
      set({ autoCreateVaultTrigger: state.autoCreateVaultTrigger + 1 });
    }
  },

  clearVaultCredentials: () => {
    logger.debug('🏦 Clearing vault credentials');
    set({
      vaultCredentials: null,
      activeTab: 'wallet',
      hasRetried: false,
    });
  },

  loadCredentials: async (accountIndex: number) => {
    try {
      logger.debug('🏦 Loading vault credentials in background for account:', accountIndex);

      // Reset retry flag when account changes
      set({ hasRetried: false, currentAccount: accountIndex });

      await withMnemonic(async (mnemonic) => {
        const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex);

        set({
          vaultCredentials: {
            satsAddress: addresses.segwitAddress,
            satsPubkey: addresses.segwitPubkey,
            runesAddress: addresses.taprootAddress,
            runesPubkey: addresses.taprootPubkey,
            vaultAddress: addresses.taprootAddress,
            vaultPubkey: addresses.taprootPubkey,
          },
        });
      });
    } catch (error: unknown) {
      // Silently handle - no mnemonic is expected for new users
      if (error instanceof Error && error.message !== 'Mnemonic not found') {
        logger.error('❌ Error loading vault credentials:', { error: error.message });
      }
    }
  },

  retryLoadCredentials: async () => {
    const state = get();
    try {
      await withMnemonic(async (mnemonic) => {
        const addresses = deriveAddressesFromMnemonic(mnemonic, state.currentAccount);

        set({
          vaultCredentials: {
            satsAddress: addresses.segwitAddress,
            satsPubkey: addresses.segwitPubkey,
            runesAddress: addresses.taprootAddress,
            runesPubkey: addresses.taprootPubkey,
            vaultAddress: addresses.taprootAddress,
            vaultPubkey: addresses.taprootPubkey,
          },
        });
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message !== 'Mnemonic not found') {
        logger.error('❌ Error retrying vault credentials:', { error: error.message });
      }
    }
  },
}));

/**
 * Selector hooks for granular subscriptions
 * Use these to only re-render when specific values change
 */
export const useActiveTab = () => useVaultStore((state) => state.activeTab);
export const useVaultCredentials = () => useVaultStore((state) => state.vaultCredentials);
export const useAutoCreateVaultTrigger = () => useVaultStore((state) => state.autoCreateVaultTrigger);

/**
 * Reset store to initial state (useful for testing)
 */
export const resetVaultStore = () => {
  useVaultStore.setState(initialState);
};
