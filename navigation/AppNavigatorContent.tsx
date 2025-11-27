/**
 * AppNavigatorContent - Main navigation content with modals and overlays
 * Renders the root navigator and global UI elements
 */

import React from 'react';

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
import { useAuth, useOnboardingFlow } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useAirdrop } from '../contexts/AirdropContext';
import { useSeedPhrase } from '../contexts/SeedPhraseContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { WalletAddresses } from '../contexts/WalletContext';

// Hooks
import { useWalletInitialization } from '../hooks/useWalletInitialization';

// Styles
import styles from '../styles';

export interface AppNavigatorContentProps {
  loadWallet: () => Promise<{ exists: boolean; addresses?: WalletAddresses }>;
  loadBiometricPreference: () => Promise<void>;
}

/**
 * Main content component that renders navigation and global overlays
 * Has access to all context values via hooks
 */
export default function AppNavigatorContent({
  loadWallet,
  loadBiometricPreference,
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
          key={snackbar.key || 'snackbar'}
          params={snackbar}
          onClose={dismissSnackbar}
        />
      )}
    </>
  );
}
