/**
 * NavigationHandlersContext
 * Centralizes all navigation and flow control handlers to eliminate prop drilling
 *
 * @jest-coverage-ignore - Complex integration context with many dependencies
 * Testing this context requires mocking 10+ contexts/hooks which makes tests
 * brittle and not valuable. This should be tested via integration/E2E tests.
 */

import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';
import { resetOnboardingState } from '../utils/onboardingHelpers';
import { useAuth } from './AuthContext';
import { useWallet } from './WalletContext';
import { useBalance } from './WalletDataContext';
import { useOnboardingFlow } from './AuthContext';
import { useSeedPhrase } from './SeedPhraseContext';
import { useNotifications } from './NotificationContext';
import { useVault } from './VaultContext';
import { useSettings } from '../hooks/useSettings';
import { useAccountSwitcher } from '../hooks/useAccountSwitcher';
import { usePostAuthHandler } from '../hooks/usePostAuthHandler';

const NavigationHandlersContext = createContext();

export const NavigationHandlersProvider = ({ children, walletExists }) => {
  // Get required contexts and hooks
  const {
    setIsAuthenticated,
    setBiometricEnabled,
    biometricEnabled,
    setSettingUpPin,
    setChangingPin,
    changingPin,
    resetAuth,
    startPinChange,
    handlePinSetupComplete,
    handlePinChangeComplete,
  } = useAuth();

  const { resetWallet, switchAccount: switchAccountContext } = useWallet();
  const { fetchBalance } = useBalance();
  const { setSeedConfirmed } = useOnboardingFlow();
  const { requestingSeedPhrase, loadSeedPhrase, requestViewSeedPhrase } = useSeedPhrase();
  const { showToast, showSnackbar } = useNotifications();
  const { clearVaultCredentials, setActiveTab } = useVault();

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

  // Settings handlers
  const {
    notificationsEnabled,
    showZeroAssets,
    advancedMode,
    ecashThreshold,
    handleLogout,
    handleDeleteWallet,
    handleChangePin,
    handleFaceIdToggle,
    handleNotificationsToggle,
    handleShowZeroAssetsToggle,
    handleAdvancedModeToggle,
    handleClearCashuCache,
    handleRecoverLockedChange,
    handleClearLockedTokens,
    handleEcashThresholdChange,
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
    clearVaultCredentials,
    startPinChange,
    walletExistsRef: walletExists,
    setIsAuthenticated,
    showToast,
    showSnackbar,
  });

  // Account switcher
  const {
    showAccountPicker,
    setShowAccountPicker,
    newAccountIndex,
    setNewAccountIndex,
    switchingAccount,
    switchAccount,
  } = useAccountSwitcher({
    switchAccountContext,
    fetchBalance,
    onAccountSwitched: () => setActiveTab('wallet'),
  });

  // Passkey migration modal state (for showing after wallet import)
  const [showPasskeyMigrationModal, setShowPasskeyMigrationModal] = useState(false);
  const [passkeyMigrationData, setPasskeyMigrationData] = useState(null);

  // Reset wallet and state
  const resetWalletAndState = useCallback(async () => {
    await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
    await SecureStore.deleteItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    await resetOnboardingState();
    resetWallet();
    setSeedConfirmed(false);
  }, [resetWallet, setSeedConfirmed]);

  // PIN setup complete wrapper
  const handlePinSetupCompleteWrapper = useCallback(async () => {
    await handlePinSetupComplete();
    // Set seedConfirmed to true after PIN setup completes
    // This ensures the user is taken to the main wallet screen
    setSeedConfirmed(true);
    await fetchBalance();
  }, [handlePinSetupComplete, fetchBalance, setSeedConfirmed]);

  // PIN change complete wrapper
  const handlePinChangeCompleteWrapper = useCallback(async () => {
    await handlePinChangeComplete();
  }, [handlePinChangeComplete]);

  // PIN change cancel
  const handleCancelPinChange = useCallback(async () => {
    setSettingUpPin(false);
    setChangingPin(false);
    await SecureStore.setItemAsync('returnToSettingsAfterPinChange', 'true');
    setIsAuthenticated(true);
  }, [setSettingUpPin, setChangingPin, setIsAuthenticated]);

  // Passkey migration handlers
  const showPasskeyMigrationPrompt = useCallback((mnemonic, pin) => {
    setPasskeyMigrationData({ mnemonic, pin });
    setShowPasskeyMigrationModal(true);
  }, []);

  const hidePasskeyMigrationPrompt = useCallback(() => {
    setShowPasskeyMigrationModal(false);
    setPasskeyMigrationData(null);
  }, []);

  // Settings handlers object - memoized to prevent recreation on every render
  const settingsHandlers = useMemo(
    () => ({
      notificationsEnabled: notificationsEnabled || false,
      showZeroAssets: showZeroAssets || false,
      advancedMode: advancedMode || false,
      ecashThreshold: ecashThreshold || 100,
      handleLogout,
      handleDeleteWallet,
      handleViewSeedPhrase: requestViewSeedPhrase,
      handleChangePin,
      handleFaceIdToggle,
      handleNotificationsToggle,
      handleShowZeroAssetsToggle,
      handleAdvancedModeToggle,
      handleClearCashuCache,
      handleRecoverLockedChange,
      handleClearLockedTokens,
      handleEcashThresholdChange,
    }),
    [
      notificationsEnabled,
      showZeroAssets,
      advancedMode,
      ecashThreshold,
      handleLogout,
      handleDeleteWallet,
      requestViewSeedPhrase,
      handleChangePin,
      handleFaceIdToggle,
      handleNotificationsToggle,
      handleShowZeroAssetsToggle,
      handleAdvancedModeToggle,
      handleClearCashuCache,
      handleRecoverLockedChange,
      handleClearLockedTokens,
      handleEcashThresholdChange,
    ]
  );

  const value = useMemo(
    () => ({
      // Primary handlers
      handlePinSetupCompleteWrapper,
      handlePinChangeCompleteWrapper,
      handleCancelPinChange,
      handleLockScreenAuthenticatedWrapper: handlePostAuth,
      resetWalletAndState,

      // Settings
      settingsHandlers,
      biometricEnabled,

      // Settings modals
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

      // Account switcher
      showAccountPicker,
      setShowAccountPicker,
      newAccountIndex,
      setNewAccountIndex,
      switchingAccount,
      switchAccount,

      // Passkey migration
      showPasskeyMigrationModal,
      passkeyMigrationData,
      showPasskeyMigrationPrompt,
      hidePasskeyMigrationPrompt,
    }),
    [
      handlePinSetupCompleteWrapper,
      handlePinChangeCompleteWrapper,
      handleCancelPinChange,
      handlePostAuth,
      resetWalletAndState,
      settingsHandlers,
      biometricEnabled,
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
      showAccountPicker,
      setShowAccountPicker,
      newAccountIndex,
      setNewAccountIndex,
      switchingAccount,
      switchAccount,
      showPasskeyMigrationModal,
      passkeyMigrationData,
      showPasskeyMigrationPrompt,
      hidePasskeyMigrationPrompt,
    ]
  );

  return (
    <NavigationHandlersContext.Provider value={value}>
      {children}
    </NavigationHandlersContext.Provider>
  );
};

NavigationHandlersProvider.propTypes = {
  children: PropTypes.node.isRequired,
  walletExists: PropTypes.object.isRequired,
};

export const useNavigationHandlers = () => {
  const context = useContext(NavigationHandlersContext);
  if (!context) {
    throw new Error('useNavigationHandlers must be used within NavigationHandlersProvider');
  }
  return context;
};
