/**
 * AppNavigator - Main navigation controller
 * Contains all routing logic and screen orchestration
 */

import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Navigation
import RootNavigator from './RootNavigator';

// Components
import AccountSwitcherModal from '../components/AccountSwitcherModal';
import ConfirmationModal from '../components/ConfirmationModal';
import MutinynetBanner from '../components/MutinynetBanner';
import SplashScreen from '../components/SplashScreen';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { TransactionProvider } from '../contexts/TransactionContext';
import { VaultProvider, useVault } from '../contexts/VaultContext';
import { SeedPhraseProvider, useSeedPhrase } from '../contexts/SeedPhraseContext';

// Hooks
import { useToast } from '../hooks/useToast';
import { useKeyboard } from '../hooks/useKeyboard';
import { useWalletInitialization } from '../hooks/useWalletInitialization';
import { useBackgroundSplash } from '../hooks/useBackgroundSplash';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { useSettings } from '../hooks/useSettings';
import { useAccountSwitcher } from '../hooks/useAccountSwitcher';
import { useOnboarding } from '../hooks/useOnboarding';

// Utils
import { SECURE_KEYS } from '../utils/constants';
import { COLORS } from '../utils/colors';
import styles from '../styles';

export default function AppNavigator({ seedConfirmed, setSeedConfirmed }) {
  // Get wallet and auth contexts (available from App.js providers)
  const { wallet, currentAccount, loadWallet, resetWallet, switchAccount: switchAccountContext, fetchBalance } = useWallet();
  const {
    isAuthenticated,
    isBiometricSupported,
    biometricEnabled,
    settingUpPin,
    changingPin,
    showPinEntry,
    setIsAuthenticated,
    setBiometricEnabled,
    setSettingUpPin,
    setChangingPin,
    authenticateUser,
    handlePinSetupComplete,
    handlePinChangeComplete,
    loadBiometricPreference,
    resetAuth,
    startPinChange,
  } = useAuth();

  // Hooks
  const { showToast } = useToast();
  const { keyboardHeight } = useKeyboard();
  const { showBackgroundSplash } = useBackgroundSplash();

  // Wallet exists ref (shared between components)
  const walletExists = useRef(false);

  // Wrap with remaining providers
  return (
    <TransactionProvider
      wallet={wallet}
      currentAccount={currentAccount}
      showToast={showToast}
      startTransactionPolling={() => {}} // TODO: get from hook
      sendTransactionConfirmedNotification={() => {}} // TODO: get from hook
      notificationsEnabled={false} // TODO: get from hook
      fetchBalance={fetchBalance}
    >
      <VaultProvider currentAccount={currentAccount}>
        <SeedPhraseProvider showToast={showToast} setIsAuthenticated={setIsAuthenticated}>
          <AppNavigatorContent
            seedConfirmed={seedConfirmed}
            setSeedConfirmed={setSeedConfirmed}
            wallet={wallet}
            currentAccount={currentAccount}
            isAuthenticated={isAuthenticated}
            isBiometricSupported={isBiometricSupported}
            biometricEnabled={biometricEnabled}
            settingUpPin={settingUpPin}
            changingPin={changingPin}
            showPinEntry={showPinEntry}
            setIsAuthenticated={setIsAuthenticated}
            setBiometricEnabled={setBiometricEnabled}
            setSettingUpPin={setSettingUpPin}
            setChangingPin={setChangingPin}
            authenticateUser={authenticateUser}
            handlePinSetupComplete={handlePinSetupComplete}
            handlePinChangeComplete={handlePinChangeComplete}
            loadBiometricPreference={loadBiometricPreference}
            resetAuth={resetAuth}
            startPinChange={startPinChange}
            loadWallet={loadWallet}
            resetWallet={resetWallet}
            switchAccountContext={switchAccountContext}
            fetchBalance={fetchBalance}
            showToast={showToast}
            keyboardHeight={keyboardHeight}
            showBackgroundSplash={showBackgroundSplash}
            walletExists={walletExists}
          />
        </SeedPhraseProvider>
      </VaultProvider>
    </TransactionProvider>
  );
}

