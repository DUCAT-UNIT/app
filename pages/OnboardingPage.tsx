/**
 * OnboardingPage - Handles wallet creation, import, and authentication flows
 */

import { StatusBar } from 'expo-status-bar';
import React,{ useCallback } from 'react';
import { Alert,StyleSheet,View } from 'react-native';
import {
  authenticateWithBiometrics,
  setBiometricEnabled as persistBiometricEnabled,
} from '../services/biometricService';
import * as PasskeyService from '../services/passkey';
import { hasSessionMnemonic } from '../services/secureStorageService';
import { logger } from '../utils/logger';

// Components
import MutinynetBanner from '../components/MutinynetBanner';
import PasskeyPinInput from '../components/PasskeyPinInput';
import LockScreen from '../screens/auth/LockScreen';
import PinSetupScreen from '../screens/auth/PinSetupScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useAuthFlowHandlers } from '../contexts/NavigationHandlersContext';
import { useWallet } from '../contexts/WalletContext';

// Hooks
import { useOnboardingHandlers } from '../hooks/useOnboardingHandlers';
import { usePasskeyCreation } from '../hooks/usePasskeyCreation';
import { usePasskeyRestore } from '../hooks/usePasskeyRestore';
import { useWalletImport } from '../hooks/useWalletImport';

// Utils
import { COLORS } from '../theme';

