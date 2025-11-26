/**
 * usePasskeyRestore Hook
 * Manages passkey-based wallet restoration flow
 */

import { useState, Dispatch, SetStateAction } from 'react';
import * as PasskeyService from '../services/passkey';
import type { WalletAddresses } from '../contexts/WalletContext';
import type { ToastType } from '../types/notification';

interface UsePasskeyRestoreParams {
  setIsAuthenticated: (value: boolean) => void;
  setSeedConfirmed: (value: boolean) => void;
  showToast: (message: string, type?: ToastType) => void;
  setWalletAddresses: (addresses: WalletAddresses, accountIndex: number) => void;
}

interface UsePasskeyRestoreReturn {
  restoringWithPasskey: boolean;
  showRestorePinInput: boolean;
  restorePin: string;
  isRestoring: boolean;
  setRestoringWithPasskey: Dispatch<SetStateAction<boolean>>;
  setRestorePin: Dispatch<SetStateAction<string>>;
  startPasskeyRestore: () => Promise<void>;
  restoreWalletWithPasskey: (pin: string) => Promise<void>;
  resetPasskeyRestore: () => void;
}

export function usePasskeyRestore({
  setIsAuthenticated,
  setSeedConfirmed,
  showToast,
  setWalletAddresses
}: UsePasskeyRestoreParams): UsePasskeyRestoreReturn {
  const [restoringWithPasskey, setRestoringWithPasskey] = useState(false);
  const [showRestorePinInput, setShowRestorePinInput] = useState(false);
  const [restorePin, setRestorePin] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  /**
   * Start passkey wallet restoration (prompts for PIN + passkey auth)
   */
  const startPasskeyRestore = async (): Promise<void> => {
    try {
      // Check if passkeys are supported
      const supported = await PasskeyService.isPasskeySupported();
      if (!supported) {
        showToast('Passkeys are not supported on this device', 'error');
        return;
      }

      // Check if iCloud backup exists (don't check local storage - that may have been cleared)
      const hasBackup = await PasskeyService.hasICloudBackup();
      if (!hasBackup) {
        showToast('No passkey wallet found in iCloud', 'error');
        return;
      }

      // Show PIN input
      setShowRestorePinInput(true);
    } catch (error) {
      showToast((error instanceof Error ? error.message : String(error)) || 'Failed to start passkey restore', 'error');
    }
  };

  /**
   * Restore wallet using passkey + PIN
   */
  const restoreWalletWithPasskey = async (pin: string): Promise<void> => {
    try {
      setIsRestoring(true);

      // Validate PIN
      if (!pin || pin.length !== 6) {
        showToast('Please enter a 6-digit PIN', 'error');
        setIsRestoring(false);
        return;
      }

      // Recover with passkey + PIN (this retrieves from iCloud)
      const { mnemonic, addresses } = await PasskeyService.recoverWithPasskey(pin);

      // Store mnemonic in SecureStore for daily unlock
      const { savePin } = await import('../services/pinService');
      const { saveMnemonic, saveCurrentAccount } = await import('../services/secureStorageService');

      await saveMnemonic(mnemonic);
      await saveCurrentAccount(0);
      await savePin(pin);

      // INSTANT NAVIGATION: Set wallet addresses immediately in React context
      // This ensures useNavigationState sees wallet as existing (no onboarding screen)
      setWalletAddresses(addresses, 0);

      // Set auth states to navigate to wallet
      setIsAuthenticated(true);
      setSeedConfirmed(true);

      // Hide PIN input and reset state immediately
      setShowRestorePinInput(false);
      setRestorePin('');
      setRestoringWithPasskey(false);

      showToast('Wallet restored from passkey!', 'success');
    } catch (error) {
      showToast((error instanceof Error ? error.message : String(error)) || 'Failed to restore wallet with passkey', 'error');
      setIsRestoring(false);
    } finally {
      setIsRestoring(false);
    }
  };

  /**
   * Reset passkey restore state
   */
  const resetPasskeyRestore = (): void => {
    setRestoringWithPasskey(false);
    setShowRestorePinInput(false);
    setRestorePin('');
    setIsRestoring(false);
  };

  return {
    // State
    restoringWithPasskey,
    showRestorePinInput,
    restorePin,
    isRestoring,

    // Setters
    setRestoringWithPasskey,
    setRestorePin,

    // Functions
    startPasskeyRestore,
    restoreWalletWithPasskey,
    resetPasskeyRestore,
  };
}
