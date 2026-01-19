/**
 * OnboardingPage - Handles wallet creation, import, and authentication flows
 */

import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { logger } from '../utils/logger';

// Components
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PinSetupScreen from '../screens/auth/PinSetupScreen';
import LockScreen from '../screens/auth/LockScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import BiometricPromptModal from '../components/BiometricPromptModal';
import PasskeyPinInput from '../components/PasskeyPinInput';

// Styles
import { colors, spacing, fonts, fontSizes, radii } from '../styles/theme';
import { useResponsive } from '../hooks/useResponsive';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';

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
  } = useWalletCreation({ currentAccount, setIsAuthenticated, setSeedConfirmed, loadWallet });

  // Wallet import hook
  const {
    importingWallet, importSeedPhrase, isImportedWallet, isImporting, seedInputRefs,
    importedMnemonic, setImportingWallet, setImportSeedPhrase, setIsImportedWallet,
    setImportedMnemonic, importWallet,
  } = useWalletImport({ currentAccount, setSettingUpPin });

  // Seed verification hook
  const {
    verifyingSeeds, verificationWords, requiredIndices, wordChoices, setVerificationWords,
    proceedToVerification, verifySeeds, resetVerificationState,
  } = useSeedVerification({ tempMnemonicWords, setSettingUpPin, setShowingSeeds });

  // Passkey creation hook
  const {
    startPasskeyCreation, handlePinEntry, showPinInput, passkeyPin, confirmingPin,
    passkeyPinConfirm, setPasskeyPin, setPasskeyPinConfirm, setShowPinInput, resetPasskeyCreation,
    showBiometricPrompt: showPasskeyBiometricPrompt, handleBiometricEnable: handlePasskeyBiometricEnable,
    handleBiometricSkip: handlePasskeyBiometricSkip,
  } = usePasskeyCreation({ setIsAuthenticated, setSeedConfirmed, setWalletAddresses, setBiometricEnabled });

  // Responsive sizing
  const { s, sf } = useResponsive();

  // Passkey restore hook
  const {
    restoringWithPasskey, showRestorePinInput, restorePin, setRestoringWithPasskey,
    setRestorePin, startPasskeyRestore, restoreWalletWithPasskey, resetPasskeyRestore,
  } = usePasskeyRestore({ setIsAuthenticated, setSeedConfirmed, setWalletAddresses });

  // Onboarding handlers
  const { handlePinSetupComplete, handlePinChangeComplete, handleCancelOnboarding } = useOnboardingHandlers({
    setIsImportedWallet, setImportedMnemonic, setShowingIntro, setShowingSeeds, setImportingWallet,
    setImportSeedPhrase, setVerificationWords, saveWalletAfterPinSetup, loadWallet,
    handlePinSetupCompleteWrapper: handlePinSetupCompleteWrapper as (...args: unknown[]) => Promise<void>,
    handlePinChangeCompleteWrapper: handlePinChangeCompleteWrapper as (...args: unknown[]) => Promise<void>,
    resetWalletAndState,
    fetchBalance, fetchTransactionHistory, showPasskeyMigrationPromptGlobal,
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

  // Passkey Biometric Prompt Modal (after passkey wallet creation)
  const biometricModal = (
    <Modal
      visible={showPasskeyBiometricPrompt}
      transparent
      animationType="fade"
    >
      <View style={localStyles.biometricOverlay}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[localStyles.biometricModal, {
            borderRadius: s(radii.xl),
            padding: s(spacing.xl),
            marginVertical: s(spacing.xl),
          }]}>
            <Text style={[localStyles.biometricTitle, { fontSize: sf(fontSizes.lg), marginBottom: s(spacing.md) }]}>
              Biometric Authentication
            </Text>
            <Text style={[localStyles.biometricText, { fontSize: sf(fontSizes.md), marginBottom: s(25), lineHeight: sf(22) }]}>
              Do you want to use biometric authentication (FaceID or TouchID) for quick access to your wallet?
            </Text>
            <View style={[localStyles.biometricButtons, { gap: s(12) }]}>
              <TouchableOpacity
                style={[localStyles.biometricButton, localStyles.biometricButtonYes, {
                  paddingVertical: s(spacing.md),
                  paddingHorizontal: s(spacing.lg),
                  borderRadius: s(radii.lg)
                }]}
                onPress={handlePasskeyBiometricEnable}
              >
                <Text style={[localStyles.biometricButtonText, { fontSize: sf(fontSizes.md) }]}>Yes, Enable</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[localStyles.biometricButton, localStyles.biometricButtonNo, {
                  paddingVertical: s(spacing.md),
                  paddingHorizontal: s(spacing.lg),
                  borderRadius: s(radii.lg)
                }]}
                onPress={handlePasskeyBiometricSkip}
              >
                <Text style={[localStyles.biometricButtonTextNo, { fontSize: sf(fontSizes.md) }]}>No, Thanks</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

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
        <LockScreen onAuthenticated={handleLockScreenAuthenticatedWrapper} />
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
        {biometricModal}
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
        {biometricModal}
        <StatusBar style="light" />
      </View>
    );
  }

  logger.debug('[OnboardingPage] Reached unexpected state:', { wallet: !!wallet, isAuthenticated, seedConfirmed });
  // Render biometric modal even in unexpected state (wallet may have just been created)
  return biometricModal;
}

const localStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.DARK_BG, paddingHorizontal: 0 },
  welcomeContainer: { flex: 1, backgroundColor: COLORS.DARK_BG },
  biometricOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricModal: {
    backgroundColor: colors.bg.secondary,
    width: '85%',
    maxWidth: 400,
  },
  biometricTitle: {
    fontFamily: fonts.bold,
    fontWeight: 'bold' as const,
    color: colors.text.primary,
    textAlign: 'center',
  },
  biometricText: {
    fontFamily: fonts.regular,
    color: colors.text.primary,
    textAlign: 'center',
  },
  biometricButtons: {
    flexDirection: 'column',
  },
  biometricButton: {
    alignItems: 'center',
  },
  biometricButtonYes: {
    backgroundColor: colors.brand.primary,
  },
  biometricButtonNo: {
    backgroundColor: COLORS.OFF_WHITE,
  },
  biometricButtonText: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  biometricButtonTextNo: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    color: COLORS.DARK_GRAY,
  },
});
