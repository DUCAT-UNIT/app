/**
 * AppNavigatorContent - Main navigation content with modals and overlays
 * Renders the root navigator and global UI elements
 */

import React from 'react';

// Navigation
import RootNavigator from './RootNavigator';

// Components
import AccountSwitcherModal from '../components/AccountSwitcherModal';
import AirdropSuccessModal from '../components/AirdropSuccessModal';
import AppModals from '../components/AppModals';
import SeedPhraseOverlay from '../components/SeedPhraseOverlay';
import Snackbar from '../components/Snackbar';
import EcashThresholdSheet from '../components/settings/EcashThresholdSheet';
import SplashScreen from '../screens/SplashScreen';

// Stores
import {
  getThresholdSheetOnSelect,
  useEcashThresholdSheetStore,
} from '../stores/ecashThresholdSheetStore';

// Contexts
import { useAirdrop } from '../contexts/AirdropContext';
import { useAuthSession } from '../contexts/AuthContext';
import {
  useAccountSwitcherContext,
  useSettingsHandlers,
} from '../contexts/NavigationHandlersContext';
import { useSeedPhrase } from '../contexts/SeedPhraseContext';
import { useNotifications } from '../stores/notificationStore';

// Styles
import styles from '../styles';

/**
 * Global wrapper for EcashThresholdSheet that uses the global store
 * This allows the sheet to be shown from anywhere in the app
 */
function EcashThresholdSheetGlobal() {
  const visible = useEcashThresholdSheetStore((state) => state.visible);
  const hide = useEcashThresholdSheetStore((state) => state.hide);
  const { settingsHandlers } = useSettingsHandlers();

  const handleSelectThreshold = (value: number) => {
    const onSelect = getThresholdSheetOnSelect();
    if (onSelect) {
      // Use the hook's handleThresholdSelect which handles conversion modal logic
      onSelect(value);
    } else {
      // Fallback: directly update threshold
      settingsHandlers.handleEcashThresholdChange(value);
      hide();
    }
  };

  return (
    <EcashThresholdSheet
      visible={visible}
      onClose={hide}
      onSelectThreshold={handleSelectThreshold}
      currentThreshold={settingsHandlers.ecashThreshold || 10000}
    />
  );
}

/**
 * Main content component that renders navigation and global overlays
 * Has access to all context values via hooks
 */
export default function AppNavigatorContent(): React.JSX.Element | null {
  // Auth contexts
  useAuthSession();

  // Settings handlers from context
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
  } = useSettingsHandlers();

  // Account switcher from context
  const {
    showAccountPicker,
    setShowAccountPicker,
    newAccountIndex,
    setNewAccountIndex,
    newWalletProfile,
    setNewWalletProfile,
    switchingAccount,
    switchAccount,
  } = useAccountSwitcherContext();

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

  // Main navigation
  return (
    <>
      <RootNavigator />

      {/* Background splash overlay - shows on top when app is backgrounded */}
      <SplashScreen mode="background" />

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
        walletProfile={newWalletProfile}
        switchingAccount={switchingAccount}
        onClose={() => setShowAccountPicker(false)}
        onAccountIndexChange={setNewAccountIndex}
        onWalletProfileChange={setNewWalletProfile}
        onSwitch={switchAccount}
        styles={styles}
      />

      {/* Airdrop Success Modal */}
      <AirdropSuccessModal
        visible={showAirdropModal}
        onClose={() => setShowAirdropModal(false)}
        txId={airdropTxId}
      />

      {/* Ecash Threshold Sheet - rendered at app level to appear above all navigation */}
      <EcashThresholdSheetGlobal />

      {/* Global Snackbar - rendered at app level for all screens */}
      {snackbar && (
        <Snackbar key={snackbar.key || 'snackbar'} params={snackbar} onClose={dismissSnackbar} />
      )}
    </>
  );
}
