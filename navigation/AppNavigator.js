/**
 * AppNavigator - Main navigation controller
 * Contains all routing logic and screen orchestration
 */

import React, { useRef, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

// Navigation
import RootNavigator from './RootNavigator';

// Components
import AccountSwitcherModal from '../components/AccountSwitcherModal';
import AppModals from '../components/AppModals';
import SeedPhraseOverlay from '../components/SeedPhraseOverlay';
import SplashScreen from '../components/SplashScreen';
import AirdropSuccessModal from '../components/AirdropSuccessModal';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useBalance } from '../contexts/BalanceContext';
import { useAirdrop } from '../contexts/AirdropContext';
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
import { usePostAuthHandler } from '../hooks/usePostAuthHandler';
import { useNotifications } from '../hooks/useNotifications';
import { useTransactionPolling } from '../hooks/useTransactionPolling';

// Utils
import { SECURE_KEYS } from '../utils/constants';
import styles from '../styles';

export default function AppNavigator({ seedConfirmed, setSeedConfirmed }) {
  // Get wallet and auth contexts (available from App.js providers)
  const { wallet, currentAccount, loadWallet, resetWallet, switchAccount: switchAccountContext } = useWallet();
  const { fetchBalance } = useBalance();
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
  const { sendTransactionConfirmedNotification } = useNotifications();
  const { startPolling } = useTransactionPolling();

  // Wallet exists ref (shared between components)
  const walletExists = useRef(false);

  // Load notificationsEnabled early so we can pass to TransactionProvider
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  useEffect(() => {
    const loadNotificationsPreference = async () => {
      const saved = await SecureStore.getItemAsync('notificationsEnabled');
      setNotificationsEnabled(saved === 'true');
    };
    loadNotificationsPreference();
  }, []);

  // Wrap with remaining providers
  return (
    <TransactionProvider
      wallet={wallet}
      currentAccount={currentAccount}
      showToast={showToast}
      startTransactionPolling={startPolling}
      sendTransactionConfirmedNotification={sendTransactionConfirmedNotification}
      notificationsEnabled={notificationsEnabled}
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
  const { showAirdropModal, setShowAirdropModal, airdropTxId } = useAirdrop();

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

  // Post-authentication handler
  const { handlePostAuth } = usePostAuthHandler({
    changingPin,
    setSettingUpPin,
    setIsAuthenticated,
    setBiometricEnabled,
    showToast,
    resetWallet,
    resetAuth,
    walletExists,
    requestingSeedPhrase,
    loadSeedPhrase,
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

  // PIN change cancel
  const handleCancelPinChange = async () => {
    setSettingUpPin(false);
    setChangingPin(false);
    // Set flag to return to settings after canceling
    await SecureStore.setItemAsync('returnToSettingsAfterPinChange', 'true');
    // Authenticate the user so they can access the app
    setIsAuthenticated(true);
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
        handlePinSetupCompleteWrapper={handlePinSetupComplete}
        handlePinChangeCompleteWrapper={handlePinChangeComplete}
        handleCancelPinChange={handleCancelPinChange}
        handleLockScreenAuthenticatedWrapper={handlePostAuth}
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
      <SeedPhraseOverlay
        visible={viewingSeedPhrase}
        seedPhraseWords={seedPhraseWords}
        seedPhraseVisible={seedPhraseVisible}
        seedPhraseTranslateX={seedPhraseTranslateX}
        seedPhrasePanResponderRef={seedPhrasePanResponderRef}
        setSeedPhraseVisible={setSeedPhraseVisible}
        closeSeedPhrase={closeSeedPhrase}
        styles={styles}
      />

      {/* Confirmation Modals */}
      <AppModals
        showLogoutModal={showLogoutModal}
        confirmLogout={confirmLogout}
        cancelLogout={cancelLogout}
        showDeleteModal={showDeleteModal}
        confirmDeleteWallet={confirmDeleteWallet}
        cancelDeleteWallet={cancelDeleteWallet}
        showFaceIdModal={showFaceIdModal}
        biometricEnabled={biometricEnabled}
        confirmFaceIdToggle={confirmFaceIdToggle}
        cancelFaceIdToggle={cancelFaceIdToggle}
        showNotificationsModal={showNotificationsModal}
        notificationsEnabled={notificationsEnabled}
        confirmNotificationsToggle={confirmNotificationsToggle}
        cancelNotificationsToggle={cancelNotificationsToggle}
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

      {/* Airdrop Success Modal */}
      <AirdropSuccessModal
        visible={showAirdropModal}
        onClose={() => setShowAirdropModal(false)}
        txId={airdropTxId}
      />
    </>
  );
}
