/**
 * usePasskeyCreation Hook
 * Manages passkey-based wallet creation flow
 */

import { useState, useRef, Dispatch, SetStateAction, MutableRefObject } from 'react';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WalletService from '../services/walletService';
import { savePin } from '../services/pinService';
import type { WalletAddresses } from '../contexts/WalletContext';
import { notify } from '../utils/notify';
import { logger } from '../utils/logger';

import { isE2E } from '../utils/e2e';
import { analytics } from '../services/analyticsService';
import { ONBOARDING_EVENTS } from '../constants/analyticsEvents';

interface UsePasskeyCreationParams {
  setIsAuthenticated: (value: boolean) => void;
  setSeedConfirmed: (value: boolean) => void;
  setWalletAddresses: (addresses: WalletAddresses, accountIndex: number) => void;
  showBiometricSetupPrompt: () => void;
  showPasskeyMigrationPrompt?: (pin: string) => void;
}

interface UsePasskeyCreationReturn {
  creatingWithPasskey: boolean;
  passkeyMnemonic: string | null;
  passkeyAddresses: WalletAddresses | null;
  isCreating: boolean;
  showPinInput: boolean;
  passkeyPin: string;
  confirmingPin: boolean;
  passkeyPinConfirm: string;
  walletExistsRef: MutableRefObject<boolean>;
  setPasskeyPin: Dispatch<SetStateAction<string>>;
  setPasskeyPinConfirm: Dispatch<SetStateAction<string>>;
  setShowPinInput: Dispatch<SetStateAction<boolean>>;
  startPasskeyCreation: () => Promise<void>;
  handlePinEntry: (pin: string) => Promise<void>;
  resetPasskeyCreation: () => void;
}

export function usePasskeyCreation({
  setIsAuthenticated,
  setSeedConfirmed,
  setWalletAddresses,
  showBiometricSetupPrompt,
  showPasskeyMigrationPrompt,
}: UsePasskeyCreationParams): UsePasskeyCreationReturn {
  const [creatingWithPasskey, setCreatingWithPasskey] = useState(false);
  const [passkeyMnemonic, setPasskeyMnemonic] = useState<string | null>(null);
  const [passkeyAddresses, setPasskeyAddresses] = useState<WalletAddresses | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [passkeyPin, setPasskeyPin] = useState('');
  const [confirmingPin, setConfirmingPin] = useState(false);
  const [passkeyPinConfirm, setPasskeyPinConfirm] = useState('');
  const walletExistsRef = useRef(false);

  /**
   * Start wallet creation (prompts for PIN first)
   */
  const startPasskeyCreation = async (): Promise<void> => {
    try {
      analytics.track(ONBOARDING_EVENTS.WALLET_CREATION_STARTED);
      // Show PIN input
      setShowPinInput(true);
      setCreatingWithPasskey(true);
    } catch (error: unknown) {
      notify.passkey.creationFailed();
    }
  };

  /**
   * Handle PIN entry - either moves to confirm or creates wallet
   */
  const handlePinEntry = async (pin: string): Promise<void> => {
    try {
      // Validate PIN
      if (!pin || pin.length !== 6) {
        notify.pin.invalid();
        return;
      }

      // If confirming, check if PINs match
      if (confirmingPin) {
        if (pin !== passkeyPin) {
          notify.pin.mismatch();
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
        }).catch(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsCreating(false);
          notify.passkey.walletCreationFailed();
          // Return to Welcome screen so user can retry or choose a different path
          setShowPinInput(false);
          setCreatingWithPasskey(false);
          setConfirmingPin(false);
          setPasskeyPin('');
          setPasskeyPinConfirm('');
        });
      } else {
        // First PIN entry - move to confirmation
        setConfirmingPin(true);
      }
    } catch (error: unknown) {
      notify.passkey.pinProcessFailed();
    }
  };

  /**
   * Create wallet with PIN only, then prompt for biometric + passkey opt-in
   */
  const createWalletWithPasskey = async (pin: string): Promise<void> => {
    try {
      // Note: setIsCreating(true) is called in handlePinEntry for instant feedback

      // Step 1: Create a plain wallet (no passkey yet)
      const { mnemonic, addresses } = await WalletService.generateWallet(0);
      await WalletService.saveWalletToStorage(mnemonic, 0);
      await savePin(pin);

      walletExistsRef.current = true;
      setWalletAddresses(addresses, 0);

      // Step 2: Check biometric support
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const biometricSupported = hasHardware && isEnrolled;
      logger.auth('Wallet created, checking biometric support', { hasHardware, isEnrolled, biometricSupported });

      // Step 3: Navigate to wallet home
      completePasskeySetup();
      analytics.track(ONBOARDING_EVENTS.WALLET_CREATED);
      notify.success('Wallet created successfully');

      // Step 4: Offer passkey backup first (most important for wallet recovery)
      // Biometric setup will be offered after passkey decision, or in Settings
      if (showPasskeyMigrationPrompt && !isE2E) {
        analytics.track(ONBOARDING_EVENTS.PASSKEY_SETUP_OFFERED);
        showPasskeyMigrationPrompt(pin);
      } else if (biometricSupported) {
        // No passkey prompt available — show biometric instead
        showBiometricSetupPrompt();
      }
    } catch (error: unknown) {
      // Re-throw error to be caught by handlePinEntry
      // This keeps error handling in one place and ensures proper state cleanup
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Complete passkey setup - navigate to wallet home screen
   */
  const completePasskeySetup = (): void => {
    // Set auth states to navigate to wallet
    setIsAuthenticated(true);
    setSeedConfirmed(true);

    // Reset UI states to hide PIN input and show wallet screen
    setShowPinInput(false);
    setPasskeyPin('');
    setPasskeyPinConfirm('');
    setConfirmingPin(false);
    setCreatingWithPasskey(false);
  };

  /**
   * Reset passkey creation state
   */
  const resetPasskeyCreation = (): void => {
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
