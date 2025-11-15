/**
 * usePasskeyCreation Hook
 * Manages passkey-based wallet creation flow
 */

import { useState, useRef } from 'react';
import * as PasskeyService from '../services/passkeyService';

export function usePasskeyCreation({ setIsAuthenticated, setSeedConfirmed, showToast, loadWallet }) {
  const [creatingWithPasskey, setCreatingWithPasskey] = useState(false);
  const [passkeyMnemonic, setPasskeyMnemonic] = useState(null);
  const [passkeyAddresses, setPasskeyAddresses] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const walletExistsRef = useRef(false);

  /**
   * Create wallet using passkey
   */
  const createWalletWithPasskey = async () => {
    try {
      setIsCreating(true);
      setCreatingWithPasskey(true);

      // Check if passkeys are supported
      const supported = await PasskeyService.isPasskeySupported();
      if (!supported) {
        showToast('Passkeys are not supported on this device', 'error');
        setCreatingWithPasskey(false);
        setIsCreating(false);
        return;
      }

      // Create wallet with passkey
      const { mnemonic, addresses } = await PasskeyService.createWalletWithPasskey({
        userName: `ducat-${Date.now()}`,
        userDisplayName: 'Ducat User',
      });

      // Store mnemonic and addresses to show to user
      setPasskeyMnemonic(mnemonic);
      setPasskeyAddresses(addresses);

      // Wallet is now created and saved
      walletExistsRef.current = true;

      // Reload wallet
      await loadWallet();

      // Mark as authenticated and seed confirmed
      setIsAuthenticated(true);
      setSeedConfirmed(true);

      showToast('Wallet created with passkey!', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to create wallet with passkey', 'error');
      setCreatingWithPasskey(false);
      setIsCreating(false);
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
  };

  return {
    // State
    creatingWithPasskey,
    passkeyMnemonic,
    passkeyAddresses,
    isCreating,
    walletExistsRef,

    // Functions
    createWalletWithPasskey,
    resetPasskeyCreation,
  };
}
