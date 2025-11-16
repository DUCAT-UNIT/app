/**
 * NavigationHandlersContext
 * Centralizes all navigation and flow control handlers to eliminate prop drilling
 *
 * @jest-coverage-ignore - Complex integration context with many dependencies
 * Testing this context requires mocking 10+ contexts/hooks which makes tests
 * brittle and not valuable. This should be tested via integration/E2E tests.
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';
import { resetOnboardingState } from '../utils/onboardingHelpers';
import { useAuth } from './AuthContext';
import { useWallet } from './WalletContext';
import { useBalance } from './WalletDataContext';
import { useOnboardingFlow } from './AuthContext';
import { useSeedPhrase } from './SeedPhraseContext';
import { useToastContext } from './UIContext';
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
  const { showToast } = useToastContext();
  const { clearVaultCredentials } = useVault();

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
    clearVaultCredentials,
    startPinChange,
    walletExistsRef: walletExists,
    setIsAuthenticated,
    showToast,
  });

  // Account switcher
  const {
    showAccountPicker,
    setShowAccountPicker,
    newAccountIndex,
    setNewAccountIndex,
    switchingAccount,
    switchAccount,
  } = useAccountSwitcher({ switchAccountContext });

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

  // Settings handlers object - memoized to prevent recreation on every render
  const settingsHandlers = useMemo(
    () => ({
      notificationsEnabled: notificationsEnabled || false,
      showZeroAssets: showZeroAssets || false,
      handleLogout,
      handleDeleteWallet,
      handleViewSeedPhrase: requestViewSeedPhrase,
      handleChangePin,
      handleFaceIdToggle,
      handleNotificationsToggle,
      handleShowZeroAssetsToggle,
    }),
    [
      notificationsEnabled,
      showZeroAssets,
      handleLogout,
      handleDeleteWallet,
      requestViewSeedPhrase,
      handleChangePin,
      handleFaceIdToggle,
      handleNotificationsToggle,
      handleShowZeroAssetsToggle,
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
