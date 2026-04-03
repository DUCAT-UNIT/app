/**
 * NavigationHandlersContext
 * Centralizes all navigation and flow control handlers to eliminate prop drilling
 *
 * Split into 3 focused sub-contexts for granular subscriptions:
 * - SettingsHandlersContext: settings state, handlers, and confirmation modals
 * - AccountSwitcherContext: account picker UI state
 * - AuthFlowContext: PIN/auth, passkey migration, and biometric setup handlers
 *
 * @jest-coverage-ignore - Complex integration context with many dependencies
 * Testing this context requires mocking 10+ contexts/hooks which makes tests
 * brittle and not valuable. This should be tested via integration/E2E tests.
 */

import React, { createContext, useContext, useCallback, useEffect, useMemo, useState, ReactNode, MutableRefObject } from 'react';
import { Keyboard } from 'react-native';
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
import { setBiometricEnabled as persistBiometricEnabled } from '../services/biometricService';
import { isPasskeyUpgradeRecommended } from '../services/passkey';
import { setBoolean, SettingKeys } from '../services/settingsService';
import { logger } from '../utils/logger';

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
  currentPin?: string | null;
  mode: 'import' | 'upgrade';
}

// --- Sub-context value interfaces ---

export interface SettingsContextValue {
  settingsHandlers: SettingsHandlers;
  biometricEnabled: boolean;
  passkeyUpgradeRecommended: boolean;
  triggerPasskeyUpgrade: () => void;
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
}

export interface AccountSwitcherContextValue {
  showAccountPicker: boolean;
  setShowAccountPicker: React.Dispatch<React.SetStateAction<boolean>>;
  newAccountIndex: string;
  setNewAccountIndex: React.Dispatch<React.SetStateAction<string>>;
  switchingAccount: boolean;
  switchAccount: (index: number) => Promise<void>;
}

export interface AuthFlowContextValue {
  handlePinSetupCompleteWrapper: () => Promise<void>;
  handlePinChangeCompleteWrapper: () => Promise<void>;
  handleCancelPinChange: () => Promise<void>;
  handleLockScreenAuthenticatedWrapper: () => Promise<void>;
  resetWalletAndState: () => Promise<void>;
  showPasskeyMigrationModal: boolean;
  passkeyMigrationData: PasskeyMigrationData | null;
  showPasskeyMigrationPrompt: (currentPin: string) => void;
  showPasskeyUpgradePrompt: () => void;
  hidePasskeyMigrationPrompt: () => void;
  handlePasskeyUpgradeComplete: () => void;
  showBiometricSetupModal: boolean;
  showBiometricSetupPrompt: () => void;
  hideBiometricSetupPrompt: () => void;
  handleBiometricSetupEnable: () => Promise<void>;
  handleBiometricSetupSkip: () => Promise<void>;
}

// --- Sub-contexts ---

const SettingsHandlersContext = createContext<SettingsContextValue | undefined>(undefined);
const AccountSwitcherCtx = createContext<AccountSwitcherContextValue | undefined>(undefined);
const AuthFlowCtx = createContext<AuthFlowContextValue | undefined>(undefined);

