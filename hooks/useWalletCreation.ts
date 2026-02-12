/**
 * useWalletCreation Hook
 * Manages wallet creation state for the import flow
 * - Saves wallet after PIN setup completes (for imported wallets)
 * - Persists creation state across app backgrounding
 */

import { useRef, MutableRefObject } from 'react';
import * as WalletService from '../services/walletService';
import { useWallet } from '../contexts/WalletContext';
import { usePersistedObject } from './usePersistedState';

const CREATION_STATE_KEY = 'wallet_creation_state';

interface UseWalletCreationParams {
  currentAccount: number;
  setIsAuthenticated: (value: boolean) => void;
  setSeedConfirmed: (value: boolean) => void;
  loadWallet: (() => Promise<unknown>) | undefined;
}

interface UseWalletCreationReturn {
  walletExistsRef: MutableRefObject<boolean>;
  saveWalletAfterPinSetup: () => Promise<boolean>;
  resetCreationState: () => Promise<void>;
}

interface CreationState extends Record<string, unknown> {
  tempMnemonic: string;
}

export function useWalletCreation({
  currentAccount,
  loadWallet,
}: UseWalletCreationParams): UseWalletCreationReturn {
  const { resetWallet } = useWallet();
  const walletExistsRef = useRef(false);

  // Persisted creation state - automatically loads/saves
  const [creationState, updateCreationState, clearPersistedState] = usePersistedObject<CreationState>(
    CREATION_STATE_KEY,
    {
      tempMnemonic: '',
    },
    { silent: true }
  );

  const { tempMnemonic } = creationState;
  const setTempMnemonic = (value: string) => updateCreationState({ tempMnemonic: value });

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

      // Clear persisted creation state (onboarding complete!)
      await clearPersistedState();

      return true;
    } catch (_error: unknown) {
      return false;
    }
  };

  /**
   * Reset creation state
   */
  const resetCreationState = async () => {
    setTempMnemonic('');
    walletExistsRef.current = false;

    resetWallet();

    await clearPersistedState();
  };

  return {
    walletExistsRef,
    saveWalletAfterPinSetup,
    resetCreationState,
  };
}
