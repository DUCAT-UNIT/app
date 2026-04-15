/**
 * AppNavigatorContent - Main navigation content with modals and overlays
 * Renders the root navigator and global UI elements
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
import { getThresholdSheetOnSelect,useEcashThresholdSheetStore } from '../stores/ecashThresholdSheetStore';

// Contexts
import { useAirdrop } from '../contexts/AirdropContext';
import { useAuth,useOnboardingFlow } from '../contexts/AuthContext';
import { useAccountSwitcherContext,useSettingsHandlers } from '../contexts/NavigationHandlersContext';
import { useSeedPhrase } from '../contexts/SeedPhraseContext';
import type { WalletAddresses } from '../contexts/WalletContext';
import { useWallet } from '../contexts/WalletContext';
import { useNotifications } from '../stores/notificationStore';

// Hooks
import { useWalletInitialization } from '../hooks/useWalletInitialization';

// Styles
import styles from '../styles';
import { COLORS } from '../theme';

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
  const walletExistsRef = useRef(!!wallet);

  useEffect(() => {
    walletExistsRef.current = !!wallet;
  }, [wallet]);

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
    switchingAccount,
    switchAccount,
  } = useAccountSwitcherContext();

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
  const { isLoading, initializationError, retryInitialization } = useWalletInitialization({
    loadWallet,
    loadBiometricPreference,
    setSeedConfirmed,
    setIsAuthenticated,
    walletExistsRef,
  });

  // Check for pending turbo transaction on startup
  // Turbo resume is handled centrally in RootNavigator; avoid duplicate resume here.

  // Show loading splash (initial load only)
  if (isLoading) {
    return <SplashScreen mode="launch" />;
  }

  if (initializationError) {
    return (
      <View style={localStyles.errorContainer}>
        <Text style={localStyles.errorTitle}>Unable To Access Wallet</Text>
        <Text style={localStyles.errorMessage}>
          The app could not read wallet data securely. Retry before creating or importing a new wallet.
        </Text>
        <Text style={localStyles.errorDetails}>{initializationError}</Text>
        <TouchableOpacity style={localStyles.retryButton} onPress={() => { retryInitialization(); }}>
          <Text style={localStyles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

      {/* Ecash Threshold Sheet - rendered at app level to appear above all navigation */}
      <EcashThresholdSheetGlobal />

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

const localStyles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 28,
    fontFamily: 'CabinetGrotesk-Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  errorDetails: {
    color: COLORS.DANGER_RED,
    fontSize: 13,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  retryButtonText: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Bold',
  },
});