// --- Provider ---

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
    passkeyEnabled,
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
  const { setSeedConfirmed, resetWalletAndState: onboardingResetWalletAndState } = useOnboardingFlow();
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

  // Modal state (declared early so handleLockApp can reference them)
  const [showPasskeyMigrationModal, setShowPasskeyMigrationModal] = useState(false);
  const [passkeyMigrationData, setPasskeyMigrationData] = useState<PasskeyMigrationData | null>(null);
  const [showBiometricSetupModal, setShowBiometricSetupModal] = useState(false);
  const [passkeyUpgradeRecommended, setPasskeyUpgradeRecommended] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!passkeyEnabled) {
      setPasskeyUpgradeRecommended(false);
      return () => {
        cancelled = true;
      };
    }

    const loadPasskeyUpgradeRecommendation = async () => {
      try {
        const recommended = await isPasskeyUpgradeRecommended();
        if (!cancelled) {
          setPasskeyUpgradeRecommended(recommended);
        }
      } catch (error: unknown) {
        logger.warn('[NavigationHandlersContext] Failed to check passkey upgrade recommendation', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) {
          setPasskeyUpgradeRecommended(false);
        }
      }
    };

    loadPasskeyUpgradeRecommendation();

    return () => {
      cancelled = true;
    };
  }, [passkeyEnabled]);

  // Lock app handler - dismisses modals, keyboard, and locks the app
  const handleLockApp = useCallback(() => {
    // Dismiss keyboard
    Keyboard.dismiss();

    // Dismiss all open modals
    setShowPasskeyMigrationModal(false);
    setPasskeyMigrationData(null);
    setShowBiometricSetupModal(false);

    // Lock the app
    setIsAuthenticated(false);
  }, [setIsAuthenticated]);

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
    onLock: handleLockApp,
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
    // First complete the PIN change (sets settingUpPin=false, changingPin=false)
    await handlePinChangeComplete();
    // Ensure user is authenticated after PIN change
    setIsAuthenticated(true);
  }, [handlePinChangeComplete, setIsAuthenticated]);

  // PIN change cancel
  const handleCancelPinChange = useCallback(async () => {
    setSettingUpPin(false);
    setChangingPin(false);
    await setBoolean(SettingKeys.RETURN_TO_SETTINGS_AFTER_PIN_CHANGE, true);
    setIsAuthenticated(true);
  }, [setSettingUpPin, setChangingPin, setIsAuthenticated]);

  // Passkey migration handlers
  const showPasskeyMigrationPrompt = useCallback((currentPin: string) => {
    setPasskeyMigrationData({ currentPin, mode: 'import' });
    setShowPasskeyMigrationModal(true);
  }, []);

  const showPasskeyUpgradePrompt = useCallback(() => {
    setPasskeyMigrationData({ mode: 'upgrade' });
    setShowPasskeyMigrationModal(true);
  }, []);

  const hidePasskeyMigrationPrompt = useCallback(() => {
    setShowPasskeyMigrationModal(false);
    setPasskeyMigrationData(null);
  }, []);

  const handlePasskeyUpgradeComplete = useCallback(() => {
    setPasskeyUpgradeRecommended(false);
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
      await persistBiometricEnabled(true);
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
    // Hide modal immediately for instant feedback
    setShowBiometricSetupModal(false);
    // Update auth context state
    setBiometricEnabled(false);
    await persistBiometricEnabled(false);
  }, [setBiometricEnabled]);

  // Settings handlers object - memoized to prevent recreation on every render
  const settingsHandlersObj = useMemo(
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

  // --- Sub-context values ---

  const settingsValue = useMemo(
    (): SettingsContextValue => ({
      settingsHandlers: settingsHandlersObj,
      biometricEnabled,
      passkeyUpgradeRecommended,
      triggerPasskeyUpgrade: showPasskeyUpgradePrompt,
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
    }),
    [
      settingsHandlersObj,
      biometricEnabled,
      passkeyUpgradeRecommended,
      showPasskeyUpgradePrompt,
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
    ]
  );

  const accountSwitcherValue = useMemo(
    (): AccountSwitcherContextValue => ({
      showAccountPicker,
      setShowAccountPicker,
      newAccountIndex,
      setNewAccountIndex,
      switchingAccount,
      switchAccount,
    }),
    [
      showAccountPicker,
      setShowAccountPicker,
      newAccountIndex,
      setNewAccountIndex,
      switchingAccount,
      switchAccount,
    ]
  );

  const authFlowValue = useMemo(
    (): AuthFlowContextValue => ({
      handlePinSetupCompleteWrapper,
      handlePinChangeCompleteWrapper,
      handleCancelPinChange,
      handleLockScreenAuthenticatedWrapper: handlePostAuth,
      resetWalletAndState: onboardingResetWalletAndState,
      showPasskeyMigrationModal,
      passkeyMigrationData,
      showPasskeyMigrationPrompt,
      showPasskeyUpgradePrompt,
      hidePasskeyMigrationPrompt,
      handlePasskeyUpgradeComplete,
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
      onboardingResetWalletAndState,
      showPasskeyMigrationModal,
      passkeyMigrationData,
      showPasskeyMigrationPrompt,
      showPasskeyUpgradePrompt,
      hidePasskeyMigrationPrompt,
      handlePasskeyUpgradeComplete,
      showBiometricSetupModal,
      showBiometricSetupPrompt,
      hideBiometricSetupPrompt,
      handleBiometricSetupEnable,
      handleBiometricSetupSkip,
    ]
  );

  return (
    <SettingsHandlersContext.Provider value={settingsValue}>
      <AccountSwitcherCtx.Provider value={accountSwitcherValue}>
        <AuthFlowCtx.Provider value={authFlowValue}>
          {children}
        </AuthFlowCtx.Provider>
      </AccountSwitcherCtx.Provider>
    </SettingsHandlersContext.Provider>
  );
};

// --- Focused consumer hooks ---

export const useSettingsHandlers = (): SettingsContextValue => {
  const context = useContext(SettingsHandlersContext);
  if (!context) {
    throw new Error('useSettingsHandlers must be used within NavigationHandlersProvider');
  }
  return context;
};

export const useAccountSwitcherContext = (): AccountSwitcherContextValue => {
  const context = useContext(AccountSwitcherCtx);
  if (!context) {
    throw new Error('useAccountSwitcherContext must be used within NavigationHandlersProvider');
  }
  return context;
};

export const useAuthFlowHandlers = (): AuthFlowContextValue => {
  const context = useContext(AuthFlowCtx);
  if (!context) {
    throw new Error('useAuthFlowHandlers must be used within NavigationHandlersProvider');
  }
  return context;
};
