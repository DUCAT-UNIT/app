/**
 * usePasskeyCreation Hook
 * Manages passkey-based wallet creation flow
 */

import { useState, useRef, Dispatch, SetStateAction, MutableRefObject } from 'react';
import { Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as PasskeyService from '../services/passkey';
import * as WalletService from '../services/walletService';
import { savePin } from '../services/pinService';
import type { WalletAddresses } from '../contexts/WalletContext';
import { notify } from '../utils/notify';
import { logger } from '../utils/logger';

import { isE2E } from '../utils/e2e';

interface UsePasskeyCreationParams {
  setIsAuthenticated: (value: boolean) => void;
  setSeedConfirmed: (value: boolean) => void;
  setWalletAddresses: (addresses: WalletAddresses, accountIndex: number) => void;
  showBiometricSetupPrompt: () => void;
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
  icloudBackupFailed: boolean;
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
}: UsePasskeyCreationParams): UsePasskeyCreationReturn {
  const [creatingWithPasskey, setCreatingWithPasskey] = useState(false);
  const [passkeyMnemonic, setPasskeyMnemonic] = useState<string | null>(null);
  const [passkeyAddresses, setPasskeyAddresses] = useState<WalletAddresses | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [passkeyPin, setPasskeyPin] = useState('');
  const [confirmingPin, setConfirmingPin] = useState(false);
  const [passkeyPinConfirm, setPasskeyPinConfirm] = useState('');
  const [icloudBackupFailed, setIcloudBackupFailed] = useState(false);
  const walletExistsRef = useRef(false);

  /**
   * Start passkey wallet creation (prompts for PIN first)
   */
  const startPasskeyCreation = async (): Promise<void> => {
    try {
      // In E2E mode, skip native passkey support check (simulator can't do passkeys)
      if (!isE2E) {
        const supported = await PasskeyService.isPasskeySupported();
        if (!supported) {
          notify.passkey.notSupported();
          return;
        }
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
   * Create wallet using passkey (after PIN is confirmed)
   */
  const createWalletWithPasskey = async (pin: string): Promise<void> => {
    try {
      // Note: setIsCreating(true) is called in handlePinEntry for instant feedback

      if (isE2E) {
        // E2E bypass: skip native passkey dialog, create wallet directly
        const { mnemonic, addresses } = await WalletService.generateWallet(0);
        await WalletService.saveWalletToStorage(mnemonic, 0);
        await savePin(pin);

        walletExistsRef.current = true;
        setWalletAddresses(addresses, 0);
        completePasskeySetup();
        notify.passkey.created();
        return;
      }

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

      // Complete navigation - take user to wallet home screen
      completePasskeySetup();

      // Show immediate success
      notify.passkey.created();

      // Show biometric prompt immediately after setup is complete
      if (biometricSupported) {
        logger.auth('Passkey creation: showing biometric prompt');
        showBiometricSetupPrompt();
      }

      // Handle iCloud backup result in background (non-blocking)
      // On failure, show a native Alert that the user must acknowledge —
      // this persists across navigation and cannot be accidentally dismissed.
      if (icloudBackupPromise) {
        icloudBackupPromise.then((result) => {
          if (!result.success) {
            logger.error('[usePasskeyCreation] iCloud backup failed after wallet creation', {
              error: result.error,
            });
            setIcloudBackupFailed(true);
            Alert.alert(
              'Cloud Backup Failed',
              'Your wallet was created but could not be backed up to iCloud. ' +
              'Without a backup, you cannot recover this wallet on a new device.\n\n' +
              'Please check that iCloud is enabled in Settings and try again from Settings > Backup.',
              [{ text: 'I Understand', style: 'destructive' }],
              { cancelable: false }
            );
          }
        }).catch((error: unknown) => {
          logger.warn('[usePasskeyCreation] iCloud backup promise rejected', {
            error: error instanceof Error ? error.message : String(error),
          });
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
    icloudBackupFailed,
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