interface OnboardingPageProps {
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

export default function OnboardingPage({
  seedConfirmed, setSeedConfirmed, fetchBalance, fetchTransactionHistory,
  resetWalletAndState, handlePinSetupCompleteWrapper, handlePinChangeCompleteWrapper,
  handleCancelPinChange, handleLockScreenAuthenticatedWrapper, keyboardHeight,
}: OnboardingPageProps) {
  const {
    isAuthenticated, isBiometricSupported, biometricEnabled,
    settingUpPin, changingPin, showPinEntry, setIsAuthenticated, setSettingUpPin,
    setBiometricEnabled,
  } = useAuth();

  const { wallet, currentAccount, loadWallet, setWalletAddresses } = useWallet();
  const { showPasskeyMigrationPrompt: showPasskeyMigrationPromptGlobal, showBiometricSetupPrompt } = useAuthFlowHandlers();

  // Wallet import hook
  const {
    importingWallet, importSeedPhrase, isImportedWallet, isImporting, seedInputRefs,
    importedMnemonic, setImportingWallet, setImportSeedPhrase, setIsImportedWallet,
    setImportedMnemonic, importWallet, persistImportedWallet,
  } = useWalletImport({ currentAccount, setSettingUpPin });

  // Passkey creation hook
  const {
    startPasskeyCreation, handlePinEntry, showPinInput, passkeyPin, confirmingPin,
    passkeyPinConfirm, setPasskeyPin, setPasskeyPinConfirm, setShowPinInput, resetPasskeyCreation,
  } = usePasskeyCreation({ setIsAuthenticated, setSeedConfirmed, setWalletAddresses, showBiometricSetupPrompt });

  // Passkey restore hook
  const {
    restoringWithPasskey, showRestorePinInput, restorePin, setRestoringWithPasskey,
    setRestorePin, startPasskeyRestore, restoreWalletWithPasskey, resetPasskeyRestore,
  } = usePasskeyRestore({ setIsAuthenticated, setSeedConfirmed, setWalletAddresses });

  // Onboarding handlers
  const { handlePinSetupComplete, handlePinChangeComplete } = useOnboardingHandlers({
    setIsImportedWallet, setImportedMnemonic, setImportingWallet,
    setImportSeedPhrase, persistImportedWallet, loadWallet,
    handlePinSetupCompleteWrapper: handlePinSetupCompleteWrapper as (...args: unknown[]) => Promise<void>,
    handlePinChangeCompleteWrapper: handlePinChangeCompleteWrapper as (...args: unknown[]) => Promise<void>,
    resetWalletAndState,
    fetchBalance, fetchTransactionHistory, showPasskeyMigrationPromptGlobal,
    isImportedWallet, importedMnemonic,
  });

  const enableBiometricFromPrompt = useCallback(async (): Promise<void> => {
    try {
      const result = await authenticateWithBiometrics(
        'Authenticate to enable Face ID',
        'Cancel'
      );

      if (!result.success) {
        return;
      }

      if (!await persistBiometricEnabled(true)) {
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
  }, [setBiometricEnabled, setIsAuthenticated, handleLockScreenAuthenticatedWrapper]);

  // Handle biometric authentication with proper post-auth flow
  const handleBiometricAuth = useCallback(async () => {
    logger.debug('[OnboardingPage] handleBiometricAuth called', { biometricEnabled, isBiometricSupported });
    try {
      if (biometricEnabled) {
        const result = await authenticateWithBiometrics(
          'Authenticate to unlock wallet',
          'Use PIN'
        );

        if (result.success) {
          const passkeyEnabled = await PasskeyService.isPasskeyEnabled();
          if (passkeyEnabled && !hasSessionMnemonic()) {
            Alert.alert(
              'Use PIN To Unlock',
              'This wallet needs your PIN to re-establish the encrypted passkey session after a restart.'
            );
            return;
          }
          setIsAuthenticated(true);
          handleLockScreenAuthenticatedWrapper();
        }
      } else {
        // Biometrics not enabled - ask user if they want to enable
        Alert.alert(
          'Enable Face ID',
          'Would you like to enable Face ID for faster login?',
          [
            {
              text: 'Not Now',
              style: 'cancel',
            },
            {
              text: 'Enable',
              onPress: () => {
                enableBiometricFromPrompt();
              },
            },
          ]
        );
      }
    } catch (error) {
      logger.error('[OnboardingPage] Biometric auth error:', { error: error instanceof Error ? error.message : String(error) });
    }
  }, [biometricEnabled, isBiometricSupported, setIsAuthenticated, enableBiometricFromPrompt, handleLockScreenAuthenticatedWrapper]);

  // Common WelcomeScreen props
  const welcomeProps = {
    importingWallet, importSeedPhrase, seedInputRefs, isImporting,
    restoringWithPasskey, setImportingWallet, setImportSeedPhrase,
    setRestoringWithPasskey,
    createWalletWithPasskey: startPasskeyCreation, importWallet, restoreWithPasskey: startPasskeyRestore,
    keyboardHeight,
  };

  // Passkey PIN Input (creation)
  if (showPinInput) {
    const currentPin = confirmingPin ? passkeyPinConfirm : passkeyPin;
    const setCurrentPin = confirmingPin ? setPasskeyPinConfirm : setPasskeyPin;
    return (
      <PasskeyPinInput
        title={confirmingPin ? 'Confirm your PIN' : 'Create a 6-digit PIN'}
        subtitle={confirmingPin ? 'Enter your PIN again to confirm' : 'This PIN will be used with your passkey to encrypt your wallet'}
        pin={currentPin} setPin={setCurrentPin} onPinComplete={handlePinEntry}
        onCancel={() => { setShowPinInput(false); setPasskeyPin(''); resetPasskeyCreation(); }}
      />
    );
  }

  // Passkey Restore PIN Input
  if (showRestorePinInput) {
    return (
      <PasskeyPinInput
        title="Enter your PIN" subtitle="Enter the PIN you created with your passkey wallet"
        pin={restorePin} setPin={setRestorePin} onPinComplete={restoreWalletWithPasskey}
        onCancel={() => { setRestorePin(''); resetPasskeyRestore(); setRestoringWithPasskey(true); }}
      />
    );
  }

  // PIN Setup Screen
  if (settingUpPin) {
    return (
      <View style={localStyles.container}>
        <MutinynetBanner />
        <PinSetupScreen changingPin={changingPin} isBiometricSupported={isBiometricSupported}
          onPinSetupComplete={handlePinSetupComplete} onPinChangeComplete={handlePinChangeComplete}
          onCancel={handleCancelPinChange} fetchBalance={fetchBalance} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Lock Screen (PIN entry)
  if (showPinEntry) {
    return (
      <View style={localStyles.container}>
        <MutinynetBanner />
        <LockScreen
          onAuthenticated={handleLockScreenAuthenticatedWrapper}
          showFaceIdButton={isBiometricSupported}
          onFaceIdPress={handleBiometricAuth}
        />
        <StatusBar style="light" />
      </View>
    );
  }

  // Locked state (wallet exists but not authenticated)
  if (!isAuthenticated && wallet && seedConfirmed && !settingUpPin) {
    return (
      <View style={localStyles.container}>
        <MutinynetBanner />
        <LockScreen
          onAuthenticated={handleLockScreenAuthenticatedWrapper}
          showFaceIdButton={isBiometricSupported}
          onFaceIdPress={handleBiometricAuth}
        />
        <StatusBar style="light" />
      </View>
    );
  }

  // Welcome/Onboarding Screen
  const shouldShowWelcome = (!wallet || importingWallet || restoringWithPasskey)
    && !showPinInput && !showRestorePinInput;
  const isFullySetUp = wallet && isAuthenticated && seedConfirmed;

  if (shouldShowWelcome && !isFullySetUp) {
    return (
      <View style={localStyles.welcomeContainer} testID="onboarding-page">
        <MutinynetBanner />
        <WelcomeScreen {...welcomeProps} />
        <StatusBar style="light" />
      </View>
    );
  }

  logger.debug('[OnboardingPage] Reached unexpected state:', { wallet: !!wallet, isAuthenticated, seedConfirmed });
  return null;
}

const localStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.DARK_BG, paddingHorizontal: 0 },
  welcomeContainer: { flex: 1, backgroundColor: COLORS.DARK_BG },
});
