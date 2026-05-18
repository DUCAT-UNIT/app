/**
 * useOnboardingStateMachine Hook
 * Derives the current onboarding screen from state and composes all onboarding hooks.
 */

import { useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import {
  authenticateWithBiometrics,
  setBiometricEnabled as persistBiometricEnabled,
} from '../services/biometricService';
import {
  canUseBiometricUnlockForMnemonic,
  hasAccessibleMnemonic,
} from '../services/secureStorageService';
import { logger } from '../utils/logger';

import { useAuth } from '../contexts/AuthContext';
import { useAuthFlowHandlers } from '../contexts/NavigationHandlersContext';
import { useWallet } from '../contexts/WalletContext';

import { useOnboardingHandlers } from './useOnboardingHandlers';
import { usePasskeyCreation } from './usePasskeyCreation';
import { usePasskeyRestore } from './usePasskeyRestore';
import { useWalletImport } from './useWalletImport';

// --- Pure state machine ---

export type OnboardingScreen =
  | 'passkey_pin_create'
  | 'passkey_pin_restore'
  | 'pin_setup'
  | 'locked'
  | 'welcome';

export interface OnboardingState {
  showPinInput: boolean;
  showRestorePinInput: boolean;
  settingUpPin: boolean;
  showPinEntry: boolean;
  isAuthenticated: boolean;
  wallet: unknown | null;
  seedConfirmed: boolean;
  importingWallet: boolean;
  restoringWithPasskey: boolean;
}

/**
 * Derives the current onboarding screen from state flags.
 * Priority order matches the original if/else chain in OnboardingPage.
 */
export function deriveOnboardingScreen(state: OnboardingState): OnboardingScreen {
  if (state.showPinInput) return 'passkey_pin_create';
  if (state.showRestorePinInput) return 'passkey_pin_restore';
  if (state.settingUpPin) return 'pin_setup';
  if (state.showPinEntry) return 'locked';
  if (!state.isAuthenticated && state.wallet && state.seedConfirmed && !state.settingUpPin) {
    return 'locked';
  }
  return 'welcome';
}

// --- Hook ---

interface UseOnboardingStateMachineParams {
  seedConfirmed: boolean;
  setSeedConfirmed: (confirmed: boolean) => void;
  fetchBalance: () => Promise<unknown>;
  fetchTransactionHistory: () => Promise<void>;
  resetWalletAndState: () => Promise<void>;
  handlePinSetupCompleteWrapper: (pin: string, enableBiometric: boolean) => Promise<void>;
  handlePinChangeCompleteWrapper: (pin: string, enableBiometric: boolean) => Promise<void>;
  handleCancelPinChange: () => void;
  handleLockScreenAuthenticatedWrapper: () => void;
  keyboardHeight: number;
}

export function useOnboardingStateMachine({
  seedConfirmed,
  setSeedConfirmed,
  fetchBalance,
  fetchTransactionHistory,
  resetWalletAndState,
  handlePinSetupCompleteWrapper,
  handlePinChangeCompleteWrapper,
  handleCancelPinChange,
  handleLockScreenAuthenticatedWrapper,
  keyboardHeight,
}: UseOnboardingStateMachineParams) {
  const {
    isAuthenticated,
    isBiometricSupported,
    biometricEnabled,
    showFaceIdButton,
    settingUpPin,
    changingPin,
    showPinEntry,
    setIsAuthenticated,
    setSettingUpPin,
    setBiometricEnabled,
    setShowFaceIdButton,
  } = useAuth();

  const { wallet, currentAccount, loadWallet, setWalletAddresses } = useWallet();
  const { showPasskeyMigrationPrompt: showPasskeyMigrationPromptGlobal, showBiometricSetupPrompt } =
    useAuthFlowHandlers();

  const {
    importingWallet,
    importSeedPhrase,
    importWalletProfile,
    isImportedWallet,
    isImporting,
    seedInputRefs,
    importedMnemonic,
    setImportingWallet,
    setImportSeedPhrase,
    setImportWalletProfile,
    setIsImportedWallet,
    setImportedMnemonic,
    importWallet,
    persistImportedWallet,
  } = useWalletImport({ currentAccount, setSettingUpPin });

  const {
    startPasskeyCreation,
    handlePinEntry,
    showPinInput,
    passkeyPin,
    confirmingPin,
    passkeyPinConfirm,
    setPasskeyPin,
    setPasskeyPinConfirm,
    setShowPinInput,
    resetPasskeyCreation,
    isCreating,
  } = usePasskeyCreation({
    setIsAuthenticated,
    setSeedConfirmed,
    setWalletAddresses,
    showBiometricSetupPrompt,
    showPasskeyMigrationPrompt: showPasskeyMigrationPromptGlobal,
  });

  const {
    restoringWithPasskey,
    showRestorePinInput,
    restorePin,
    setRestoringWithPasskey,
    setRestorePin,
    startPasskeyRestore,
    restoreWalletWithPasskey,
    resetPasskeyRestore,
  } = usePasskeyRestore({ setIsAuthenticated, setSeedConfirmed, setWalletAddresses });

  const { handlePinSetupComplete, handlePinChangeComplete } = useOnboardingHandlers({
    setIsImportedWallet,
    setImportedMnemonic,
    setImportingWallet,
    setImportSeedPhrase,
    persistImportedWallet,
    loadWallet,
    handlePinSetupCompleteWrapper: handlePinSetupCompleteWrapper as (
      ...args: unknown[]
    ) => Promise<void>,
    handlePinChangeCompleteWrapper: handlePinChangeCompleteWrapper as (
      ...args: unknown[]
    ) => Promise<void>,
    resetWalletAndState,
    fetchBalance,
    fetchTransactionHistory,
    showPasskeyMigrationPromptGlobal,
    isImportedWallet,
    importedMnemonic,
  });

  // --- Biometric helpers ---

  const enableBiometricFromPrompt = useCallback(async (): Promise<void> => {
    try {
      const result = await authenticateWithBiometrics('Authenticate to enable Face ID', 'Cancel');
      if (!result.success) return;
      if (!(await hasAccessibleMnemonic())) {
        setShowFaceIdButton(false);
        Alert.alert('Use PIN', 'Enter your PIN once to unlock wallet signing on this device.');
        return;
      }
      if (!(await persistBiometricEnabled(true))) {
        throw new Error('Failed to persist biometric preference');
      }
      setBiometricEnabled(true);
      setIsAuthenticated(true);
      handleLockScreenAuthenticatedWrapper();
    } catch (error: unknown) {
      logger.error('[OnboardingPage] Failed to enable biometrics from lock screen', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    setBiometricEnabled,
    setIsAuthenticated,
    setShowFaceIdButton,
    handleLockScreenAuthenticatedWrapper,
  ]);

  const handleBiometricAuth = useCallback(async () => {
    logger.debug('[OnboardingPage] handleBiometricAuth called', {
      biometricEnabled,
      isBiometricSupported,
    });
    try {
      if (biometricEnabled) {
        const result = await authenticateWithBiometrics('Authenticate to unlock wallet', 'Use PIN');
        if (result.success) {
          if (!(await hasAccessibleMnemonic())) {
            logger.warn('[OnboardingPage] Face ID succeeded but wallet secret is unavailable; requiring PIN');
            setShowFaceIdButton(false);
            return;
          }
          setIsAuthenticated(true);
          handleLockScreenAuthenticatedWrapper();
        }
      } else {
        Alert.alert('Face ID', 'Use Face ID for quick and secure access to your wallet.', [
          {
            text: 'Continue',
            onPress: () => {
              enableBiometricFromPrompt();
            },
          },
        ]);
      }
    } catch (error) {
      logger.error('[OnboardingPage] Biometric auth error:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    biometricEnabled,
    isBiometricSupported,
    setIsAuthenticated,
    setShowFaceIdButton,
    enableBiometricFromPrompt,
    handleLockScreenAuthenticatedWrapper,
  ]);

  // --- Derive screen ---

  const screen = deriveOnboardingScreen({
    showPinInput,
    showRestorePinInput,
    settingUpPin,
    showPinEntry,
    isAuthenticated,
    wallet,
    seedConfirmed,
    importingWallet,
    restoringWithPasskey,
  });

  useEffect(() => {
    if (screen !== 'locked' || !isBiometricSupported) {
      return;
    }

    let cancelled = false;
    canUseBiometricUnlockForMnemonic()
      .then((canUseBiometricUnlock) => {
        if (!cancelled) {
          setShowFaceIdButton(canUseBiometricUnlock);
        }
      })
      .catch((error: unknown) => {
        logger.warn('[OnboardingPage] Failed to resolve Face ID unlock availability', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) {
          setShowFaceIdButton(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isBiometricSupported, screen, setShowFaceIdButton, wallet]);

  return {
    screen,

    // Passkey create PIN state
    showPinInput,
    confirmingPin,
    passkeyPin,
    passkeyPinConfirm,
    setPasskeyPin,
    setPasskeyPinConfirm,
    setShowPinInput,
    handlePinEntry,
    resetPasskeyCreation,
    isCreating,

    // Passkey restore PIN state
    restorePin,
    setRestorePin,
    restoreWalletWithPasskey,
    resetPasskeyRestore,
    setRestoringWithPasskey,

    // PIN setup
    changingPin,
    isBiometricSupported,
    showFaceIdButton,
    handlePinSetupComplete,
    handlePinChangeComplete,
    handleCancelPinChange,
    fetchBalance,

    // Lock screen
    handleLockScreenAuthenticatedWrapper,
    handleBiometricAuth,

    // Welcome screen
    importingWallet,
    importSeedPhrase,
    importWalletProfile,
    seedInputRefs,
    isImporting,
    restoringWithPasskey,
    setImportingWallet,
    setImportSeedPhrase,
    setImportWalletProfile,
    startPasskeyCreation,
    importWallet,
    startPasskeyRestore,
    keyboardHeight,
  };
}
