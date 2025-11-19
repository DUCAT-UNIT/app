import logger from '../utils/logger';

/**
 * OnboardingPage - Handles wallet creation, import, and authentication flows
 * Contains WelcomeScreen, PinSetupScreen, and LockScreen
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Components
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PinSetupScreen from '../screens/auth/PinSetupScreen';
import LockScreen from '../screens/auth/LockScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import BiometricPromptModal from '../components/BiometricPromptModal';
import ToastContainer from '../components/ToastContainer';
import Icon from '../components/icons';

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
import { useNotifications } from "../contexts/NotificationContext";

// Utils
import { COLORS } from '../theme';
import styles from '../styles';

export default function OnboardingPage({
  seedConfirmed,
  setSeedConfirmed,
  showToast: _showToastProp, // Receive but don't use - we'll use our own
  fetchBalance,
  fetchTransactionHistory,
  resetWalletAndState,
  handlePinSetupCompleteWrapper,
  handlePinChangeCompleteWrapper,
  handleCancelPinChange,
  handleLockScreenAuthenticatedWrapper,
  keyboardHeight,
  styles,
}) {
  // Toast context
  const { showToast, toasts } = useNotifications();

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
  const { wallet, currentAccount, loadWallet, setWalletAddresses } = useWallet();

  // Navigation handlers (includes passkey migration)
  const { showPasskeyMigrationPrompt: showPasskeyMigrationPromptGlobal } = useNavigationHandlers();

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
    importedMnemonic,
    setImportingWallet,
    setImportSeedPhrase,
    setIsImportedWallet,
    setImportedMnemonic,
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

  // Passkey creation hook
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
    isCreating: isCreatingPasskey,
    creatingWithPasskey,
    resetPasskeyCreation,
  } = usePasskeyCreation({
    setIsAuthenticated,
    setSeedConfirmed,
    showToast,
    loadWallet,
    setWalletAddresses,
  });

  // Passkey restore hook
  const {
    restoringWithPasskey,
    showRestorePinInput,
    restorePin,
    isRestoring,
    setRestoringWithPasskey,
    setRestorePin,
    startPasskeyRestore,
    restoreWalletWithPasskey,
    resetPasskeyRestore,
  } = usePasskeyRestore({
    setIsAuthenticated,
    setSeedConfirmed,
    showToast,
    loadWallet,
  });

  // PIN setup completion wrapper - saves wallet and resets state
  const handlePinSetupCompleteInternal = async (pin) => {
    logger.debug('[OnboardingPage] handlePinSetupCompleteInternal called', {
      isImportedWallet,
      hasPin: !!pin,
      hasImportedMnemonic: !!importedMnemonic,
    });

    // Save wallet to storage now that PIN is set (only for new wallets, not imported)
    if (!isImportedWallet) {
      const saved = await saveWalletAfterPinSetup();
      if (!saved) {
        showToast('Failed to save wallet', 'error');
        return;
      }
    }

    // For imported wallets with mnemonic, show passkey migration prompt (non-blocking)
    logger.debug('[OnboardingPage] Checking passkey modal conditions:', {
      isImportedWallet,
      hasPin: !!pin,
      hasImportedMnemonic: !!importedMnemonic,
    });

    // For imported wallets, load wallet into context before completing setup
    // Check importedMnemonic first (more reliable than isImportedWallet flag)
    if (importedMnemonic && pin) {
      logger.debug('[OnboardingPage] Loading imported wallet into context', {
        isImportedWallet,
        hasImportedMnemonic: !!importedMnemonic,
      });
      // Capture values for passkey modal before clearing state
      const capturedMnemonic = importedMnemonic;
      const capturedPin = pin;

      // Clear import state (but keep mnemonic until after PIN setup for loadWallet)
      setIsImportedWallet(false);

      // Load wallet into context and wait for it to complete
      logger.debug('[OnboardingPage] Calling loadWallet...');
      const loadResult = await loadWallet();
      logger.debug('[OnboardingPage] Wallet loaded:', {
        exists: loadResult?.exists,
        hasAddresses: !!loadResult?.addresses,
        segwitAddress: loadResult?.addresses?.segwitAddress,
        taprootAddress: loadResult?.addresses?.taprootAddress,
      });

      // Complete setup (authenticate and navigate)
      // loadWallet() has already set the wallet in context via setWallet()
      // setSeedConfirmed(true) will trigger navigation
      logger.debug('[OnboardingPage] Completing setup');

      // IMPORTANT: Schedule passkey modal BEFORE navigation/unmounting
      // Once handlePinSetupCompleteWrapper() is called, this component will unmount
      logger.debug('[OnboardingPage] Scheduling passkey migration modal');
      setTimeout(() => {
        logger.debug('[OnboardingPage] Showing passkey migration modal');
        showPasskeyMigrationPromptGlobal(capturedMnemonic, capturedPin);
      }, 2000);

      // Call handlePinSetupCompleteWrapper which sets seedConfirmed and triggers navigation
      // Note: It will call fetchBalance() but might not have addresses from state yet
      await handlePinSetupCompleteWrapper();

      // PROPER FIX: Immediately fetch balance with the addresses we just loaded
      // Pass addresses explicitly to avoid race condition with state updates
      if (loadResult?.exists && loadResult?.addresses) {
        if (fetchBalance) {
          logger.debug('[OnboardingPage] Fetching balance with loaded addresses');
          await fetchBalance(
            loadResult.addresses.segwitAddress,
            loadResult.addresses.taprootAddress
          );
        }

        // Also fetch transaction history for imported wallets
        if (fetchTransactionHistory) {
          logger.debug('[OnboardingPage] Fetching transaction history for imported wallet');
          await fetchTransactionHistory();
        }
      }

      // Clear the imported mnemonic from persisted state (security - don't keep it longer than needed)
      setImportedMnemonic(null);
    } else {
      // Normal wallet creation flow
      logger.debug('[OnboardingPage] Completing setup (normal flow)');
      await handlePinSetupCompleteWrapper();
    }
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


  // Passkey PIN Input (for passkey wallet creation)
  if (showPinInput) {
    const currentPin = confirmingPin ? passkeyPinConfirm : passkeyPin;
    const setCurrentPin = confirmingPin ? setPasskeyPinConfirm : setPasskeyPin;

    const handlePasskeyPinDigit = (digit) => {
      if (currentPin.length < 6) {
        const newPin = currentPin + digit;
        setCurrentPin(newPin);
        // Auto-submit when 6 digits entered
        if (newPin.length === 6) {
          handlePinEntry(newPin);
        }
      }
    };

    const handlePasskeyPinDelete = () => {
      setCurrentPin(currentPin.slice(0, -1));
    };

    return (
      <View style={localStyles.container}>
        <MutinynetBanner />
        <View style={[styles.walletInfo, localStyles.passkeyPinContainer]}>
          <Text style={styles.lockTitle}>
            {confirmingPin ? 'Confirm your PIN' : 'Create a 6-digit PIN'}
          </Text>
          <Text style={localStyles.passkeyPinSubtitle}>
            {confirmingPin
              ? 'Enter your PIN again to confirm'
              : 'This PIN will be used with your passkey to encrypt your wallet'}
          </Text>

          <View style={styles.lockPinDots}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.lockPinDot,
                  i < currentPin.length && styles.lockPinDotFilled,
                ]}
              />
            ))}
          </View>

          <View style={styles.lockKeypad}>
            {[
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.lockKeypadRow}>
                {row.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.lockKey}
                    onPress={() => handlePasskeyPinDigit(String(num))}
                  >
                    <Text style={styles.lockKeyText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.lockKeypadRow}>
              <View style={styles.lockKey} />
              <TouchableOpacity
                style={styles.lockKey}
                onPress={() => handlePasskeyPinDigit('0')}
              >
                <Text style={styles.lockKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.lockKey}
                onPress={handlePasskeyPinDelete}
              >
                <Icon name="delete" size={28} color={COLORS.WHITE} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, localStyles.cancelButton]}
            onPress={() => {
              setShowPinInput(false);
              setPasskeyPin('');
              resetPasskeyCreation();
            }}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <ToastContainer toasts={toasts} />
        <StatusBar style="light" />
      </View>
    );
  }

  // Passkey Restore PIN Input (for passkey wallet restoration)
  if (showRestorePinInput) {
    const handleRestorePinDigit = (digit) => {
      if (restorePin.length < 6) {
        const newPin = restorePin + digit;
        setRestorePin(newPin);
        // Auto-submit when 6 digits entered
        if (newPin.length === 6) {
          restoreWalletWithPasskey(newPin);
        }
      }
    };

    const handleRestorePinDelete = () => {
      setRestorePin(restorePin.slice(0, -1));
    };

    return (
      <View style={localStyles.container}>
        <MutinynetBanner />
        <View style={[styles.walletInfo, localStyles.passkeyPinContainer]}>
          <Text style={styles.lockTitle}>Enter your PIN</Text>
          <Text style={localStyles.passkeyPinSubtitle}>
            Enter the PIN you created with your passkey wallet
          </Text>

          <View style={styles.lockPinDots}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.lockPinDot,
                  i < restorePin.length && styles.lockPinDotFilled,
                ]}
              />
            ))}
          </View>

          <View style={styles.lockKeypad}>
            {[
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.lockKeypadRow}>
                {row.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.lockKey}
                    onPress={() => handleRestorePinDigit(String(num))}
                  >
                    <Text style={styles.lockKeyText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.lockKeypadRow}>
              <View style={styles.lockKey} />
              <TouchableOpacity
                style={styles.lockKey}
                onPress={() => handleRestorePinDigit('0')}
              >
                <Text style={styles.lockKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.lockKey}
                onPress={handleRestorePinDelete}
              >
                <Icon name="delete" size={28} color={COLORS.WHITE} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, localStyles.cancelButton]}
            onPress={() => {
              setRestorePin('');
              resetPasskeyRestore();
              setRestoringWithPasskey(true); // Go back to restore choice
            }}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <ToastContainer toasts={toasts} />
        <StatusBar style="light" />
      </View>
    );
  }

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
  // Don't show if we're in passkey creation/restore PIN input
  // Don't show if wallet is fully set up (authenticated + seed confirmed) - let parent show WalletPage
  const shouldShowWelcome =
    (!wallet || importingWallet || showingIntro || showingSeeds || verifyingSeeds || restoringWithPasskey) &&
    !showPinInput &&
    !showRestorePinInput;

  const isFullySetUp = wallet && isAuthenticated && seedConfirmed;

  if (shouldShowWelcome && !isFullySetUp) {
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
          restoringWithPasskey={restoringWithPasskey}
          setImportingWallet={setImportingWallet}
          setImportSeedPhrase={setImportSeedPhrase}
          setVerificationWords={setVerificationWords}
          setShowingIntro={setShowingIntro}
          setShowingSeeds={setShowingSeeds}
          setRestoringWithPasskey={setRestoringWithPasskey}
          createWallet={createWallet}
          createWalletWithPasskey={startPasskeyCreation}
          importWallet={importWallet}
          restoreWithPasskey={startPasskeyRestore}
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
          restoringWithPasskey={false}
          setImportingWallet={setImportingWallet}
          setImportSeedPhrase={setImportSeedPhrase}
          setVerificationWords={setVerificationWords}
          setShowingIntro={setShowingIntro}
          setShowingSeeds={setShowingSeeds}
          setRestoringWithPasskey={setRestoringWithPasskey}
          createWallet={createWallet}
          createWalletWithPasskey={startPasskeyCreation}
          importWallet={importWallet}
          restoreWithPasskey={startPasskeyRestore}
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

  // This should not be reached - user should be authenticated and showing wallet
  logger.debug('[OnboardingPage] Reached unexpected end state:', {
    wallet: !!wallet,
    isAuthenticated,
    seedConfirmed,
  });

  // Return null - modal is rendered in RootNavigator
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
  passkeyPinContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  passkeyPinSubtitle: {
    fontSize: 14,
    color: COLORS.LIGHT_GRAY,
    textAlign: 'center',
    marginBottom: 30,
    marginHorizontal: 20,
  },
  cancelButton: {
    marginTop: 20,
  },
});
