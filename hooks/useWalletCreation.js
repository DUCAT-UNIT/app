/**
 * useWalletCreation Hook
 * Manages new wallet creation flow
 * - Generates new wallet and seed phrase
 * - Shows intro and seed phrase screens
 * - Saves wallet after PIN setup completes
 * - Persists creation state across app backgrounding
 */

import { useRef } from 'react';
import * as WalletService from '../services/walletService';
import { useWallet } from '../contexts/WalletContext';
import { parseErrorMessage } from '../utils/errorParser';
import { usePersistedObject } from './usePersistedState';

const CREATION_STATE_KEY = 'wallet_creation_state';

export function useWalletCreation({
  currentAccount,
  setIsAuthenticated,
  setSeedConfirmed,
  showToast,
  loadWallet,
}) {
  const { setWalletAddresses, resetWallet } = useWallet();
  const walletExistsRef = useRef(false);

  // Persisted creation state - automatically loads/saves
  const [creationState, updateCreationState, clearPersistedState, stateLoaded] = usePersistedObject(
    CREATION_STATE_KEY,
    {
      tempMnemonicWords: [],
      tempMnemonic: '',
      showingIntro: false,
      showingSeeds: false,
    },
    { silent: true } // Silently fail on errors
  );

  // Extract state for backwards compatibility
  const { tempMnemonicWords, tempMnemonic, showingIntro, showingSeeds } = creationState;

  // Helper setters for individual fields (backwards compatibility)
  const setTempMnemonicWords = (value) => updateCreationState({ tempMnemonicWords: value });
  const setTempMnemonic = (value) => updateCreationState({ tempMnemonic: value });
  const setShowingIntro = (value) => updateCreationState({ showingIntro: value });
  const setShowingSeeds = (value) => updateCreationState({ showingSeeds: value });

  /**
   * Create a new wallet
   */
  const createWallet = async () => {
    try {
      // Generate wallet using WalletService
      const { mnemonic, addresses } = await WalletService.generateWallet(currentAccount);

      // DO NOT save wallet to secure storage yet - wait until after PIN setup
      // This prevents users from closing the app and skipping verification/PIN setup

      // Set showingIntro FIRST, before setting wallet, to prevent lock screen flash
      setShowingIntro(true);
      setShowingSeeds(false);
      setSeedConfirmed(false);

      // Wallet created, user authenticated to see seed phrase
      setIsAuthenticated(true);

      // Store addresses in context and fetch balances
      setWalletAddresses(addresses, 0);
      walletExistsRef.current = false; // Not truly created until PIN is set

      // Temporarily store mnemonic for later saving after PIN setup
      setTempMnemonic(mnemonic);
      setTempMnemonicWords(mnemonic.split(' '));
    } catch (error) {
      showToast(parseErrorMessage(error), 'error');
    }
  };

  /**
   * Save wallet after PIN setup completes
   * This is called from PinSetupScreen after PIN is successfully saved
   */
  const saveWalletAfterPinSetup = async () => {
    try {
      if (!tempMnemonic) {
        return false;
      }

      // Save wallet to secure storage
      await WalletService.saveWalletToStorage(tempMnemonic, currentAccount);

      // CRITICAL: Load the wallet into WalletContext so it's available app-wide
      if (loadWallet) {
        await loadWallet();
      }

      // Mark wallet as truly existing now
      walletExistsRef.current = true;

      // Securely clear temporary mnemonic from memory
      setTempMnemonic('*'.repeat(tempMnemonic.length));
      setTimeout(() => setTempMnemonic(''), 100);
      setTempMnemonicWords(Array(12).fill('*'.repeat(8)));
      setTimeout(() => setTempMnemonicWords([]), 100);

      // Clear persisted creation state (onboarding complete!)
      await clearPersistedState();

      return true;
    } catch (error) {
      return false;
    }
  };

  /**
   * Reset creation state
   */
  const resetCreationState = async () => {
    // Securely clear temporary mnemonic from memory
    setTempMnemonic('');
    setTempMnemonicWords(Array(12).fill('*'.repeat(8)));
    setTimeout(() => setTempMnemonicWords([]), 100);

    setShowingSeeds(false);
    setShowingIntro(false);
    walletExistsRef.current = false;

    // Clear wallet from context (this was set during createWallet)
    resetWallet();

    await clearPersistedState();
  };

  return {
    // State
    tempMnemonicWords,
    showingIntro,
    showingSeeds,
    walletExistsRef,

    // Setters
    setShowingIntro,
    setShowingSeeds,

    // Functions
    createWallet,
    saveWalletAfterPinSetup,
    resetCreationState,
  };
}
