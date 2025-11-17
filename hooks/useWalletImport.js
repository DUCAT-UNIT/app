/**
 * useWalletImport Hook
 * Manages wallet import from existing seed phrase
 * - Validates and imports seed phrase
 * - Persists import state across app backgrounding
 * - Handles seed input refs for focus management
 */

import { useState, useRef } from 'react';
import * as WalletService from '../services/walletService';
import { useWallet } from '../contexts/WalletContext';
import { ERRORS } from '../utils/messages';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';
import { usePersistedObject } from './usePersistedState';

const IMPORT_STATE_KEY = 'wallet_import_state';

export function useWalletImport({ currentAccount, setSettingUpPin, showToast, loadWallet }) {
  const { setWalletAddresses } = useWallet();

  // Persisted import state - automatically loads/saves
  const [importState, updateImportState, clearPersistedState, stateLoaded] = usePersistedObject(
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
  const setImportingWallet = (value) => updateImportState({ importingWallet: value });
  const setImportSeedPhrase = (value) => updateImportState({ importSeedPhrase: value });
  const setIsImportedWallet = (value) => updateImportState({ isImportedWallet: value });

  // Non-persisted state
  const [isImporting, setIsImporting] = useState(false); // Loading state
  const [importedMnemonic, setImportedMnemonic] = useState(null); // Store mnemonic for passkey migration
  const seedInputRefs = useRef([]);

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
      // Join the array of words and trim/normalize
      const mnemonic = importSeedPhrase
        .map((word) => word.trim().toLowerCase())
        .join(' ')
        .trim();

      // Import wallet using WalletService (validates and derives addresses)
      // This is CPU-intensive (BIP32 key derivation) - may take 1-2 seconds
      const { addresses } = await WalletService.importWallet(mnemonic, currentAccount);

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
      setIsImportedWallet(true);

      // Don't set wallet addresses here - we'll load the wallet properly after PIN setup
      // This avoids double-setting the wallet context which could interfere with balance fetching
      // The wallet will be loaded via loadWallet() in OnboardingPage after PIN is set

      // Store mnemonic for potential passkey migration
      setImportedMnemonic(mnemonic);

      // Clear import form
      setImportingWallet(false);
      setImportSeedPhrase(Array(12).fill(''));

      // Clear persisted state
      await clearPersistedState();

      // Don't show passkey migration prompt yet - wait until PIN is set
      // The parent component (OnboardingPage) will show it after PIN setup
    } catch (error) {
      showToast(ERRORS.WALLET_IMPORT_FAILED, 'error');
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

    // Functions
    importWallet,
    resetImportState,
  };
}
