/**
 * OnboardingPage - Handles wallet creation, import, and authentication flows
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';
import { logger } from '../utils/logger';

// Components
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PinSetupScreen from '../screens/auth/PinSetupScreen';
import LockScreen from '../screens/auth/LockScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import PasskeyPinInput from '../components/PasskeyPinInput';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useAuthFlowHandlers } from '../contexts/NavigationHandlersContext';

// Hooks
import { useWalletCreation } from '../hooks/useWalletCreation';
import { useWalletImport } from '../hooks/useWalletImport';
import { usePasskeyCreation } from '../hooks/usePasskeyCreation';
import { usePasskeyRestore } from '../hooks/usePasskeyRestore';
import { useOnboardingHandlers } from '../hooks/useOnboardingHandlers';

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

  // Wallet creation hook
  const {
    saveWalletAfterPinSetup, resetCreationState,
  } = useWalletCreation({ currentAccount, setIsAuthenticated, setSeedConfirmed, loadWallet });

  // Wallet import hook
  const {
    importingWallet, importSeedPhrase, isImportedWallet, isImporting, seedInputRefs,
    importedMnemonic, setImportingWallet, setImportSeedPhrase, setIsImportedWallet,
    setImportedMnemonic, importWallet,
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
  const { handlePinSetupComplete, handlePinChangeComplete, handleCancelOnboarding } = useOnboardingHandlers({
    setIsImportedWallet, setImportedMnemonic, setImportingWallet,
    setImportSeedPhrase, saveWalletAfterPinSetup, loadWallet,
    handlePinSetupCompleteWrapper: handlePinSetupCompleteWrapper as (...args: unknown[]) => Promise<void>,
    handlePinChangeCompleteWrapper: handlePinChangeCompleteWrapper as (...args: unknown[]) => Promise<void>,
    resetWalletAndState,
    fetchBalance, fetchTransactionHistory, showPasskeyMigrationPromptGlobal,
    isImportedWallet, importedMnemonic,
  });

  // Handle biometric authentication with proper post-auth flow
  const handleBiometricAuth = useCallback(async () => {
    logger.debug('[OnboardingPage] handleBiometricAuth called', { biometricEnabled, isBiometricSupported });
    try {
      if (biometricEnabled) {
        // Biometrics enabled - authenticate directly
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to unlock wallet',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: true,
        });

        if (result.success) {
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
              onPress: async () => {
                // Try to authenticate with biometrics
                const result = await LocalAuthentication.authenticateAsync({
                  promptMessage: 'Authenticate to enable Face ID',
                  fallbackLabel: 'Cancel',
                  disableDeviceFallback: true,
                });

                if (result.success) {
                  // Save biometric preference and complete auth
                  await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'true');
                  setBiometricEnabled(true);
                  setIsAuthenticated(true);
                  handleLockScreenAuthenticatedWrapper();
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      logger.error('[OnboardingPage] Biometric auth error:', { error: error instanceof Error ? error.message : String(error) });
    }
  }, [biometricEnabled, setIsAuthenticated, setBiometricEnabled, handleLockScreenAuthenticatedWrapper]);

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
