/**
 * NavigationHandlersContext
 * Centralizes all navigation and flow control handlers to eliminate prop drilling
 *
 * @jest-coverage-ignore - Complex integration context with many dependencies
 * Testing this context requires mocking 10+ contexts/hooks which makes tests
 * brittle and not valuable. This should be tested via integration/E2E tests.
 */

import React, { createContext, useContext, useCallback, useMemo, useState, ReactNode, MutableRefObject } from 'react';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';
import { resetOnboardingState } from '../utils/onboardingHelpers';
import { useAuth } from './AuthContext';
import { useWallet } from './WalletContext';
import { useBalance, useTransactionHistory, useVaultData } from './WalletDataContext';
import { useOnboardingFlow } from './AuthContext';
import { useSeedPhrase } from './SeedPhraseContext';
import { useNotifications } from '../stores/notificationStore';
import { useCashuOperations } from './CashuContext';
import { useSettings } from '../hooks/useSettings';
import { useAccountSwitcher } from '../hooks/useAccountSwitcher';
import { usePostAuthHandler } from '../hooks/usePostAuthHandler';
import { notify } from '../utils/notify';

interface SettingsHandlers {
  notificationsEnabled: boolean;
  showZeroAssets: boolean;
  advancedMode: boolean;
  ecashThreshold: number;
  handleLogout: () => void;
  handleDeleteWallet: () => void;
  handleViewSeedPhrase: () => void;
  handleChangePin: () => void;
  handleFaceIdToggle: () => void;
  handleNotificationsToggle: () => void;
  handleShowZeroAssetsToggle: () => void;
  handleAdvancedModeToggle: () => void;
  handleClearCashuCache: () => void;
  handleRecoverLockedChange: () => void;
  handleClearLockedTokens: () => void;
  handleEcashThresholdChange: (value: number) => void;
}

interface PasskeyMigrationData {
  mnemonic: string;
  pin: string;
}

interface NavigationHandlersContextValue {
  handlePinSetupCompleteWrapper: () => Promise<void>;
  handlePinChangeCompleteWrapper: () => Promise<void>;
  handleCancelPinChange: () => Promise<void>;
  handleLockScreenAuthenticatedWrapper: () => Promise<void>;
  resetWalletAndState: () => Promise<void>;
  settingsHandlers: SettingsHandlers;
  biometricEnabled: boolean;
  showLogoutModal: boolean;
  showDeleteModal: boolean;
  showFaceIdModal: boolean;
  showNotificationsModal: boolean;
  confirmLogout: () => void;
  cancelLogout: () => void;
  confirmDeleteWallet: () => void;
  cancelDeleteWallet: () => void;
  confirmFaceIdToggle: () => void;
  cancelFaceIdToggle: () => void;
  confirmNotificationsToggle: () => void;
  cancelNotificationsToggle: () => void;
  showAccountPicker: boolean;
  setShowAccountPicker: React.Dispatch<React.SetStateAction<boolean>>;
  newAccountIndex: string;
  setNewAccountIndex: React.Dispatch<React.SetStateAction<string>>;
  switchingAccount: boolean;
  switchAccount: (index: number) => Promise<void>;
  showPasskeyMigrationModal: boolean;
  passkeyMigrationData: PasskeyMigrationData | null;
  showPasskeyMigrationPrompt: (mnemonic: string, pin: string) => void;
  hidePasskeyMigrationPrompt: () => void;
  showBiometricSetupModal: boolean;
  showBiometricSetupPrompt: () => void;
  hideBiometricSetupPrompt: () => void;
  handleBiometricSetupEnable: () => Promise<void>;
  handleBiometricSetupSkip: () => Promise<void>;
}

const NavigationHandlersContext = createContext<NavigationHandlersContextValue | undefined>(undefined);

interface NavigationHandlersProviderProps {
  children: ReactNode;
  walletExists: MutableRefObject<boolean>;
}

