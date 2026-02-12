/**
 * useWalletImport Hook
 * Manages wallet import from existing seed phrase
 * - Validates and imports seed phrase
 * - Persists import state across app backgrounding
 * - Handles seed input refs for focus management
 */

import { useState, useRef, MutableRefObject } from 'react';
import { TextInput } from 'react-native';
import * as WalletService from '../services/walletService';
import { ERRORS } from '../utils/messages';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';
import { usePersistedObject } from './usePersistedState';
import { logger } from '../utils/logger';
import { notify } from '../utils/notify';

const IMPORT_STATE_KEY = 'wallet_import_state';

interface UseWalletImportParams {
  currentAccount: number;
  setSettingUpPin: (value: boolean) => void;
}

interface UseWalletImportReturn {
  importingWallet: boolean;
  importSeedPhrase: string[];
  isImportedWallet: boolean;
  isImporting: boolean;
  seedInputRefs: MutableRefObject<TextInput[]>;
  importedMnemonic: string | null;
  setImportingWallet: (value: boolean) => void;
  setImportSeedPhrase: (value: string[]) => void;
  setIsImportedWallet: (value: boolean) => void;
  setImportedMnemonic: (value: string | null) => void;
  importWallet: () => Promise<void>;
  resetImportState: () => Promise<void>;
}

interface ImportState extends Record<string, unknown> {
  importingWallet: boolean;
  importSeedPhrase: string[];
  isImportedWallet: boolean;
}

export function useWalletImport({ currentAccount, setSettingUpPin }: UseWalletImportParams): UseWalletImportReturn {

  // Persisted import state - automatically loads/saves
  const [importState, updateImportState, clearPersistedState] = usePersistedObject<ImportState>(
    IMPORT_STATE_KEY,
    {
      importingWallet: false,
      importSeedPhrase: Array(12).fill(''),
      isImportedWallet: false,
    },
    { silent: true } // Silently fail on errors
  );

  // Extract state for backwards compatibility
  const { importingWallet, importSeedPhrase, isImportedWallet } = importState;

  // Helper setters for individual fields (backwards compatibility)
  const setImportingWallet = (value: boolean) => updateImportState({ importingWallet: value });
  const setImportSeedPhrase = (value: string[]) => updateImportState({ importSeedPhrase: value });
  const setIsImportedWallet = (value: boolean) => updateImportState({ isImportedWallet: value });

  // Non-persisted state
  const [isImporting, setIsImporting] = useState(false); // Loading state
  const seedInputRefs = useRef<TextInput[]>([]);

  // CRITICAL: Use ref for mnemonic so it survives renders but doesn't persist to storage
  // This allows it to survive navigation to PIN screen without storing sensitive data
  const importedMnemonicRef = useRef<string | null>(null);
  const [importedMnemonic, setImportedMnemonicState] = useState<string | null>(null);

  const setImportedMnemonic = (value: string | null) => {
    importedMnemonicRef.current = value;
    setImportedMnemonicState(value);
  };

  /**
   * Import existing wallet from seed phrase
   */
  const importWallet = async () => {
    // Prevent double-clicking
    if (isImporting) return;

    // CRITICAL: Set loading state immediately (synchronously) before any async work
    setIsImporting(true);

    // Force a tiny delay to ensure UI updates before heavy computation
    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      // E2E bypass: use test seed phrase in dev builds with explicit env var
      const isE2E = __DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true';
      const e2eSeed = 'nation address battle bonus dignity wave bulb crouch enter night leader north';
      const seedWords = isE2E && importSeedPhrase.every(w => !w.trim())
        ? e2eSeed.split(' ')
        : importSeedPhrase;

      // Join the array of words and trim/normalize
      const mnemonic = seedWords
        .map((word) => word.trim().toLowerCase())
        .join(' ')
        .trim();

      // Import wallet using WalletService (validates and derives addresses)
      // This is CPU-intensive (BIP32 key derivation) - may take 1-2 seconds
      await WalletService.importWallet(mnemonic, currentAccount);

      // Store wallet in secure storage
      await WalletService.saveWalletToStorage(mnemonic, currentAccount);

      // CRITICAL: Save the current account index so loadWallet() loads the correct account
      await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, currentAccount.toString());

      // CRITICAL: Don't load the wallet yet - wait until after PIN setup and passkey migration
      // The wallet will be loaded in OnboardingPage after the passkey migration modal closes
      // if (loadWallet) {
      //   await loadWallet();
      // }

      // Set PIN setup state to prevent lock screen flash
      setSettingUpPin(true);

      // Don't set wallet addresses here - we'll load the wallet properly after PIN setup
      // This avoids double-setting the wallet context which could interfere with balance fetching
      // The wallet will be loaded via loadWallet() in OnboardingPage after PIN is set

      // Store mnemonic for potential passkey migration
      setImportedMnemonic(mnemonic);

      // Clear import form but KEEP isImportedWallet flag
      // The flag is needed by OnboardingPage to know this is an imported wallet
      setImportingWallet(false);
      setImportSeedPhrase(Array(12).fill(''));

      // Clear persisted state since import is complete
      await clearPersistedState();

      // Set imported wallet flag AFTER clearing form data
      // This flag persists so OnboardingPage knows to handle post-PIN-setup properly
      setIsImportedWallet(true);

      // Don't show passkey migration prompt yet - wait until PIN is set
      // The parent component (OnboardingPage) will show it after PIN setup
    } catch (error: unknown) {
      logger.error('Wallet import failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      });
      notify.error(ERRORS.WALLET_IMPORT_FAILED);
      // Don't clear the form on error - let user fix their seed phrase
      // They can retry by tapping Import again
    } finally {
      setIsImporting(false); // Hide loading indicator
    }
  };

  /**
   * Reset import state
   */
  const resetImportState = async () => {
    setImportingWallet(false);
    setImportSeedPhrase(Array(12).fill(''));
    setIsImportedWallet(false);
    setImportedMnemonic(null);
    await clearPersistedState();
  };

  return {
    // State
    importingWallet,
    importSeedPhrase,
    isImportedWallet,
    isImporting, // Loading state
    seedInputRefs,
    importedMnemonic,

    // Setters
    setImportingWallet,
    setImportSeedPhrase,
    setIsImportedWallet,
    setImportedMnemonic,

    // Functions
    importWallet,
    resetImportState,
  };
}
