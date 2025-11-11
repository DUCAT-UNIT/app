/**
 * WalletPage - Main wallet interface after authentication
 * Contains wallet screen, vault, settings, and transaction flows
 */

import React from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Components
import WalletScreen from '../components/WalletScreen';
import SendScreen from '../components/SendScreen';
import ReceiveScreen from '../components/ReceiveScreen';
import TransactionHistoryScreen from '../components/TransactionHistoryScreen';
import VaultScreen from '../components/VaultScreen';
import SettingsScreen from '../components/SettingsScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import BottomNavigationBar from '../components/BottomNavigationBar';
import ToastContainer from '../components/ToastContainer';
import TransactionToast from '../components/TransactionToast';
import SplashScreen from '../components/SplashScreen';

// Contexts
import { useWallet } from '../contexts/WalletContext';
import { useBalance } from '../contexts/BalanceContext';
import { useSendFlow } from '../contexts/SendFlowContext';
import { useTransactionBuild } from '../contexts/TransactionBuildContext';
import { useTransactionExecution } from '../contexts/TransactionExecutionContext';
import { useVault } from '../contexts/VaultContext';
import { useOnboardingFlow } from '../contexts/OnboardingFlowContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useToastContext } from '../contexts/ToastContext';

// Hooks
import { } from '../hooks/useSettings';
import { useKeyboard } from '../hooks/useKeyboard';
import { useSettingsNavigation } from '../hooks/useSettingsNavigation';
import { useSheetNavigation } from '../hooks/useSheetNavigation';

// Utils
import { COLORS } from '../utils/colors';

