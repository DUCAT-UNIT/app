/**
 * AppNavigator - Main navigation controller
 * Contains all routing logic and screen orchestration
 */

import React, { useRef } from 'react';
import * as SecureStore from 'expo-secure-store';

// Navigation
import RootNavigator from './RootNavigator';

// Components
import AccountSwitcherModal from '../components/AccountSwitcherModal';
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
        <SeedPhraseProvider showToast={showToast}>
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
    requestingSeedPhrase,
    setRequestingSeedPhrase,
    requestViewSeedPhrase,
    loadSeedPhrase,
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
    privacyMode,
    notificationsEnabled,
    showZeroAssets,
    handleLogout,
    handleDeleteWallet,
    handleChangePin,
    handlePrivacyModeToggle,
    handleFaceIdToggle,
    handleNotificationsToggle,
    handleShowZeroAssetsToggle,
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
    privacyMode,
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
  const handleCancelPinChange = () => {
    setSettingUpPin(false);
    setChangingPin(false);
  };

  // Lock screen authenticated (missing from auth hook - need to define)
  const handleLockScreenAuthenticated = () => {
    setIsAuthenticated(true);
  };

  // Lock screen authenticated wrapper
  const handleLockScreenAuthenticatedWrapper = async () => {
    handleLockScreenAuthenticated();

    // Check if user was trying to enable Face ID
    const pendingFaceId = await SecureStore.getItemAsync('pendingFaceIdEnable');
    if (pendingFaceId === 'true') {
      await SecureStore.deleteItemAsync('pendingFaceIdEnable');
      setBiometricEnabled(true);
      await SecureStore.setItemAsync('biometricEnabled', 'true');
      showToast('Face ID enabled', 'success');
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

    // Check if user was trying to view seed phrase
    if (requestingSeedPhrase) {
      await loadSeedPhrase();
    }
  };

  // Settings handlers for WalletPage
  const settingsHandlers = {
    privacyMode: privacyMode || false,
    notificationsEnabled: notificationsEnabled || false,
    showZeroAssets: showZeroAssets || false,
    handleLogout,
    handleDeleteWallet,
    handleViewSeedPhrase: requestViewSeedPhrase, // Use SeedPhraseContext function
    handleChangePin,
    handlePrivacyModeToggle,
    handleFaceIdToggle,
    handleNotificationsToggle,
    handleShowZeroAssetsToggle,
  };

  // Show loading splash
  if (isLoading || showBackgroundSplash) {
    return <SplashScreen />;
  }

  // Show account picker modal (overlays navigation)
  if (showAccountPicker) {
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

  // Main navigation
  return (
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
  );
}
