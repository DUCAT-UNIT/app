/**
 * AppNavigator - Main navigation controller
 * Contains all routing logic and screen orchestration
 */

import React, { useRef, useState, useEffect, useCallback, MutableRefObject } from 'react';
import * as SecureStore from 'expo-secure-store';

// Navigation
import RootNavigator from './RootNavigator';

// Components
import AccountSwitcherModal from '../components/AccountSwitcherModal';
import AppModals from '../components/AppModals';
import SeedPhraseOverlay from '../components/SeedPhraseOverlay';
import SplashScreen from '../screens/SplashScreen';
import AirdropSuccessModal from '../components/AirdropSuccessModal';
import Snackbar from '../components/Snackbar';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useBalance, useTransactionHistory as useTransactionHistoryContext } from '../contexts/WalletDataContext';
import { useAirdrop } from '../contexts/AirdropContext';
import { SendFlowProvider } from '../contexts/SendFlowContext';
import { TransactionBuildProvider } from '../contexts/TransactionBuildContext';
import { TransactionExecutionProvider } from '../contexts/TransactionExecutionContext';
import { VaultProvider, useVault } from '../contexts/VaultContext';
import { SeedPhraseProvider, useSeedPhrase } from '../contexts/SeedPhraseContext';
import { useOnboardingFlow } from '../contexts/AuthContext';
import { AirdropProvider } from '../contexts/AirdropContext';
import {
  NavigationHandlersProvider,
  useNavigationHandlers,
} from '../contexts/NavigationHandlersContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { WalletAddresses } from '../contexts/WalletContext';
import type { SnackbarParams } from '../contexts/NotificationContext';

// Hooks
import { useWalletInitialization } from '../hooks/useWalletInitialization';
import { useNotifications as useNotificationsHook } from '../hooks/useNotifications';
import { useTransactionPolling } from '../hooks/useTransactionPolling';

// Styles
import styles from '../styles';

// Type definitions for component props
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

interface ProvidersWrapperProps {
  wallet: WalletAddresses | null;
  currentAccount: number;
  notificationsEnabled: boolean;
  startPolling: AnyFunction;
  sendTransactionConfirmedNotification: AnyFunction;
  fetchBalance: AnyFunction;
  fetchTransactionHistory: AnyFunction;
  setIsAuthenticated: (value: boolean) => void;
  loadWallet: () => Promise<{ exists: boolean; addresses?: WalletAddresses }>;
  loadBiometricPreference: () => Promise<void>;
  isBiometricSupported: boolean;
  walletExists: MutableRefObject<boolean>;
}

interface AppNavigatorContentProps {
  loadWallet: () => Promise<{ exists: boolean; addresses?: WalletAddresses }>;
  loadBiometricPreference: () => Promise<void>;
  _isBiometricSupported?: boolean;
}

export default function AppNavigator(): React.JSX.Element {
  // Get wallet and auth contexts (available from App.js providers)
  const {
    wallet,
    currentAccount,
    loadWallet,
  } = useWallet();
  const { fetchBalance } = useBalance();
  const historyContext = useTransactionHistoryContext();

  // Safely extract fetchTransactionHistory with fallback
  const fetchTransactionHistory = useCallback(() => {
    if (historyContext?.fetchTransactionHistory) {
      historyContext.fetchTransactionHistory();
    }
  }, [historyContext]);

  const {
    isBiometricSupported,
    setIsAuthenticated,
    loadBiometricPreference,
  } = useAuth();

  // Hooks (removed useBackgroundSplash - now handled in SplashScreen component)
  const { sendTransactionConfirmedNotification } = useNotificationsHook();
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

  // Wrap with remaining providers (UIProvider and AuthProvider already provided by App.js)
  return (
    <ProvidersWrapper
      wallet={wallet}
      currentAccount={currentAccount}
      notificationsEnabled={notificationsEnabled}
      startPolling={startPolling}
      sendTransactionConfirmedNotification={sendTransactionConfirmedNotification}
      fetchBalance={fetchBalance}
      fetchTransactionHistory={fetchTransactionHistory}
      setIsAuthenticated={setIsAuthenticated}
      loadWallet={loadWallet}
      loadBiometricPreference={loadBiometricPreference}
      isBiometricSupported={isBiometricSupported}
      walletExists={walletExists}
    />
  );
}

