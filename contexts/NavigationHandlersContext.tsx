/**
 * NavigationHandlersContext
 * Centralizes navigation and flow control handlers to eliminate prop drilling.
 *
 * Split into 3 focused sub-contexts for granular subscriptions:
 * - SettingsHandlersContext: settings state, handlers, and confirmation modals
 * - AccountSwitcherContext: account picker UI state
 * - AuthFlowContext: PIN/auth, passkey migration, and biometric setup handlers
 *
 * Passkey/biometric modal logic is extracted to hooks/usePasskeyBiometricFlow.ts
 */

import React, { createContext, useContext, useCallback, useMemo, ReactNode, MutableRefObject } from 'react';
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
import { usePasskeyBiometricFlow } from '../hooks/usePasskeyBiometricFlow';
import { setBoolean, SettingKeys } from '../services/settingsService';

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
  const {
    setIsAuthenticated, setBiometricEnabled, biometricEnabled, passkeyEnabled,
    setSettingUpPin, setChangingPin, changingPin, resetAuth,
    startPinChange, handlePinSetupComplete, handlePinChangeComplete,
  } = useAuth();

  const { resetWallet, switchAccount: switchAccountContext } = useWallet();
  const { fetchBalance, resetBalances } = useBalance();
  const { fetchTransactionHistory, resetTransactionHistory } = useTransactionHistory();
  const { fetchVault, resetVaultData } = useVaultData();
  const { resetAndRefresh: resetAndRefreshCashu } = useCashuOperations();
  const { setSeedConfirmed, resetWalletAndState: onboardingResetWalletAndState } = useOnboardingFlow();
  const { requestingSeedPhrase, loadSeedPhrase, requestViewSeedPhrase } = useSeedPhrase();
  const { showSnackbar } = useNotifications();

  // --- Passkey & biometric flow (extracted) ---
  const {
    showPasskeyMigrationModal, passkeyMigrationData, passkeyUpgradeRecommended,
    showPasskeyMigrationPrompt, showPasskeyUpgradePrompt,
    hidePasskeyMigrationPrompt, handlePasskeyUpgradeComplete,
    showBiometricSetupModal, showBiometricSetupPrompt, hideBiometricSetupPrompt,
    handleBiometricSetupEnable, handleBiometricSetupSkip,
    dismissAllModals,
  } = usePasskeyBiometricFlow({ passkeyEnabled, setBiometricEnabled, setIsAuthenticated });

  // Lock app handler
  const handleLockApp = useCallback(() => {
    dismissAllModals();
    setIsAuthenticated(false);
  }, [dismissAllModals, setIsAuthenticated]);

  // --- Post-auth handler ---
  const { handlePostAuth } = usePostAuthHandler({
    changingPin, setSettingUpPin, setIsAuthenticated, setBiometricEnabled,
    resetWallet, resetAuth, walletExists, requestingSeedPhrase, loadSeedPhrase,
  });

  // --- Settings ---
  const {
    notificationsEnabled, showZeroAssets, advancedMode, ecashThreshold,
    handleLogout, handleDeleteWallet, handleChangePin, handleFaceIdToggle,
    handleNotificationsToggle, handleShowZeroAssetsToggle, handleAdvancedModeToggle,
    handleClearCashuCache, handleRecoverLockedChange, handleClearLockedTokens,
    handleEcashThresholdChange,
    showLogoutModal, showDeleteModal, showFaceIdModal, showNotificationsModal,
    confirmLogout, cancelLogout, confirmDeleteWallet, cancelDeleteWallet,
    confirmFaceIdToggle, cancelFaceIdToggle, confirmNotificationsToggle, cancelNotificationsToggle,
  } = useSettings({
    biometricEnabled, setBiometricEnabled, resetAuth, resetWallet,
    startPinChange, walletExistsRef: walletExists, setIsAuthenticated, onLock: handleLockApp,
  });

  // --- Account switcher ---
  const {
    showAccountPicker, setShowAccountPicker, newAccountIndex, setNewAccountIndex,
    switchingAccount, switchAccount,
  } = useAccountSwitcher({
    switchAccountContext, resetBalances, fetchBalance,
    resetTransactionHistory, fetchTransactionHistory,
    resetVaultData, fetchVault, resetAndRefreshCashu,
    showToast: (message: string, type: 'success' | 'error') => showSnackbar({ title: message, type }),
  });

  // --- PIN flow wrappers ---
  const handlePinSetupCompleteWrapper = useCallback(async () => {
    await handlePinSetupComplete();
    setSeedConfirmed(true);
    await fetchBalance();
  }, [handlePinSetupComplete, fetchBalance, setSeedConfirmed]);

  const handlePinChangeCompleteWrapper = useCallback(async () => {
    await handlePinChangeComplete();
    setIsAuthenticated(true);
  }, [handlePinChangeComplete, setIsAuthenticated]);

  const handleCancelPinChange = useCallback(async () => {
    setSettingUpPin(false);
    setChangingPin(false);
    await setBoolean(SettingKeys.RETURN_TO_SETTINGS_AFTER_PIN_CHANGE, true);
    setIsAuthenticated(true);
  }, [setSettingUpPin, setChangingPin, setIsAuthenticated]);

  // --- Settings handlers object ---
  const settingsHandlersObj = useMemo(
    (): SettingsHandlers => ({
      notificationsEnabled: notificationsEnabled || false,
      showZeroAssets: showZeroAssets || false,
      advancedMode: advancedMode || false,
      ecashThreshold: ecashThreshold || 100,
      handleLogout, handleDeleteWallet, handleViewSeedPhrase: requestViewSeedPhrase,
      handleChangePin, handleFaceIdToggle, handleNotificationsToggle,
      handleShowZeroAssetsToggle, handleAdvancedModeToggle, handleClearCashuCache,
      handleRecoverLockedChange, handleClearLockedTokens, handleEcashThresholdChange,
    }),
    [notificationsEnabled, showZeroAssets, advancedMode, ecashThreshold,
     handleLogout, handleDeleteWallet, requestViewSeedPhrase, handleChangePin,
     handleFaceIdToggle, handleNotificationsToggle, handleShowZeroAssetsToggle,
     handleAdvancedModeToggle, handleClearCashuCache, handleRecoverLockedChange,
     handleClearLockedTokens, handleEcashThresholdChange]
  );

  // --- Context values ---
  const settingsValue = useMemo(
    (): SettingsContextValue => ({
      settingsHandlers: settingsHandlersObj, biometricEnabled, passkeyUpgradeRecommended,
      triggerPasskeyUpgrade: showPasskeyUpgradePrompt,
      showLogoutModal, showDeleteModal, showFaceIdModal, showNotificationsModal,
      confirmLogout, cancelLogout, confirmDeleteWallet, cancelDeleteWallet,
      confirmFaceIdToggle, cancelFaceIdToggle, confirmNotificationsToggle, cancelNotificationsToggle,
    }),
    [settingsHandlersObj, biometricEnabled, passkeyUpgradeRecommended, showPasskeyUpgradePrompt,
     showLogoutModal, showDeleteModal, showFaceIdModal, showNotificationsModal,
     confirmLogout, cancelLogout, confirmDeleteWallet, cancelDeleteWallet,
     confirmFaceIdToggle, cancelFaceIdToggle, confirmNotificationsToggle, cancelNotificationsToggle]
  );

  const accountSwitcherValue = useMemo(
    (): AccountSwitcherContextValue => ({
      showAccountPicker, setShowAccountPicker, newAccountIndex, setNewAccountIndex,
      switchingAccount, switchAccount,
    }),
    [showAccountPicker, setShowAccountPicker, newAccountIndex, setNewAccountIndex,
     switchingAccount, switchAccount]
  );

  const authFlowValue = useMemo(
    (): AuthFlowContextValue => ({
      handlePinSetupCompleteWrapper, handlePinChangeCompleteWrapper, handleCancelPinChange,
      handleLockScreenAuthenticatedWrapper: handlePostAuth,
      resetWalletAndState: onboardingResetWalletAndState,
      showPasskeyMigrationModal, passkeyMigrationData,
      showPasskeyMigrationPrompt, showPasskeyUpgradePrompt,
      hidePasskeyMigrationPrompt, handlePasskeyUpgradeComplete,
      showBiometricSetupModal, showBiometricSetupPrompt, hideBiometricSetupPrompt,
      handleBiometricSetupEnable, handleBiometricSetupSkip,
    }),
    [handlePinSetupCompleteWrapper, handlePinChangeCompleteWrapper, handleCancelPinChange,
     handlePostAuth, onboardingResetWalletAndState,
     showPasskeyMigrationModal, passkeyMigrationData,
     showPasskeyMigrationPrompt, showPasskeyUpgradePrompt,
     hidePasskeyMigrationPrompt, handlePasskeyUpgradeComplete,
     showBiometricSetupModal, showBiometricSetupPrompt, hideBiometricSetupPrompt,
     handleBiometricSetupEnable, handleBiometricSetupSkip]
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

// --- Consumer hooks ---

export const useSettingsHandlers = (): SettingsContextValue => {
  const context = useContext(SettingsHandlersContext);
  if (!context) throw new Error('useSettingsHandlers must be used within NavigationHandlersProvider');
  return context;
};

export const useAccountSwitcherContext = (): AccountSwitcherContextValue => {
  const context = useContext(AccountSwitcherCtx);
  if (!context) throw new Error('useAccountSwitcherContext must be used within NavigationHandlersProvider');
  return context;
};

export const useAuthFlowHandlers = (): AuthFlowContextValue => {
  const context = useContext(AuthFlowCtx);
  if (!context) throw new Error('useAuthFlowHandlers must be used within NavigationHandlersProvider');
  return context;
};
