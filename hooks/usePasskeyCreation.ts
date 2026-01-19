/**
 * usePasskeyCreation Hook
 * Manages passkey-based wallet creation flow
 */

import { useState, useRef, Dispatch, SetStateAction, MutableRefObject } from 'react';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as PasskeyService from '../services/passkey';
import type { WalletAddresses } from '../contexts/WalletContext';
import { notify } from '../utils/notify';
import { SECURE_KEYS } from '../utils/constants';
import { logger } from '../utils/logger';

interface UsePasskeyCreationParams {
  setIsAuthenticated: (value: boolean) => void;
  setSeedConfirmed: (value: boolean) => void;
  setWalletAddresses: (addresses: WalletAddresses, accountIndex: number) => void;
  setBiometricEnabled: (value: boolean) => void;
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
  showBiometricPrompt: boolean;
  setPasskeyPin: Dispatch<SetStateAction<string>>;
  setPasskeyPinConfirm: Dispatch<SetStateAction<string>>;
  setShowPinInput: Dispatch<SetStateAction<boolean>>;
  startPasskeyCreation: () => Promise<void>;
  handlePinEntry: (pin: string) => Promise<void>;
  resetPasskeyCreation: () => void;
  handleBiometricEnable: () => Promise<void>;
  handleBiometricSkip: () => Promise<void>;
}

export function usePasskeyCreation({
  setIsAuthenticated,
  setSeedConfirmed,
  setWalletAddresses,
  setBiometricEnabled,
}: UsePasskeyCreationParams): UsePasskeyCreationReturn {
  const [creatingWithPasskey, setCreatingWithPasskey] = useState(false);
  const [passkeyMnemonic, setPasskeyMnemonic] = useState<string | null>(null);
  const [passkeyAddresses, setPasskeyAddresses] = useState<WalletAddresses | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [passkeyPin, setPasskeyPin] = useState('');
  const [confirmingPin, setConfirmingPin] = useState(false);
  const [passkeyPinConfirm, setPasskeyPinConfirm] = useState('');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const walletExistsRef = useRef(false);

  /**
   * Start passkey wallet creation (prompts for PIN first)
   */
  const startPasskeyCreation = async (): Promise<void> => {
    try {
      // Check if passkeys are supported
      const supported = await PasskeyService.isPasskeySupported();
      if (!supported) {
        notify.passkey.notSupported();
        return;
      }

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
   * Create wallet using passkey (after PIN is confirmed)
   */
  const createWalletWithPasskey = async (pin: string): Promise<void> => {
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

      // Check if biometrics are supported and enrolled
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const biometricSupported = hasHardware && isEnrolled;
      logger.auth('Passkey creation: checking biometric support', { hasHardware, isEnrolled, biometricSupported });

      if (biometricSupported) {
        // Show biometric prompt before completing navigation
        logger.auth('Passkey creation: showing biometric prompt');
        setShowBiometricPrompt(true);
        // Don't complete navigation yet - wait for biometric choice
      } else {
        // No biometric support, complete navigation immediately
        logger.auth('Passkey creation: no biometric support, completing setup');
        completePasskeySetup();
      }

      // Show immediate success
      notify.passkey.created();

      // Handle iCloud backup result in background (non-blocking)
      if (icloudBackupPromise) {
        icloudBackupPromise.then((result) => {
          if (!result.success) {
            notify.passkey.icloudFailed();
          }
        });
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
   * Complete passkey setup (after biometric choice or if biometrics not supported)
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
    setShowBiometricPrompt(false);
  };

  /**
   * Handle biometric enable choice
   */
  const handleBiometricEnable = async (): Promise<void> => {
    try {
      // Save the preference to SecureStore
      await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'true');
      // Update auth context state
      setBiometricEnabled(true);

      // Trigger biometric authentication to confirm
      await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
        fallbackLabel: 'Use PIN instead',
      });

      // Complete setup regardless of biometric result
      completePasskeySetup();
    } catch (error: unknown) {
      // Complete setup even if biometric auth fails
      completePasskeySetup();
    }
  };

  /**
   * Handle biometric skip choice
   */
  const handleBiometricSkip = async (): Promise<void> => {
    // Save the preference to SecureStore
    await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'false');
    // Update auth context state
    setBiometricEnabled(false);
    completePasskeySetup();
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
    showBiometricPrompt,

    // Setters
    setPasskeyPin,
    setPasskeyPinConfirm,
    setShowPinInput,

    // Functions
    startPasskeyCreation,
    handlePinEntry,
    resetPasskeyCreation,
    handleBiometricEnable,
    handleBiometricSkip,
  };
}
