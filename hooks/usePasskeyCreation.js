/**
 * usePasskeyCreation Hook
 * Manages passkey-based wallet creation flow
 */

import { useState, useRef } from 'react';
import * as Device from 'expo-device';
import * as PasskeyService from '../services/passkeyService';

export function usePasskeyCreation({ setIsAuthenticated, setSeedConfirmed, showToast, loadWallet }) {
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

        // PINs match - create wallet
        await createWalletWithPasskey(pin);
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
      setIsCreating(true);

      // Get device name for passkey display
      const deviceName = Device.deviceName || 'iPhone';
      const displayName = `${deviceName} - Ducat`;

      // Create wallet with passkey + PIN
      const { mnemonic, addresses } = await PasskeyService.createWalletWithPasskey({
        userName: `ducat-${Date.now()}`,
        userDisplayName: displayName,
        pin,
      });

      // Wallet is now created and saved
      walletExistsRef.current = true;

      // CRITICAL: Load wallet FIRST so it's in context
      // This must complete before we set auth states or reset UI states
      await loadWallet();

      // Now set auth states (wallet is loaded, so navigation will work correctly)
      setIsAuthenticated(true);
      setSeedConfirmed(true);

      // Reset UI states in the same batch as auth states
      // Since wallet is loaded and auth is set, OnboardingPage will return null
      // and RootNavigator will switch to Main stack
      setShowPinInput(false);
      setPasskeyPin('');
      setPasskeyPinConfirm('');
      setConfirmingPin(false);
      setCreatingWithPasskey(false);

      showToast('Wallet created with passkey!', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to create wallet with passkey', 'error');
      setCreatingWithPasskey(false);
      setIsCreating(false);
      setConfirmingPin(false);
      setPasskeyPin('');
      setPasskeyPinConfirm('');
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
