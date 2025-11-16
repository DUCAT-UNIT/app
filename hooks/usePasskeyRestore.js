/**
 * usePasskeyRestore Hook
 * Manages passkey-based wallet restoration flow
 */

import { useState } from 'react';
import * as PasskeyService from '../services/passkeyService';

export function usePasskeyRestore({ setIsAuthenticated, setSeedConfirmed, showToast, loadWallet }) {
  const [restoringWithPasskey, setRestoringWithPasskey] = useState(false);
  const [showRestorePinInput, setShowRestorePinInput] = useState(false);
  const [restorePin, setRestorePin] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  /**
   * Start passkey wallet restoration (prompts for PIN + passkey auth)
   */
  const startPasskeyRestore = async () => {
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
      showToast(error.message || 'Failed to start passkey restore', 'error');
    }
  };

  /**
   * Restore wallet using passkey + PIN
   */
  const restoreWalletWithPasskey = async (pin) => {
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
      const { saveMnemonic, saveCurrentAccount } = await import('../services/authService');

      await saveMnemonic(mnemonic);
      await saveCurrentAccount(0);
      await savePin(pin);

      // Hide PIN input
      setShowRestorePinInput(false);
      setRestorePin('');
      setRestoringWithPasskey(false);

      // Reload wallet
      await loadWallet();

      // Mark as authenticated and seed confirmed
      setIsAuthenticated(true);
      setSeedConfirmed(true);

      showToast('Wallet restored from passkey!', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to restore wallet with passkey', 'error');
      setIsRestoring(false);
    } finally {
      setIsRestoring(false);
    }
  };

  /**
   * Reset passkey restore state
   */
  const resetPasskeyRestore = () => {
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
