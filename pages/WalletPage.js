/**
 * WalletPage - Main wallet interface after authentication
 * Contains wallet screen, vault, settings, and transaction flows
 */

import React, { useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions, PanResponder, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Components
import WalletScreen from '../screens/wallet/WalletScreen';
import ReceiveScreen from '../screens/wallet/ReceiveScreen';
import TransactionHistoryScreen from '../screens/wallet/TransactionHistoryScreen';
import VaultScreen from '../screens/wallet/VaultScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import BottomNavigationBar from '../components/BottomNavigationBar';
import ToastContainer from '../components/ToastContainer';
import SplashScreen from '../screens/SplashScreen';
import EcashThresholdSheet from '../components/settings/EcashThresholdSheet';
import EcashConversionModal from '../components/settings/EcashConversionModal';
import LowEcashBalanceModal from '../components/ecash/LowEcashBalanceModal';
import QRScanner from '../components/scanner/QRScanner';

// Contexts
import { useWallet } from '../contexts/WalletContext';
import { useSendFlow } from '../contexts/SendFlowContext';
import { useTransactionExecution } from '../contexts/TransactionExecutionContext';
import { useVault } from '../contexts/VaultContext';
import { useOnboardingFlow } from '../contexts/AuthContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useNotifications } from "../contexts/NotificationContext";
import { useBalance } from '../contexts/WalletDataContext';
import { useCashu } from '../contexts/CashuContext';

// Hooks
import { useSettingsNavigation } from '../hooks/useSettingsNavigation';
import { useSheetNavigation } from '../hooks/useSheetNavigation';
import { useEcashBalanceCheck } from '../hooks/useEcashBalanceCheck';
import { useQRCodeHandler } from '../hooks/useQRCodeHandler';
import { useClaimNotifications } from '../hooks/useClaimNotifications';
import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
import { useEcashThresholdManager } from '../hooks/useEcashThresholdManager';
import { useVaultSwipeGesture } from '../hooks/useVaultSwipeGesture';

// Utils
import { COLORS } from '../theme';
import { logger } from '../utils/logger';

export default function WalletPage({ route }) {
  const navigation = useNavigation();

  // Consume contexts instead of props
  const { activeTab, setActiveTab, vaultCredentials, autoCreateVaultTrigger, openVault } =
    useVault();
  const { resetInactivityTimer } = useOnboardingFlow();
  const { settingsHandlers, biometricEnabled, setShowAccountPicker } = useNavigationHandlers();
  const { runesBalance } = useBalance();
  const { balance: cashuBalance, receive: receiveCashuToken } = useCashu();
  const styles = require('../styles').default;

  // Wallet context
  const walletContext = useWallet();
  const { wallet, switchAccount } = walletContext;

  // Debug: Log what we got from context
  React.useEffect(() => {
    logger.debug('[WalletPage] Wallet context loaded:', {
      hasWallet: !!wallet,
      hasSwitchAccount: !!switchAccount,
      switchAccountType: typeof switchAccount,
    });
  }, [wallet, switchAccount]);

  const { vaultData } = require('../contexts/WalletDataContext').useVaultData();

  // Transaction contexts
  const {
    intentStep,
    sendAssetType,
    sendAddressType,
  } = useSendFlow();

  const { broadcastedTxid } = useTransactionExecution();

  // Toast and Snackbar context
  const { toasts, showToast, snackbar, dismissSnackbar, showSnackbar } = useNotifications();

  // Calculate current UNIT balance for ecash balance check
  const currentUnitBalance = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;

  // Low ecash balance check on app start
  const {
    showLowBalanceModal,
    closeModal: closeLowBalanceModal,
    amountNeeded: lowBalanceAmountNeeded,
    currentBalance: lowBalanceCurrentBalance,
    defaultThreshold: lowBalanceDefaultThreshold,
  } = useEcashBalanceCheck(cashuBalance, settingsHandlers.ecashThreshold, currentUnitBalance);

  // Debug: Log snackbar state changes
  React.useEffect(() => {
    logger.debug('🎯 WalletPage snackbar state:', snackbar);
  }, [snackbar]);

  // Use transaction notifications hook
  useTransactionNotifications({
    intentStep,
    broadcastedTxid,
    sendAssetType,
    showSnackbar,
  });

  // Use claim notifications hook
  useClaimNotifications({
    route,
    showSnackbar,
    dismissSnackbar,
    switchAccount,
  });

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

  // QR Scanner state
  const [showQRScanner, setShowQRScanner] = useState(false);

  // QR Scanner handlers - extracted to useQRCodeHandler hook
  const handleQRScan = useQRCodeHandler({
    receiveCashuToken,
    showToast,
    showSnackbar,
    setShowQRScanner,
  });

  // Use ecash threshold manager hook
  const {
    showThresholdSheet,
    showConversionModal,
    conversionAmount,
    savedUnitBalance,
    pendingThreshold,
    setShowThresholdSheet,
    setShowConversionModal,
    handleEcashThresholdPress,
    handleThresholdSelect,
    handleConfirmConversion,
    handleLowBalanceTopUp,
  } = useEcashThresholdManager({
    cashuBalance,
    runesBalance,
    settingsHandlers,
    showToast,
    showSnackbar,
    showSettings,
    closeSettings,
    lowBalanceAmountNeeded,
    closeLowBalanceModal,
  });

  // Handle navigation param to open receive sheet
  React.useEffect(() => {
    if (route?.params?.openReceive) {
      setShowReceiveSheet(true);
      // Clear the param after opening
      navigation.setParams({ openReceive: false });
    }
  }, [route?.params?.openReceive, setShowReceiveSheet, navigation]);

  // Use vault swipe gesture hook
  const {
    vaultTranslateX,
    walletTranslateX,
    isSwiping,
    walletPanResponder,
    vaultPanResponder,
  } = useVaultSwipeGesture({
    activeTab,
    setActiveTab,
    openVault,
  });

  // Show splash screen until we've checked flags to prevent flicker
  if (!hasCheckedInitialFlags) {
    return <SplashScreen />;
  }

  return (
    <>
      <View style={localStyles.container} onTouchStart={resetInactivityTimer}>
        {/* Fixed Mutinynet Banner */}
        <MutinynetBanner />

        {/* Content area - slides without banner and navigation bar */}
        <View style={localStyles.contentArea}>
          {/* Animated Vault Content - Rendered first (below wallet) */}
          <Animated.View
            style={[
              localStyles.vaultContainer,
              {
                transform: [{ translateX: vaultTranslateX }],
              },
            ]}
            pointerEvents={activeTab === 'vault' || isSwiping ? 'auto' : 'none'}
          >
            <VaultScreen
              visible={activeTab === 'vault'}
              walletCredentials={vaultCredentials}
              autoCreateVaultTrigger={autoCreateVaultTrigger}
              vaultData={vaultData}
              showSnackbar={showSnackbar}
            />
            {/* Edge swipe detection area - only on the right edge */}
            {activeTab === 'vault' && (
              <View
                style={localStyles.rightEdgeSwipeArea}
                {...vaultPanResponder.panHandlers}
              />
            )}
          </Animated.View>

          {/* Animated Wallet Content - Rendered second (above vault) */}
          <Animated.View
            style={[
              localStyles.screenContainer,
              {
                transform: [{ translateX: walletTranslateX }],
              },
            ]}
            pointerEvents={activeTab === 'wallet' && !isSwiping ? 'auto' : 'none'}
            {...walletPanResponder.panHandlers}
          >
            <WalletScreen
              styles={styles}
              onSendPress={() => navigation.navigate('SendFlow', { screen: 'AssetSelector' })}
              onReceivePress={() => setShowReceiveSheet(true)}
              onHistoryPress={() => setShowTxHistory(true)}
              onQRScanPress={() => setShowQRScanner(true)}
              onSettingsPress={openSettings}
              onCreateVaultPress={() => openVault(true)}
              onVaultPress={openVault}
              onAssetPress={(assetType) => navigation.navigate('AssetDetail', { assetType, advancedMode: settingsHandlers.advancedMode })}
              sendAddressType={sendAddressType}
              switchingAccount={false}
              showZeroAssets={settingsHandlers.showZeroAssets}
            />
          </Animated.View>
        </View>

        {/* Fixed Bottom Navigation */}
        {/* <BottomNavigationBar
          activeTab={activeTab}
          onVaultPress={openVault}
          onWalletPress={() => setActiveTab('wallet')}
        /> */}

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
          advancedMode={settingsHandlers.advancedMode}
        />

        {/* QR Scanner Modal */}
        <QRScanner
          visible={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScan}
        />

        <StatusBar style="light" />

        {/* Toast Notification */}
        <ToastContainer toasts={toasts} />
      </View>

      {/* Settings Screen Overlay - only render when visible to prevent z-index conflicts */}
      {(showSettings || settingsOpacity._value > 0) && (
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
          onLockWallet={settingsHandlers.handleLogout}
          onViewPreferences={() => {
            navigation.navigate('Preferences', {
              onClose: () => navigation.goBack(),
              onShowZeroAssetsToggle: settingsHandlers.handleShowZeroAssetsToggle,
              onNotificationsToggle: settingsHandlers.handleNotificationsToggle,
              showZeroAssets: settingsHandlers.showZeroAssets,
              notificationsEnabled: settingsHandlers.notificationsEnabled,
            });
          }}
          onViewSecurity={() => {
            navigation.navigate('Security', {
              onClose: () => navigation.goBack(),
              onFaceIdToggle: settingsHandlers.handleFaceIdToggle,
              onChangePin: settingsHandlers.handleChangePin,
              onAutoLockToggle: () => {
                // TODO: Implement auto lock toggle
                logger.debug('Auto lock toggle pressed');
              },
              onViewSeedPhrase: settingsHandlers.handleViewSeedPhrase,
              onDeleteWallet: settingsHandlers.handleDeleteWallet,
              faceIdEnabled: biometricEnabled,
              autoLockEnabled: false,
            });
          }}
          onViewAdvanced={() => {
            navigation.navigate('Advanced', {
              onClose: () => navigation.goBack(),
              onSwitchAccount: () => {
                navigation.goBack();
                setShowAccountPicker(true);
              },
              onAdvancedModeToggle: settingsHandlers.handleAdvancedModeToggle,
              onEcashThresholdPress: handleEcashThresholdPress,
              advancedMode: settingsHandlers.advancedMode,
            });
          }}
          onViewCashuSettings={() => {
            navigation.navigate('CashuSettings', {
              onClose: () => navigation.goBack(),
              onClearCashuCache: settingsHandlers.handleClearCashuCache,
              onRecoverLockedChange: settingsHandlers.handleRecoverLockedChange,
              onClearLockedTokens: settingsHandlers.handleClearLockedTokens,
              onRecoverMint: () => {
                navigation.goBack();
                navigation.navigate('RecoverMint');
              },
              onRedeemToken: () => {
                navigation.goBack();
                navigation.navigate('CashuReceive');
              },
              onRemoveSpentProofs: async () => {
                try {
                  const { removeSpentProofs } = await import('../services/cashu/cashuWalletService');
                  const result = await removeSpentProofs();
                  Alert.alert(
                    'Spent Proofs Removed',
                    `Removed ${result.removed} spent proofs. Kept ${result.kept} valid proofs.`
                  );
                } catch (error) {
                  Alert.alert('Error', `Failed to remove spent proofs: ${error.message}`);
                }
              },
            });
          }}
          onViewAbout={() => {
            navigation.navigate('About', {
              onClose: () => navigation.goBack(),
            });
          }}
        />
      </Animated.View>
      )}

      {/* Ecash Threshold Selection Sheet */}
      <EcashThresholdSheet
        visible={showThresholdSheet}
        onClose={() => setShowThresholdSheet(false)}
        onSelectThreshold={handleThresholdSelect}
        currentThreshold={settingsHandlers.ecashThreshold || 100}
      />

      {/* Ecash Conversion Confirmation Modal */}
      <EcashConversionModal
        visible={showConversionModal}
        onClose={() => setShowConversionModal(false)}
        onConfirm={handleConfirmConversion}
        amountToConvert={conversionAmount}
        unitBalance={savedUnitBalance}
        newThreshold={pendingThreshold || 100}
      />

      {/* Low Ecash Balance Modal */}
      <LowEcashBalanceModal
        visible={showLowBalanceModal}
        onClose={closeLowBalanceModal}
        onConfirm={handleLowBalanceTopUp}
        currentBalance={lowBalanceCurrentBalance}
        defaultThreshold={lowBalanceDefaultThreshold}
        amountNeeded={lowBalanceAmountNeeded}
      />
    </>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  contentArea: {
    flex: 1,
    overflow: 'hidden',
  },
  vaultContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1,
    flexDirection: 'column',
  },
  screenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 2,
    flexDirection: 'column',
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 10, // Lowered from 1000 to allow React Navigation modals to appear above
  },
  rightEdgeSwipeArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 30, // 30px invisible strip on the right edge
    backgroundColor: 'transparent',
    zIndex: 10, // Above the WebView content
  },
});