export default function WalletPage() {
  // Consume contexts instead of props
  const { activeTab, setActiveTab, vaultCredentials, autoCreateVaultTrigger, openVault } =
    useVault();
  const { resetInactivityTimer, amountInputRef } = useOnboardingFlow();
  const { keyboardHeight } = useKeyboard();
  const { settingsHandlers, biometricEnabled, setShowAccountPicker } = useNavigationHandlers();
  const styles = require('../styles').default;
  // Wallet context
  const { wallet } = useWallet();
  const { segwitBalance, runesBalance, btcPrice } = useBalance();

  // Transaction contexts
  const {
    intentStep,
    sendAssetType,
    sendAmount,
    sendRecipient,
    sendAddressType,
    setIntentStep,
    setSendAssetType,
    setSendAmount,
    setSendRecipient,
  } = useSendFlow();

  const { sendIntent, setSendIntent, createSendIntent } = useTransactionBuild();

  const { broadcastedTxid, toastDismissed, setBroadcastedTxid, setToastDismissed, signIntent } =
    useTransactionExecution();

  // Toast context
  const { toasts, showToast } = useToastContext();

  // Navigation hooks
  const {
    showSettings,
    hasCheckedInitialFlags,
    settingsTranslateX,
    settingsOpacity,
    settingsPanResponderRef,
    openSettings,
    closeSettings,
  } = useSettingsNavigation();

  const { showReceiveSheet, setShowReceiveSheet, showTxHistory, setShowTxHistory } =
    useSheetNavigation();

  // Show splash screen until we've checked flags to prevent flicker
  if (!hasCheckedInitialFlags) {
    return <SplashScreen />;
  }

  return (
    <>
      <View style={localStyles.container} onTouchStart={resetInactivityTimer}>
        {/* Mutinynet Banner - Shows on all screens */}
        <MutinynetBanner />

        {activeTab === 'wallet' ? (
          <>
            <WalletScreen
              styles={styles}
              onSendPress={() => setIntentStep('selecting_asset')}
              onReceivePress={() => setShowReceiveSheet(true)}
              onHistoryPress={() => setShowTxHistory(true)}
              onSettingsPress={openSettings}
              onCreateVaultPress={() => openVault(true)}
              sendAddressType={sendAddressType}
              switchingAccount={false}
              showZeroAssets={settingsHandlers.showZeroAssets}
            />
            <BottomNavigationBar
              activeTab={activeTab}
              onVaultPress={openVault}
              onWalletPress={() => setActiveTab('wallet')}
            />
          </>
        ) : null}

        {/* Send Transaction Bottom Sheets */}
        <SendScreen
          intentStep={intentStep}
          sendAssetType={sendAssetType}
          sendAmount={sendAmount}
          sendRecipient={sendRecipient}
          sendIntent={sendIntent}
          broadcastedTxid={broadcastedTxid}
          keyboardHeight={keyboardHeight}
          amountInputRef={amountInputRef}
          btcBalance={segwitBalance}
          unitBalance={runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0}
          btcPrice={btcPrice}
          wallet={wallet}
          setIntentStep={setIntentStep}
          setSendAssetType={setSendAssetType}
          setSendAmount={setSendAmount}
          setSendRecipient={setSendRecipient}
          setSendIntent={setSendIntent}
          setBroadcastedTxid={setBroadcastedTxid}
          createSendIntent={createSendIntent}
          signIntent={signIntent}
        />

        {/* Receive Bottom Sheet */}
        <ReceiveScreen
          styles={styles}
          showReceiveSheet={showReceiveSheet}
          onClose={() => setShowReceiveSheet(false)}
          segwitAddress={wallet?.segwitAddress || ''}
          taprootAddress={wallet?.taprootAddress || ''}
          showToast={showToast}
        />

        {/* Transaction History Bottom Sheet */}
        <TransactionHistoryScreen
          styles={styles}
          showHistorySheet={showTxHistory}
          onClose={() => setShowTxHistory(false)}
          segwitAddress={wallet?.segwitAddress || ''}
          taprootAddress={wallet?.taprootAddress || ''}
          vaultPubkey={wallet?.taprootPubkey || ''}
        />

        <StatusBar style="light" />

        {/* Toast Notification */}
        <ToastContainer toasts={toasts} />

        {/* Transaction Toast */}
        <TransactionToast
          visible={
            ['pending', 'confirmed'].includes(intentStep) &&
            (intentStep === 'confirmed' || !toastDismissed)
          }
          status={intentStep}
          message={
            intentStep === 'pending'
              ? 'Transaction pending...'
              : intentStep === 'confirmed'
                ? 'Transaction mined!'
                : ''
          }
          txid={broadcastedTxid}
          assetType={sendAssetType === 'unit' ? 'UNIT' : 'BTC'}
          onClose={() => setToastDismissed(true)}
        />
      </View>

      {/* Vault Screen Full Screen Overlay - Always rendered to preload in background */}
      <View
        style={[
          localStyles.vaultOverlay,
          activeTab === 'vault' ? localStyles.vaultActive : localStyles.vaultHidden,
        ]}
      >
        <MutinynetBanner />
        <View style={localStyles.vaultContent}>
          <VaultScreen
            visible={activeTab === 'vault'}
            walletCredentials={vaultCredentials}
            autoCreateVaultTrigger={autoCreateVaultTrigger}
          />
        </View>
        <BottomNavigationBar
          activeTab={activeTab}
          onVaultPress={openVault}
          onWalletPress={() => setActiveTab('wallet')}
        />
      </View>

      {/* Settings Screen Overlay */}
      <Animated.View
        style={[
          localStyles.settingsOverlay,
          {
            opacity: settingsOpacity,
            transform: [{ translateX: settingsTranslateX }],
          },
        ]}
        pointerEvents={!showSettings ? 'none' : 'auto'}
        {...settingsPanResponderRef.current.panHandlers}
      >
        <MutinynetBanner />
        <SettingsScreen
          onClose={closeSettings}
          onViewSeedPhrase={settingsHandlers.handleViewSeedPhrase}
          onChangePin={settingsHandlers.handleChangePin}
          onSwitchAccount={() => {
            // Don't close settings - modal should overlay settings
            setShowAccountPicker(true);
          }}
          onLockWallet={settingsHandlers.handleLogout}
          onDeleteWallet={settingsHandlers.handleDeleteWallet}
          onFaceIdToggle={settingsHandlers.handleFaceIdToggle}
          onNotificationsToggle={settingsHandlers.handleNotificationsToggle}
          onShowZeroAssetsToggle={settingsHandlers.handleShowZeroAssetsToggle}
          faceIdEnabled={biometricEnabled}
          notificationsEnabled={settingsHandlers.notificationsEnabled}
          showZeroAssets={settingsHandlers.showZeroAssets}
        />
      </Animated.View>
    </>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  vaultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    flexDirection: 'column',
  },
  vaultActive: {
    zIndex: 500,
    opacity: 1,
    pointerEvents: 'auto',
  },
  vaultHidden: {
    zIndex: -1,
    opacity: 0,
    pointerEvents: 'none',
  },
  vaultContent: {
    flex: 1,
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1000,
  },
});
