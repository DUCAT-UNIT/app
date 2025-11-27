/**
 * usePasskeyRestore Hook
 * Manages passkey-based wallet restoration flow
 */

import { useState, Dispatch, SetStateAction } from 'react';
import * as PasskeyService from '../services/passkey';
import { savePin } from '../services/pinService';
import { saveMnemonic, saveCurrentAccount } from '../services/secureStorageService';
import type { WalletAddresses } from '../contexts/WalletContext';
import { notify } from '../utils/notify';

interface UsePasskeyRestoreParams {
  setIsAuthenticated: (value: boolean) => void;
  setSeedConfirmed: (value: boolean) => void;
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
        notify.passkey.notSupported();
        return;
      }

      // Check if iCloud backup exists (don't check local storage - that may have been cleared)
      const hasBackup = await PasskeyService.hasICloudBackup();
      if (!hasBackup) {
        notify.passkey.noWallet();
        return;
      }

      // Show PIN input
      setShowRestorePinInput(true);
    } catch (error: unknown) {
      notify.passkey.restoreFailed(error instanceof Error ? error.message : undefined);
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
        notify.pin.invalid();
        setIsRestoring(false);
        return;
      }

      // Recover with passkey + PIN (this retrieves from iCloud)
      const { mnemonic, addresses } = await PasskeyService.recoverWithPasskey(pin);

      // Store mnemonic in SecureStore for daily unlock
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

      notify.passkey.restored();
    } catch (error: unknown) {
      notify.passkey.walletRestoreFailed(error instanceof Error ? error.message : undefined);
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