// Wrapper to access contexts and set up remaining providers
function ProvidersWrapper({
  wallet,
  currentAccount,
  notificationsEnabled,
  startPolling,
  sendTransactionConfirmedNotification,
  fetchBalance,
  fetchTransactionHistory,
  setIsAuthenticated,
  loadWallet,
  loadBiometricPreference,
  isBiometricSupported,
  walletExists,
}: ProvidersWrapperProps): React.JSX.Element {
  const { seedConfirmed } = useOnboardingFlow();
  const { showToast, showSnackbar } = useNotifications();

  return (
    <AirdropProvider seedConfirmed={seedConfirmed}>
      <SendFlowProvider>
        <TransactionBuildProvider
          wallet={wallet}
          currentAccount={currentAccount}
          showToast={showToast as (message: string, type?: string) => void}
        >
          <TransactionExecutionProvider
            currentAccount={currentAccount}
            showSnackbar={showSnackbar}
            startTransactionPolling={startPolling}
            sendTransactionConfirmedNotification={sendTransactionConfirmedNotification}
            notificationsEnabled={notificationsEnabled}
            fetchBalance={fetchBalance}
            fetchTransactionHistory={fetchTransactionHistory}
          >
            <VaultProvider currentAccount={currentAccount}>
              <SeedPhraseProvider showToast={showToast as (message: string, type?: string) => void} setIsAuthenticated={setIsAuthenticated}>
                <NavigationHandlersProvider walletExists={walletExists}>
                  <AppNavigatorContent
                    loadWallet={loadWallet}
                    loadBiometricPreference={loadBiometricPreference}
                    _isBiometricSupported={isBiometricSupported}
                  />
                </NavigationHandlersProvider>
              </SeedPhraseProvider>
            </VaultProvider>
          </TransactionExecutionProvider>
        </TransactionBuildProvider>
      </SendFlowProvider>
    </AirdropProvider>
  );
}

// Separate component with access to all contexts via hooks
function AppNavigatorContent({
  loadWallet,
  loadBiometricPreference,
  _isBiometricSupported,
}: AppNavigatorContentProps): React.JSX.Element | null {
  // Auth contexts
  const { setIsAuthenticated } = useAuth();
  const { wallet } = useWallet();

  // Navigation handlers from context
  const {
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
  } = useNavigationHandlers();

  // Onboarding context
  const { setSeedConfirmed } = useOnboardingFlow();

  // Vault context - activeTab not used in this component
  useVault();

  // Seed phrase context
  const {
    viewingSeedPhrase,
    seedPhraseWords,
    seedPhraseVisible,
    seedPhraseTranslateX,
    seedPhrasePanResponderRef,
    closeSeedPhrase,
    setSeedPhraseVisible,
  } = useSeedPhrase();

  // Airdrop context
  const { showAirdropModal, setShowAirdropModal, airdropTxId } = useAirdrop();

  // Notifications context
  const { snackbar, dismissSnackbar } = useNotifications();

  // Wallet initialization
  const { isLoading } = useWalletInitialization({
    loadWallet,
    loadBiometricPreference,
    setSeedConfirmed,
    setIsAuthenticated,
    walletExistsRef: { current: !!wallet },
  });

  // Show loading splash (initial load only)
  if (isLoading) {
    return <SplashScreen />;
  }

  // Main navigation
  return (
    <>
      <RootNavigator />

      {/* Background splash overlay - shows on top when app is backgrounded */}
      <SplashScreen />

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
        notificationsEnabled={settingsHandlers.notificationsEnabled}
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

      {/* Global Snackbar - rendered at app level for all screens */}
      {snackbar && (
        <Snackbar
          visible={true}
          message={snackbar.message || snackbar.description || ''}
        />
      )}
    </>
  );
}
