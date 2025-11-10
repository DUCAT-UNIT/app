/**
 * OnboardingPage - Handles wallet creation, import, and authentication flows
 * Contains WelcomeScreen, PinSetupScreen, and LockScreen
 */

import React, { useState } from 'react';
import { View, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Components
import WelcomeScreen from '../components/WelcomeScreen';
import PinSetupScreen from '../components/PinSetupScreen';
import LockScreen from '../components/LockScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import BiometricPromptModal from '../components/BiometricPromptModal';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';

// Hooks
import { useOnboarding } from '../hooks/useOnboarding';

// Utils
import { COLORS } from '../utils/colors';

export default function OnboardingPage({
  seedConfirmed,
  setSeedConfirmed,
  showToast,
  fetchBalance,
  resetWalletAndState,
  handlePinSetupCompleteWrapper,
  handlePinChangeCompleteWrapper,
  handleCancelPinChange,
  handleLockScreenAuthenticatedWrapper,
  styles,
}) {
  // Auth context
  const {
    isAuthenticated,
    isBiometricSupported,
    biometricEnabled,
    showBiometricPrompt,
    showFaceIdButton,
    settingUpPin,
    changingPin,
    showPinEntry,
    setIsAuthenticated,
    setSettingUpPin,
    setBiometricEnabled,
    setShowBiometricPrompt,
    authenticateUser,
  } = useAuth();

  // Wallet context
  const { wallet, currentAccount } = useWallet();

  // Onboarding hook
  const {
    tempMnemonicWords,
    showingIntro,
    showingSeeds,
    verifyingSeeds,
    importingWallet,
    importSeedPhrase,
    verificationWords,
    requiredIndices,
    wordChoices,
    seedInputRefs,
    isImportedWallet,
    walletExistsRef: walletExists,
    setShowingIntro,
    setShowingSeeds,
    setImportingWallet,
    setImportSeedPhrase,
    setVerificationWords,
    setIsImportedWallet,
    createWallet,
    importWallet,
    proceedToVerification,
    verifySeeds,
    saveWalletAfterPinSetup,
  } = useOnboarding({
    currentAccount,
    setIsAuthenticated,
    setSettingUpPin,
    setSeedConfirmed,
    showToast,
  });

  // PIN setup completion wrapper - saves wallet and resets state
  const handlePinSetupCompleteInternal = async () => {
    // Save wallet to storage now that PIN is set (only for new wallets, not imported)
    if (!isImportedWallet) {
      const saved = await saveWalletAfterPinSetup();
      if (!saved) {
        showToast('Failed to save wallet', 'error');
        return;
      }
    }
    handlePinSetupCompleteWrapper();
    setIsImportedWallet(false);
  };

  // PIN change completion wrapper - resets state
  const handlePinChangeCompleteInternal = () => {
    handlePinChangeCompleteWrapper();
    setIsImportedWallet(false);
  };

  // PIN Setup Screen (Step 4 of onboarding or PIN change)
  if (settingUpPin) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.DARK_BG, paddingHorizontal: 0 }}>
        <MutinynetBanner />
        <PinSetupScreen
          changingPin={changingPin}
          isBiometricSupported={isBiometricSupported}
          onPinSetupComplete={handlePinSetupCompleteInternal}
          onPinChangeComplete={handlePinChangeCompleteInternal}
          onCancel={handleCancelPinChange}
          fetchBalance={fetchBalance}
          showToast={showToast}
        />
        <StatusBar style="light" />
      </View>
    );
  }

  // Lock Screen (PIN entry for authentication)
  if (showPinEntry) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.DARK_BG, paddingHorizontal: 0 }}>
        <MutinynetBanner />
        <LockScreen onAuthenticated={handleLockScreenAuthenticatedWrapper} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Show locked screen if not authenticated and wallet exists AND seed backup confirmed AND not in setup flow
  if (!isAuthenticated && wallet && seedConfirmed && !showingIntro && !showingSeeds && !verifyingSeeds && !settingUpPin) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.DARK_BG, paddingHorizontal: 0 }}>
        <MutinynetBanner />
        <LockScreen
          onAuthenticated={handleLockScreenAuthenticatedWrapper}
          showFaceIdButton={showFaceIdButton && !showBiometricPrompt}
          onFaceIdPress={authenticateUser}
        />

        <BiometricPromptModal
          visible={showBiometricPrompt}
          isAuthenticated={isAuthenticated}
          onClose={() => setShowBiometricPrompt(false)}
          onBiometricEnabled={(enabled, authSuccess) => {
            setBiometricEnabled(enabled);
            if (authSuccess) {
              setIsAuthenticated(true);
            }
          }}
          onBiometricDisabled={() => setBiometricEnabled(false)}
          styles={styles}
        />
        <StatusBar style="light" />
      </View>
    );
  }

  // Welcome/Onboarding Screen (wallet creation/import/seed verification)
  if (!wallet || importingWallet || showingIntro || showingSeeds || verifyingSeeds) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.DARK_BG }}>
        <MutinynetBanner />
        <WelcomeScreen
          wallet={wallet}
          importingWallet={importingWallet}
          showingIntro={showingIntro}
          showingSeeds={showingSeeds}
          verifyingSeeds={verifyingSeeds}
          tempMnemonicWords={tempMnemonicWords}
          importSeedPhrase={importSeedPhrase}
          verificationWords={verificationWords}
          requiredIndices={requiredIndices}
          wordChoices={wordChoices}
          seedInputRefs={seedInputRefs}
          setImportingWallet={setImportingWallet}
          setImportSeedPhrase={setImportSeedPhrase}
          setVerificationWords={setVerificationWords}
          setShowingIntro={setShowingIntro}
          setShowingSeeds={setShowingSeeds}
          createWallet={createWallet}
          importWallet={importWallet}
          resetWallet={resetWalletAndState}
          proceedToVerification={proceedToVerification}
          verifySeeds={verifySeeds}
        />
        <StatusBar style="light" />
      </View>
    );
  }

  // If we reach here, user is authenticated and has a wallet - don't render anything
  // Let the parent (App.js) render the WalletPage
  return null;
}