export const NavigationHandlersProvider: React.FC<NavigationHandlersProviderProps> = ({ children, walletExists }) => {
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
  const { fetchBalance, resetBalances } = useBalance();
  const { fetchTransactionHistory, resetTransactionHistory } = useTransactionHistory();
  const { fetchVault, resetVaultData } = useVaultData();
  const { resetAndRefresh: resetAndRefreshCashu } = useCashuOperations();
  const { setSeedConfirmed } = useOnboardingFlow();
  const { requestingSeedPhrase, loadSeedPhrase, requestViewSeedPhrase } = useSeedPhrase();
  const { showSnackbar } = useNotifications();

  // Post-authentication handler
  const { handlePostAuth } = usePostAuthHandler({
    changingPin,
    setSettingUpPin,
    setIsAuthenticated,
    setBiometricEnabled,
    resetWallet,
    resetAuth,
    walletExists: walletExists,
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
    startPinChange,
    walletExistsRef: walletExists,
    setIsAuthenticated,
  });

  // Account switcher - coordinates all data reset/fetch during account switch
  const {
    showAccountPicker,
    setShowAccountPicker,
    newAccountIndex,
    setNewAccountIndex,
    switchingAccount,
    switchAccount,
  } = useAccountSwitcher({
    switchAccountContext,
    // Balance functions
    resetBalances,
    fetchBalance,
    // Transaction history functions
    resetTransactionHistory,
    fetchTransactionHistory,
    // Vault functions
    resetVaultData,
    fetchVault,
    // Cashu functions (resetAndRefresh clears pending mints and fetches fresh balance)
    resetAndRefreshCashu,
    // Toast notification (shown after data loads)
    showToast: (message: string, type: 'success' | 'error') => showSnackbar({ title: message, type }),
  });

  // Passkey migration modal state (for showing after wallet import)
  const [showPasskeyMigrationModal, setShowPasskeyMigrationModal] = useState(false);
  const [passkeyMigrationData, setPasskeyMigrationData] = useState<PasskeyMigrationData | null>(null);

  // Biometric setup modal state (for showing after passkey wallet creation)
  const [showBiometricSetupModal, setShowBiometricSetupModal] = useState(false);

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
  const showPasskeyMigrationPrompt = useCallback((mnemonic: string, pin: string) => {
    setPasskeyMigrationData({ mnemonic, pin });
    setShowPasskeyMigrationModal(true);
  }, []);

  const hidePasskeyMigrationPrompt = useCallback(() => {
    setShowPasskeyMigrationModal(false);
    setPasskeyMigrationData(null);
  }, []);

  // Biometric setup handlers (for passkey wallet creation)
  const showBiometricSetupPrompt = useCallback(() => {
    setShowBiometricSetupModal(true);
  }, []);

  const hideBiometricSetupPrompt = useCallback(() => {
    setShowBiometricSetupModal(false);
  }, []);

  const handleBiometricSetupEnable = useCallback(async () => {
    try {
      // Save the preference to SecureStore
      await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'true');
      // Update auth context state
      setBiometricEnabled(true);

      // Trigger biometric authentication to confirm
      const LocalAuthentication = await import('expo-local-authentication');
      await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
        fallbackLabel: 'Use PIN instead',
      });

      // Hide modal
      setShowBiometricSetupModal(false);
    } catch {
      // Hide modal even if biometric auth fails
      setShowBiometricSetupModal(false);
    }
  }, [setBiometricEnabled]);

  const handleBiometricSetupSkip = useCallback(async () => {
    // Save the preference to SecureStore
    await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'false');
    // Update auth context state
    setBiometricEnabled(false);
    // Hide modal
    setShowBiometricSetupModal(false);
  }, [setBiometricEnabled]);

  // Settings handlers object - memoized to prevent recreation on every render
  const settingsHandlers = useMemo(
    (): SettingsHandlers => ({
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
    (): NavigationHandlersContextValue => ({
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

      // Biometric setup
      showBiometricSetupModal,
      showBiometricSetupPrompt,
      hideBiometricSetupPrompt,
      handleBiometricSetupEnable,
      handleBiometricSetupSkip,
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
      showBiometricSetupModal,
      showBiometricSetupPrompt,
      hideBiometricSetupPrompt,
      handleBiometricSetupEnable,
      handleBiometricSetupSkip,
    ]
  );

  return (
    <NavigationHandlersContext.Provider value={value}>
      {children}
    </NavigationHandlersContext.Provider>
  );
};

export const useNavigationHandlers = (): NavigationHandlersContextValue => {
  const context = useContext(NavigationHandlersContext);
  if (!context) {
    throw new Error('useNavigationHandlers must be used within NavigationHandlersProvider');
  }
  return context;
};
