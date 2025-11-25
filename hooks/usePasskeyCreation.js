/**
 * usePasskeyCreation Hook
 * Manages passkey-based wallet creation flow
 */

import { useState, useRef } from 'react';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import * as PasskeyService from '../services/passkey';

export function usePasskeyCreation({ setIsAuthenticated, setSeedConfirmed, showToast, setWalletAddresses }) {
  const [creatingWithPasskey, setCreatingWithPasskey] = useState(false);
  const [passkeyMnemonic, setPasskeyMnemonic] = useState(null);
  const [passkeyAddresses, setPasskeyAddresses] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [passkeyPin, setPasskeyPin] = useState('');
  const [confirmingPin, setConfirmingPin] = useState(false);
  const [passkeyPinConfirm, setPasskeyPinConfirm] = useState('');
  const walletExistsRef = useRef(false);

  /**
   * Start passkey wallet creation (prompts for PIN first)
   */
  const startPasskeyCreation = async () => {
    try {
      // Check if passkeys are supported
      const supported = await PasskeyService.isPasskeySupported();
      if (!supported) {
        showToast('Passkeys are not supported on this device', 'error');
        return;
      }

      // Show PIN input
      setShowPinInput(true);
      setCreatingWithPasskey(true);
    } catch (error) {
      showToast(error.message || 'Failed to start passkey creation', 'error');
    }
  };

  /**
   * Handle PIN entry - either moves to confirm or creates wallet
   */
  const handlePinEntry = async (pin) => {
    try {
      // Validate PIN
      if (!pin || pin.length !== 6) {
        showToast('Please enter a 6-digit PIN', 'error');
        return;
      }

      // If confirming, check if PINs match
      if (confirmingPin) {
        if (pin !== passkeyPin) {
          showToast('PINs do not match. Please try again.', 'error');
          setConfirmingPin(false);
          setPasskeyPin('');
          setPasskeyPinConfirm('');
          return;
        }

        // PINs match - give instant feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsCreating(true);

        // Create wallet (use microtask to let UI update while keeping promise chain)
        await Promise.resolve().then(async () => {
          await createWalletWithPasskey(pin);
        }).catch((error) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsCreating(false);
          showToast(error.message || 'Failed to create wallet with passkey', 'error');
          setCreatingWithPasskey(false);
          setConfirmingPin(false);
          setPasskeyPin('');
          setPasskeyPinConfirm('');
        });
      } else {
        // First PIN entry - move to confirmation
        setConfirmingPin(true);
      }
    } catch (error) {
      showToast(error.message || 'Failed to process PIN', 'error');
    }
  };

  /**
   * Create wallet using passkey (after PIN is confirmed)
   */
  const createWalletWithPasskey = async (pin) => {
    try {
      // Note: setIsCreating(true) is called in handlePinEntry for instant feedback

      // Get device name for passkey display
      const deviceName = Device.deviceName || 'iPhone';
      const userName = `${deviceName}-DUCAT_APP`;
      const displayName = `${deviceName} - Ducat`;

      // Create wallet with passkey + PIN
      const { addresses, icloudBackupPromise } = await PasskeyService.createWalletWithPasskey({
        userName,
        userDisplayName: displayName,
        pin,
      });

      // Wallet is now created and saved
      walletExistsRef.current = true;

      // INSTANT NAVIGATION: Set wallet addresses immediately in React context
      // This ensures useNavigationState sees wallet as existing (no onboarding screen)
      setWalletAddresses(addresses, 0);

      // Set auth states to navigate to wallet
      setIsAuthenticated(true);
      setSeedConfirmed(true);

      // Reset UI states to hide PIN input and show wallet screen
      setShowPinInput(false);
      setPasskeyPin('');
      setPasskeyPinConfirm('');
      setConfirmingPin(false);
      setCreatingWithPasskey(false);

      // Show immediate success - navigation happens instantly
      showToast('Wallet created with passkey!', 'success');

      // Handle iCloud backup result in background (non-blocking)
      if (icloudBackupPromise) {
        icloudBackupPromise.then((result) => {
          if (!result.success) {
            showToast('iCloud backup failed - restoration may not work on new devices', 'warning');
          }
        });
      }
    } catch (error) {
      // Re-throw error to be caught by handlePinEntry
      // This keeps error handling in one place and ensures proper state cleanup
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Reset passkey creation state
   */
  const resetPasskeyCreation = () => {
    setCreatingWithPasskey(false);
    setPasskeyMnemonic(null);
    setPasskeyAddresses(null);
    setIsCreating(false);
    setShowPinInput(false);
    setPasskeyPin('');
    setConfirmingPin(false);
    setPasskeyPinConfirm('');
  };

  return {
    // State
    creatingWithPasskey,
    passkeyMnemonic,
    passkeyAddresses,
    isCreating,
    showPinInput,
    passkeyPin,
    confirmingPin,
    passkeyPinConfirm,
    walletExistsRef,

    // Setters
    setPasskeyPin,
    setPasskeyPinConfirm,
    setShowPinInput,

    // Functions
    startPasskeyCreation,
    handlePinEntry,
    resetPasskeyCreation,
  };
}
