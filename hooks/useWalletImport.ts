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
import { logger } from '../utils/logger';
import { notify } from '../utils/notify';
import { analytics } from '../services/analyticsService';
import { ONBOARDING_EVENTS } from '../constants/analyticsEvents';

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
  persistImportedWallet: () => Promise<void>;
  resetImportState: () => Promise<void>;
}

export function useWalletImport({ currentAccount, setSettingUpPin }: UseWalletImportParams): UseWalletImportReturn {
  const [importingWallet, setImportingWallet] = useState(false);
  const [importSeedPhrase, setImportSeedPhrase] = useState<string[]>(Array(12).fill(''));
  const [isImportedWallet, setIsImportedWallet] = useState(false);

  // Non-persisted state
  const [isImporting, setIsImporting] = useState(false); // Loading state
  const seedInputRefs = useRef<TextInput[]>([]);

  // CRITICAL: Use ref for mnemonic so it survives renders but doesn't persist to storage
  // This allows it to survive navigation to PIN screen without storing sensitive data.
  // SECURITY: Only expose a boolean flag via React state to avoid holding the mnemonic
  // in the component tree / React DevTools. The actual value lives only in the ref.
  const importedMnemonicRef = useRef<string | null>(null);
  const [hasImportedMnemonic, setHasImportedMnemonic] = useState(false);

  const setImportedMnemonic = (value: string | null) => {
    importedMnemonicRef.current = value;
    setHasImportedMnemonic(!!value);
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
      const e2eSeed = __DEV__ ? process.env.EXPO_PUBLIC_E2E_TEST_SEED : undefined;
      const seedWords = isE2E && e2eSeed && importSeedPhrase.every((word: string) => !word.trim())
        ? e2eSeed.split(' ')
        : importSeedPhrase;

      // Join the array of words and trim/normalize
      const mnemonic = seedWords
        .map((word: string) => word.trim().toLowerCase())
        .join(' ')
        .trim();

      // Import wallet using WalletService (validates and derives addresses)
      // This is CPU-intensive (BIP32 key derivation) - may take 1-2 seconds
      await WalletService.importWallet(mnemonic, currentAccount);

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

      // Set imported wallet flag AFTER clearing form data
      // This flag persists so OnboardingPage knows to handle post-PIN-setup properly
      setIsImportedWallet(true);
      analytics.track(ONBOARDING_EVENTS.WALLET_IMPORTED);

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

  const persistImportedWallet = async (): Promise<void> => {
    const mnemonic = importedMnemonicRef.current;
    if (!mnemonic) {
      throw new Error('Imported mnemonic not available');
    }
    await WalletService.saveWalletToStorage(mnemonic, currentAccount);
  };

  /**
   * Reset import state
   */
  const resetImportState = async () => {
    setImportingWallet(false);
    setImportSeedPhrase(Array(12).fill(''));
    setIsImportedWallet(false);
    setImportedMnemonic(null);
  };

  return {
    // State
    importingWallet,
    importSeedPhrase,
    isImportedWallet,
    isImporting, // Loading state
    seedInputRefs,
    importedMnemonic: importedMnemonicRef.current,

    // Setters
    setImportingWallet,
    setImportSeedPhrase,
    setIsImportedWallet,
    setImportedMnemonic,

    // Functions
    importWallet,
    persistImportedWallet,
    resetImportState,
  };
}