// Separate component with access to all contexts via hooks
function AppNavigatorContent({
  seedConfirmed,
  setSeedConfirmed,
  wallet,
  currentAccount,
  isAuthenticated,
  isBiometricSupported,
  biometricEnabled,
  settingUpPin,
  changingPin,
  showPinEntry,
  setIsAuthenticated,
  setBiometricEnabled,
  setSettingUpPin,
  setChangingPin,
  authenticateUser,
  handlePinSetupComplete,
  handlePinChangeComplete,
  loadBiometricPreference,
  resetAuth,
  startPinChange,
  loadWallet,
  resetWallet,
  switchAccountContext,
  fetchBalance,
  showToast,
  keyboardHeight,
  showBackgroundSplash,
  walletExists,
}) {
  // Now we have access to Vault and SeedPhrase contexts
  const { activeTab, setActiveTab, vaultCredentials, openVault, autoCreateVaultTrigger } = useVault();
  const {
    viewingSeedPhrase,
    seedPhraseWords,
    seedPhraseVisible,
    requestingSeedPhrase,
    seedPhraseTranslateX,
    seedPhrasePanResponderRef,
    setRequestingSeedPhrase,
    requestViewSeedPhrase,
    loadSeedPhrase,
    closeSeedPhrase,
    setSeedPhraseVisible,
  } = useSeedPhrase();

  // Refs
  const seedConfirmedRef = useRef(false);
  const amountInputRef = useRef(null);

  // Onboarding hook
  const {
    resetOnboarding,
  } = useOnboarding({
    currentAccount,
    setIsAuthenticated,
    setSettingUpPin,
    setSeedConfirmed,
    showToast,
  });

  // Settings hook
  const {
    notificationsEnabled,
    showZeroAssets,
    handleLogout,
    handleDeleteWallet,
    handleChangePin,
    handleFaceIdToggle,
    handleNotificationsToggle,
    handleShowZeroAssetsToggle,
    showLogoutModal,
    showDeleteModal,
    showFaceIdModal,
    showNotificationsModal,
    confirmLogout,
    cancelLogout,
    confirmDeleteWallet,
    cancelDeleteWallet,
    confirmFaceIdToggle,
    cancelFaceIdToggle,
    confirmNotificationsToggle,
    cancelNotificationsToggle,
  } = useSettings({
    biometricEnabled,
    setBiometricEnabled,
    resetAuth,
    resetWallet,
    startPinChange,
    walletExistsRef: walletExists,
    setIsAuthenticated,
    showToast,
  });

  // Account switcher hook
  const {
    showAccountPicker,
    setShowAccountPicker,
    newAccountIndex,
    setNewAccountIndex,
    switchingAccount,
    switchAccount,
  } = useAccountSwitcher({ switchAccountContext });

  // App lifecycle hook
  const { resetInactivityTimer } = useAppLifecycle({
    isAuthenticated,
    walletExists,
    seedConfirmedRef,
    isBiometricSupported,
    biometricEnabled,
    onLock: () => setIsAuthenticated(false),
    onAuthenticateUser: () => authenticateUser(),
  });

  // Wallet initialization
  const { isLoading } = useWalletInitialization({
    loadWallet,
    loadBiometricPreference,
    setSeedConfirmed,
    setIsAuthenticated,
    walletExistsRef: walletExists,
  });

  // Keep seedConfirmedRef in sync
  React.useEffect(() => {
    seedConfirmedRef.current = seedConfirmed;
  }, [seedConfirmed]);

  // Reset wallet and state
  const resetWalletAndState = async () => {
    await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
    await SecureStore.deleteItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    resetOnboarding();
    setSeedConfirmed(false);
  };

  // PIN setup completion wrapper
  const handlePinSetupCompleteWrapper = () => {
    handlePinSetupComplete();
  };

  // PIN change completion wrapper
  const handlePinChangeCompleteWrapper = () => {
    handlePinChangeComplete();
  };

  // PIN change cancel
  const handleCancelPinChange = async () => {
    setSettingUpPin(false);
    setChangingPin(false);
    // Set flag to return to settings after canceling
    await SecureStore.setItemAsync('returnToSettingsAfterPinChange', 'true');
    // Authenticate the user so they can access the app
    setIsAuthenticated(true);
  };

  // Lock screen authenticated (missing from auth hook - need to define)
  const handleLockScreenAuthenticated = () => {
    setIsAuthenticated(true);
  };

  // Lock screen authenticated wrapper
  const handleLockScreenAuthenticatedWrapper = async () => {
    // Check if user was trying to change PIN
    if (changingPin) {
      // User authenticated to change PIN, proceed to PIN setup
      setSettingUpPin(true);
      setIsAuthenticated(true);
      return;
    }

    handleLockScreenAuthenticated();

    // Check if user was trying to enable Face ID
    const pendingFaceId = await SecureStore.getItemAsync('pendingFaceIdEnable');
    const returnToSettingsFlag = await SecureStore.getItemAsync('returnToSettingsAfterAuth');
    console.log('After auth - pendingFaceId:', pendingFaceId, 'returnToSettingsAfterAuth:', returnToSettingsFlag);

    if (pendingFaceId === 'true') {
      await SecureStore.deleteItemAsync('pendingFaceIdEnable');
      setBiometricEnabled(true);
      await SecureStore.setItemAsync('biometricEnabled', 'true');
      showToast('Face ID enabled', 'success');
      console.log('Face ID enabled, returnToSettingsAfterAuth flag should still be:', returnToSettingsFlag);
      return;
    }

    // Check if user was trying to enable notifications
    const pendingNotifications = await SecureStore.getItemAsync('pendingNotificationsEnable');
    if (pendingNotifications === 'true') {
      await SecureStore.deleteItemAsync('pendingNotificationsEnable');
      await SecureStore.setItemAsync('notificationsEnabled', 'true');
      showToast('Notifications enabled', 'success');
      return;
    }

    // Check if user was trying to delete wallet
    const pendingWalletDelete = await SecureStore.getItemAsync('pendingWalletDelete');
    if (pendingWalletDelete === 'true') {
      await SecureStore.deleteItemAsync('pendingWalletDelete');
      // Trigger wallet deletion
      try {
        const AuthService = require('../services/authService');
        const success = await AuthService.deleteWalletData();
        if (success) {
          resetWallet();
          if (walletExists && walletExists.current !== undefined) {
            walletExists.current = false;
          }
          resetAuth();
          showToast('Wallet deleted successfully', 'success');
        } else {
          showToast('Failed to delete wallet', 'error');
        }
      } catch (error) {
        showToast('Failed to delete wallet', 'error');
      }
      return;
    }

    // Check if user was trying to view seed phrase
    if (requestingSeedPhrase) {
      await loadSeedPhrase();
    }
  };

  // Settings handlers for WalletPage
  const settingsHandlers = {
    notificationsEnabled: notificationsEnabled || false,
    showZeroAssets: showZeroAssets || false,
    handleLogout,
    handleDeleteWallet,
    handleViewSeedPhrase: requestViewSeedPhrase, // Use SeedPhraseContext function
    handleChangePin,
    handleFaceIdToggle,
    handleNotificationsToggle,
    handleShowZeroAssetsToggle,
  };

  // Show loading splash
  if (isLoading || showBackgroundSplash) {
    return <SplashScreen />;
  }

  // Main navigation
  return (
    <>
      <RootNavigator
        isAuthenticated={isAuthenticated}
        wallet={wallet}
        seedConfirmed={seedConfirmed}
        settingUpPin={settingUpPin}
        showPinEntry={showPinEntry}
        setSeedConfirmed={setSeedConfirmed}
        showToast={showToast}
        fetchBalance={fetchBalance}
        resetWalletAndState={resetWalletAndState}
        handlePinSetupCompleteWrapper={handlePinSetupCompleteWrapper}
        handlePinChangeCompleteWrapper={handlePinChangeCompleteWrapper}
        handleCancelPinChange={handleCancelPinChange}
        handleLockScreenAuthenticatedWrapper={handleLockScreenAuthenticatedWrapper}
        resetInactivityTimer={resetInactivityTimer}
        handleOpenVault={openVault}
        vaultCredentials={vaultCredentials}
        autoCreateVaultTrigger={autoCreateVaultTrigger}
        amountInputRef={amountInputRef}
        setShowAccountPicker={setShowAccountPicker}
        settingsHandlers={settingsHandlers}
        biometricEnabled={biometricEnabled}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        keyboardHeight={keyboardHeight}
        styles={styles}
      />

      {/* Seed Phrase Viewing Screen Overlay */}
      {viewingSeedPhrase && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: COLORS.DARK_BG,
            zIndex: 1000,
            transform: [{ translateX: seedPhraseTranslateX }]
          }}
        >
          <MutinynetBanner panHandlers={seedPhrasePanResponderRef.current.panHandlers} />
          <View style={[styles.container, { paddingTop: 0, flex: 1 }]}>
            <View style={styles.walletInfo}>
              <Text style={styles.seedPhraseWarning}>
                ⚠️ Keep these words safe and private! Never share them with anyone.
              </Text>

              <View style={styles.seedGrid}>
                {seedPhraseWords.map((word, index) => (
                  <View key={index} style={styles.seedBox}>
                    <Text style={styles.seedNumber}>{index + 1}</Text>
                    <Text style={styles.seedWord}>
                      {seedPhraseVisible ? word : '••••••'}
                    </Text>
                  </View>
                ))}
              </View>

              {!seedPhraseVisible && (
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => setSeedPhraseVisible(true)}
                >
                  <Text style={styles.buttonText}>Show Recovery Phrase</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, seedPhraseVisible && styles.secondaryButton]}
                onPress={closeSeedPhrase}
              >
                <Text style={styles.buttonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        visible={showLogoutModal}
        title="Lock Wallet"
        message="Are you sure you want to lock your wallet? You'll need to enter your PIN to access it again."
        confirmText="Lock"
        confirmStyle="primary"
        iconName="logout"
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
        styles={styles}
      />

      <ConfirmationModal
        visible={showDeleteModal}
        title="Delete Wallet"
        message="Are you sure you want to delete your wallet? This action cannot be undone. Make sure you have backed up your recovery phrase."
        confirmText="Delete"
        confirmStyle="destructive"
        iconName="delete_wallet"
        onConfirm={confirmDeleteWallet}
        onCancel={cancelDeleteWallet}
        styles={styles}
      />

      <ConfirmationModal
        visible={showFaceIdModal}
        title={biometricEnabled ? "Disable Face ID" : "Enable Face ID"}
        message={biometricEnabled ? "Are you sure you want to disable Face ID authentication?" : "Enable Face ID for quick and secure authentication?"}
        confirmText={biometricEnabled ? "Disable" : "Enable"}
        confirmStyle="primary"
        iconName="face_id"
        onConfirm={confirmFaceIdToggle}
        onCancel={cancelFaceIdToggle}
        styles={styles}
      />

      <ConfirmationModal
        visible={showNotificationsModal}
        title={notificationsEnabled ? "Disable Notifications" : "Enable Notifications"}
        message={notificationsEnabled ? "Are you sure you want to disable transaction notifications?" : "Enable notifications for transaction confirmations?"}
        confirmText={notificationsEnabled ? "Disable" : "Enable"}
        confirmStyle="primary"
        iconName="notifications"
        onConfirm={confirmNotificationsToggle}
        onCancel={cancelNotificationsToggle}
        styles={styles}
      />

      {/* Account Switcher Modal */}
      <AccountSwitcherModal
        visible={showAccountPicker}
        accountIndex={newAccountIndex}
        switchingAccount={switchingAccount}
        onClose={() => setShowAccountPicker(false)}
        onAccountIndexChange={setNewAccountIndex}
        onSwitch={switchAccount}
        styles={styles}
      />
    </>
  );
}
