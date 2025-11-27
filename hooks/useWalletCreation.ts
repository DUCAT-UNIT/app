/**
 * useWalletCreation Hook
 * Manages new wallet creation flow
 * - Generates new wallet and seed phrase
 * - Shows intro and seed phrase screens
 * - Saves wallet after PIN setup completes
 * - Persists creation state across app backgrounding
 */

import { useRef, MutableRefObject } from 'react';
import * as WalletService from '../services/walletService';
import { useWallet } from '../contexts/WalletContext';
import { parseErrorMessage } from '../utils/errorParser';
import { usePersistedObject } from './usePersistedState';
import { notify } from '../utils/notify';

const CREATION_STATE_KEY = 'wallet_creation_state';

interface UseWalletCreationParams {
  currentAccount: number;
  setIsAuthenticated: (value: boolean) => void;
  setSeedConfirmed: (value: boolean) => void;
  loadWallet: (() => Promise<unknown>) | undefined;
}

interface UseWalletCreationReturn {
  tempMnemonicWords: string[];
  showingIntro: boolean;
  showingSeeds: boolean;
  walletExistsRef: MutableRefObject<boolean>;
  setShowingIntro: (value: boolean) => void;
  setShowingSeeds: (value: boolean) => void;
  createWallet: () => Promise<void>;
  saveWalletAfterPinSetup: () => Promise<boolean>;
  resetCreationState: () => Promise<void>;
}

interface CreationState extends Record<string, unknown> {
  tempMnemonicWords: string[];
  tempMnemonic: string;
  showingIntro: boolean;
  showingSeeds: boolean;
}

export function useWalletCreation({
  currentAccount,
  setIsAuthenticated,
  setSeedConfirmed,
  loadWallet,
}: UseWalletCreationParams): UseWalletCreationReturn {
  const { setWalletAddresses, resetWallet } = useWallet();
  const walletExistsRef = useRef(false);

  // Persisted creation state - automatically loads/saves
  const [creationState, updateCreationState, clearPersistedState] = usePersistedObject<CreationState>(
    CREATION_STATE_KEY,
    {
      tempMnemonicWords: [] as string[],
      tempMnemonic: '',
      showingIntro: false,
      showingSeeds: false,
    },
    { silent: true } // Silently fail on errors
  );

  // Extract state for backwards compatibility
  const { tempMnemonicWords, tempMnemonic, showingIntro, showingSeeds } = creationState;

  // Helper setters for individual fields (backwards compatibility)
  const setTempMnemonicWords = (value: string[]) => updateCreationState({ tempMnemonicWords: value });
  const setTempMnemonic = (value: string) => updateCreationState({ tempMnemonic: value });
  const setShowingIntro = (value: boolean) => updateCreationState({ showingIntro: value });
  const setShowingSeeds = (value: boolean) => updateCreationState({ showingSeeds: value });

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
    } catch (error: unknown) {
      notify.operationFailed('create wallet', parseErrorMessage(error));
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
    } catch (error: unknown) {
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
