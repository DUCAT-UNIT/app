/**
 * useWalletImport Hook
 * Manages wallet import from existing seed phrase
 * - Validates and imports seed phrase
 * - Persists import state across app backgrounding
 * - Handles seed input refs for focus management
 */

import { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WalletService from '../services/walletService';
import { useWallet } from '../contexts/WalletContext';
import { ERRORS } from '../utils/messages';

const IMPORT_STATE_KEY = 'wallet_import_state';

export function useWalletImport({ currentAccount, setSettingUpPin, showToast, loadWallet }) {
  const { setWalletAddresses } = useWallet();
  const [stateLoaded, setStateLoaded] = useState(false);

  // Import state
  const [importingWallet, setImportingWallet] = useState(false);
  const [importSeedPhrase, setImportSeedPhrase] = useState(Array(12).fill(''));
  const [isImportedWallet, setIsImportedWallet] = useState(false);
  const [isImporting, setIsImporting] = useState(false); // Loading state
  const [showPasskeyMigrationPrompt, setShowPasskeyMigrationPrompt] = useState(false);
  const [importedMnemonic, setImportedMnemonic] = useState(null); // Store mnemonic for passkey migration
  const seedInputRefs = useRef([]);

  // Load persisted import state on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(IMPORT_STATE_KEY);
        if (savedState) {
          const state = JSON.parse(savedState);

          if (state.importingWallet !== undefined) setImportingWallet(state.importingWallet);
          if (state.importSeedPhrase) setImportSeedPhrase(state.importSeedPhrase);
          if (state.isImportedWallet !== undefined) setIsImportedWallet(state.isImportedWallet);
        }
      } catch (error) {
        // Silently fail - state will be empty on first run
      } finally {
        setStateLoaded(true);
      }
    };

    loadState();
  }, []);

  // Persist import state whenever it changes
  useEffect(() => {
    if (!stateLoaded) return;

    const saveState = async () => {
      try {
        const state = {
          importingWallet,
          importSeedPhrase,
          isImportedWallet,
        };
        await AsyncStorage.setItem(IMPORT_STATE_KEY, JSON.stringify(state));
      } catch (error) {
        // Silently fail
      }
    };

    saveState();
  }, [stateLoaded, importingWallet, importSeedPhrase, isImportedWallet]);

  /**
   * Clear persisted state
   */
  const clearPersistedState = async () => {
    try {
      await AsyncStorage.removeItem(IMPORT_STATE_KEY);
    } catch (error) {
      // Silently fail
    }
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

      // CRITICAL: Load the wallet into WalletContext so it's available app-wide
      if (loadWallet) {
        await loadWallet();
      }

      // Set PIN setup state to prevent lock screen flash
      setSettingUpPin(true);
      setIsImportedWallet(true);

      // Store addresses in context and fetch balances
      // Don't let balance fetch errors break the import flow
      try {
        setWalletAddresses(addresses, currentAccount);
      } catch (balanceError) {
        // Continue anyway - wallet is imported, balance will be fetched later
      }

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
    showPasskeyMigrationPrompt,
    importedMnemonic,

    // Setters
    setImportingWallet,
    setImportSeedPhrase,
    setIsImportedWallet,
    setShowPasskeyMigrationPrompt,
    setImportedMnemonic,

    // Functions
    importWallet,
    resetImportState,
  };
}
