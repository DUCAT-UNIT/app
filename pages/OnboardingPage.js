/**
 * OnboardingPage - Handles wallet creation, import, and authentication flows
 * Contains WelcomeScreen, PinSetupScreen, and LockScreen
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Components
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PinSetupScreen from '../screens/auth/PinSetupScreen';
import LockScreen from '../screens/auth/LockScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import BiometricPromptModal from '../components/BiometricPromptModal';
import ToastContainer from '../components/ToastContainer';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';

// Hooks
import { useWalletCreation } from '../hooks/useWalletCreation';
import { useWalletImport } from '../hooks/useWalletImport';
import { useSeedVerification } from '../hooks/useSeedVerification';
import { useToastContext } from '../contexts/UIContext';

// Utils
import { COLORS } from '../theme';

export default function OnboardingPage({
  seedConfirmed,
  setSeedConfirmed,
  showToast: _showToastProp, // Receive but don't use - we'll use our own
  fetchBalance,
  resetWalletAndState,
  handlePinSetupCompleteWrapper,
  handlePinChangeCompleteWrapper,
  handleCancelPinChange,
  handleLockScreenAuthenticatedWrapper,
  keyboardHeight,
  styles,
}) {
  // Toast context
  const { showToast, toasts } = useToastContext();

  // Auth context
  const {
    isAuthenticated,
    isBiometricSupported,
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
  const { wallet, currentAccount, loadWallet } = useWallet();

  // Wallet creation hook
  const {
    tempMnemonicWords,
    showingIntro,
    showingSeeds,
    walletExistsRef: _walletExists,
    setShowingIntro,
    setShowingSeeds,
    createWallet,
    saveWalletAfterPinSetup,
    resetCreationState,
  } = useWalletCreation({
    currentAccount,
    setIsAuthenticated,
    setSeedConfirmed,
    showToast,
    loadWallet,
  });

  // Wallet import hook
  const {
    importingWallet,
    importSeedPhrase,
    isImportedWallet,
    isImporting,
    seedInputRefs,
    setImportingWallet,
    setImportSeedPhrase,
    setIsImportedWallet,
    importWallet,
  } = useWalletImport({
    currentAccount,
    setSettingUpPin,
    showToast,
    loadWallet,
  });

  // Seed verification hook
  const {
    verifyingSeeds,
    verificationWords,
    requiredIndices,
    wordChoices,
    setVerificationWords,
    proceedToVerification,
    verifySeeds,
    resetVerificationState,
  } = useSeedVerification({
    tempMnemonicWords,
    setSettingUpPin,
    setShowingSeeds,
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

  // Reset all onboarding UI state and wallet data (full reset)
  // Called when user clicks Cancel or Start Again during onboarding
  const handleCancelOnboarding = async () => {
    // Reset all local UI state first
    setShowingIntro(false);
    setShowingSeeds(false);
    setImportingWallet(false);
    setImportSeedPhrase(Array(12).fill(''));
    setVerificationWords({});
    setIsImportedWallet(false);

    // Reset wallet data and AsyncStorage - this returns to initial welcome screen
    await resetWalletAndState();
  };

  // PIN Setup Screen (Step 4 of onboarding or PIN change)
  if (settingUpPin) {
    return (
      <View style={localStyles.container}>
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
        <ToastContainer toasts={toasts} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Lock Screen (PIN entry for authentication)
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

  // Show locked screen if not authenticated and wallet exists AND seed backup confirmed AND not in setup flow
  if (
    !isAuthenticated &&
    wallet &&
    seedConfirmed &&
    !showingIntro &&
    !showingSeeds &&
    !verifyingSeeds &&
    !settingUpPin
  ) {
    return (
      <View style={localStyles.container}>
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
        <ToastContainer toasts={toasts} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Welcome/Onboarding Screen (wallet creation/import/seed verification)
  if (!wallet || importingWallet || showingIntro || showingSeeds || verifyingSeeds) {
    return (
      <View style={localStyles.welcomeContainer}>
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
          isImporting={isImporting}
          setImportingWallet={setImportingWallet}
          setImportSeedPhrase={setImportSeedPhrase}
          setVerificationWords={setVerificationWords}
          setShowingIntro={setShowingIntro}
          setShowingSeeds={setShowingSeeds}
          createWallet={createWallet}
          importWallet={importWallet}
          resetWallet={handleCancelOnboarding}
          resetCreationState={resetCreationState}
          resetVerificationState={resetVerificationState}
          proceedToVerification={proceedToVerification}
          verifySeeds={verifySeeds}
          keyboardHeight={keyboardHeight}
        />
        <ToastContainer toasts={toasts} />
        <StatusBar style="light" />
      </View>
    );
  }

  // CRITICAL FIX: If we reach here with wallet but seedConfirmed=false,
  // the onboarding state was lost (e.g., from app backgrounding).
  // Show WelcomeScreen as fallback to let user continue onboarding.
  if (wallet && !seedConfirmed) {
    return (
      <View style={localStyles.welcomeContainer}>
        <MutinynetBanner />
        <WelcomeScreen
          wallet={wallet}
          importingWallet={false}
          showingIntro={true} // Force show intro to restart flow
          showingSeeds={false}
          verifyingSeeds={false}
          tempMnemonicWords={[]}
          importSeedPhrase={importSeedPhrase}
          verificationWords={{}}
          requiredIndices={[]}
          wordChoices={{}}
          seedInputRefs={seedInputRefs}
          isImporting={isImporting}
          setImportingWallet={setImportingWallet}
          setImportSeedPhrase={setImportSeedPhrase}
          setVerificationWords={setVerificationWords}
          setShowingIntro={setShowingIntro}
          setShowingSeeds={setShowingSeeds}
          createWallet={createWallet}
          importWallet={importWallet}
          resetWallet={handleCancelOnboarding}
          resetCreationState={resetCreationState}
          resetVerificationState={resetVerificationState}
          proceedToVerification={proceedToVerification}
          verifySeeds={verifySeeds}
          keyboardHeight={keyboardHeight}
        />
        <ToastContainer toasts={toasts} />
        <StatusBar style="light" />
      </View>
    );
  }

  // If we reach here, user is authenticated and has a wallet - don't render anything
  // Let the parent (App.js) render the WalletPage
  return null;
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    paddingHorizontal: 0,
  },
  welcomeContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
});
