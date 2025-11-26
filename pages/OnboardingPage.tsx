/**
 * OnboardingPage - Handles wallet creation, import, and authentication flows
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { logger } from '../utils/logger';

// Components
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PinSetupScreen from '../screens/auth/PinSetupScreen';
import LockScreen from '../screens/auth/LockScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import BiometricPromptModal from '../components/BiometricPromptModal';
import ToastContainer from '../components/ToastContainer';
import PasskeyPinInput from '../components/PasskeyPinInput';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useNotifications } from '../contexts/NotificationContext';

// Hooks
import { useWalletCreation } from '../hooks/useWalletCreation';
import { useWalletImport } from '../hooks/useWalletImport';
import { useSeedVerification } from '../hooks/useSeedVerification';
import { usePasskeyCreation } from '../hooks/usePasskeyCreation';
import { usePasskeyRestore } from '../hooks/usePasskeyRestore';
import { useOnboardingHandlers } from '../hooks/useOnboardingHandlers';

// Utils
import { COLORS } from '../theme';

// Types
import type { ViewStyle, TextStyle, ImageStyle } from 'react-native';

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
  styles: Record<string, ViewStyle | TextStyle | ImageStyle>;
}

export default function OnboardingPage({
  seedConfirmed, setSeedConfirmed, fetchBalance, fetchTransactionHistory,
  resetWalletAndState, handlePinSetupCompleteWrapper, handlePinChangeCompleteWrapper,
  handleCancelPinChange, handleLockScreenAuthenticatedWrapper, keyboardHeight, styles,
}: OnboardingPageProps) {
  const { showToast, toasts } = useNotifications();

  const {
    isAuthenticated, isBiometricSupported, showBiometricPrompt, showFaceIdButton,
    settingUpPin, changingPin, showPinEntry, setIsAuthenticated, setSettingUpPin,
    setBiometricEnabled, setShowBiometricPrompt, authenticateUser,
  } = useAuth();

  const { wallet, currentAccount, loadWallet, setWalletAddresses } = useWallet();
  const { showPasskeyMigrationPrompt: showPasskeyMigrationPromptGlobal } = useNavigationHandlers();

  // Wallet creation hook
  const {
    tempMnemonicWords, showingIntro, showingSeeds, setShowingIntro, setShowingSeeds,
    createWallet, saveWalletAfterPinSetup, resetCreationState,
  } = useWalletCreation({ currentAccount, setIsAuthenticated, setSeedConfirmed, showToast, loadWallet });

  // Wallet import hook
  const {
    importingWallet, importSeedPhrase, isImportedWallet, isImporting, seedInputRefs,
    importedMnemonic, setImportingWallet, setImportSeedPhrase, setIsImportedWallet,
    setImportedMnemonic, importWallet,
  } = useWalletImport({ currentAccount, setSettingUpPin, showToast });

  // Seed verification hook
  const {
    verifyingSeeds, verificationWords, requiredIndices, wordChoices, setVerificationWords,
    proceedToVerification, verifySeeds, resetVerificationState,
  } = useSeedVerification({ tempMnemonicWords, setSettingUpPin, setShowingSeeds, showToast });

  // Passkey creation hook
  const {
    startPasskeyCreation, handlePinEntry, showPinInput, passkeyPin, confirmingPin,
    passkeyPinConfirm, setPasskeyPin, setPasskeyPinConfirm, setShowPinInput, resetPasskeyCreation,
  } = usePasskeyCreation({ setIsAuthenticated, setSeedConfirmed, showToast, setWalletAddresses });

  // Passkey restore hook
  const {
    restoringWithPasskey, showRestorePinInput, restorePin, setRestoringWithPasskey,
    setRestorePin, startPasskeyRestore, restoreWalletWithPasskey, resetPasskeyRestore,
  } = usePasskeyRestore({ setIsAuthenticated, setSeedConfirmed, showToast, setWalletAddresses });

  // Onboarding handlers
  const { handlePinSetupComplete, handlePinChangeComplete, handleCancelOnboarding } = useOnboardingHandlers({
    setIsImportedWallet, setImportedMnemonic, setShowingIntro, setShowingSeeds, setImportingWallet,
    setImportSeedPhrase, setVerificationWords, saveWalletAfterPinSetup, loadWallet,
    handlePinSetupCompleteWrapper: handlePinSetupCompleteWrapper as (...args: unknown[]) => Promise<void>,
    handlePinChangeCompleteWrapper: handlePinChangeCompleteWrapper as (...args: unknown[]) => Promise<void>,
    resetWalletAndState,
    fetchBalance, fetchTransactionHistory, showPasskeyMigrationPromptGlobal, showToast,
    isImportedWallet, importedMnemonic,
  });

  // Common WelcomeScreen props
  const welcomeProps = {
    wallet, importingWallet, showingIntro, showingSeeds, verifyingSeeds, tempMnemonicWords,
    importSeedPhrase, verificationWords, requiredIndices, wordChoices, seedInputRefs, isImporting,
    restoringWithPasskey, setImportingWallet, setImportSeedPhrase, setVerificationWords,
    setShowingIntro, setShowingSeeds, setRestoringWithPasskey, createWallet,
    createWalletWithPasskey: startPasskeyCreation, importWallet, restoreWithPasskey: startPasskeyRestore,
    resetWallet: handleCancelOnboarding, resetCreationState, resetVerificationState,
    proceedToVerification, verifySeeds, keyboardHeight,
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
        toasts={toasts}
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
        toasts={toasts}
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
          onCancel={handleCancelPinChange} fetchBalance={fetchBalance} showToast={showToast} />
        <ToastContainer toasts={toasts} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Lock Screen (PIN entry)
  if (showPinEntry) {
    return (
      <View style={localStyles.container}>
        <MutinynetBanner />
        <LockScreen onAuthenticated={handleLockScreenAuthenticatedWrapper} />
        <ToastContainer toasts={toasts} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Locked state (wallet exists but not authenticated)
  if (!isAuthenticated && wallet && seedConfirmed && !showingIntro && !showingSeeds && !verifyingSeeds && !settingUpPin) {
    return (
      <View style={localStyles.container}>
        <MutinynetBanner />
        <LockScreen onAuthenticated={handleLockScreenAuthenticatedWrapper}
          showFaceIdButton={showFaceIdButton && !showBiometricPrompt} onFaceIdPress={authenticateUser} />
        <BiometricPromptModal visible={showBiometricPrompt} isAuthenticated={isAuthenticated}
          onClose={() => setShowBiometricPrompt(false)}
          onBiometricEnabled={(enabled, authSuccess) => { setBiometricEnabled(enabled); if (authSuccess) setIsAuthenticated(true); }}
          onBiometricDisabled={() => setBiometricEnabled(false)} styles={styles as Parameters<typeof BiometricPromptModal>[0]['styles']} />
        <ToastContainer toasts={toasts} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Welcome/Onboarding Screen
  const shouldShowWelcome = (!wallet || importingWallet || showingIntro || showingSeeds || verifyingSeeds || restoringWithPasskey)
    && !showPinInput && !showRestorePinInput;
  const isFullySetUp = wallet && isAuthenticated && seedConfirmed;

  if (shouldShowWelcome && !isFullySetUp) {
    return (
      <View style={localStyles.welcomeContainer}>
        <MutinynetBanner />
        <WelcomeScreen {...welcomeProps} />
        <ToastContainer toasts={toasts} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Fallback: wallet exists but seedConfirmed=false
  if (wallet && !seedConfirmed) {
    return (
      <View style={localStyles.welcomeContainer}>
        <MutinynetBanner />
        <WelcomeScreen {...welcomeProps} importingWallet={false} showingIntro={true} showingSeeds={false}
          verifyingSeeds={false} tempMnemonicWords={[]} verificationWords={{}} requiredIndices={[]}
          wordChoices={{}} restoringWithPasskey={false} />
        <ToastContainer toasts={toasts} />
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
