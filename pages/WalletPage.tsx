/**
 * WalletPage - Main wallet interface after authentication
 * Contains wallet screen, vault, settings, and transaction flows
 */

import React, { useState, useEffect } from 'react';
import { View, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';

// Components
import WalletScreen from '../screens/wallet/WalletScreen';
import ReceiveScreen from '../screens/wallet/ReceiveScreen';
import TransactionHistoryScreen from '../screens/wallet/TransactionHistoryScreen';
import VaultScreen from '../screens/wallet/VaultScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import MutinynetBanner from '../components/MutinynetBanner';
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
import { useBalance, useVaultData } from '../contexts/WalletDataContext';
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
import { useSettingsScreenCallbacks } from '../hooks/useSettingsScreenCallbacks';
import { getRunesAmount } from '../utils/runesHelper';

// Styles
import localStyles from './WalletPage.styles';

// Types
import type { RouteProp } from '@react-navigation/native';

interface WalletPageParams {
  openReceive?: boolean;
  claimToken?: string;
  accountIndex?: number;
}

type WalletPageRouteProp = RouteProp<{ WalletPage: WalletPageParams }, 'WalletPage'>;

interface WalletPageProps {
  route?: WalletPageRouteProp;
}

export default function WalletPage({ route }: WalletPageProps) {
  const navigation = useNavigation();
  const styles = require('../styles').default;

  // Context consumption
  const { activeTab, setActiveTab, vaultCredentials, autoCreateVaultTrigger, openVault } = useVault();
  const { resetInactivityTimer } = useOnboardingFlow();
  const { settingsHandlers, biometricEnabled, setShowAccountPicker, switchingAccount } = useNavigationHandlers();
  const { runesBalance } = useBalance();
  const { balance: cashuBalance, receive: receiveCashuToken } = useCashu();
  const { wallet, switchAccount, currentAccount } = useWallet();
  const { vaultData } = useVaultData();
  const { intentStep, sendAssetType, sendAddressType } = useSendFlow();
  const { broadcastedTxid } = useTransactionExecution();
  const { toasts, showToast, dismissSnackbar, showSnackbar } = useNotifications();

  // Calculate current UNIT balance for ecash balance check
  const currentUnitBalance = getRunesAmount(runesBalance);

  // Low ecash balance check
  const {
    showLowBalanceModal, closeModal: closeLowBalanceModal,
    amountNeeded: lowBalanceAmountNeeded, currentBalance: lowBalanceCurrentBalance,
    defaultThreshold: lowBalanceDefaultThreshold,
  } = useEcashBalanceCheck(cashuBalance, settingsHandlers.ecashThreshold, currentUnitBalance);

  // Transaction notifications
  useTransactionNotifications({ intentStep, broadcastedTxid: broadcastedTxid ?? undefined, sendAssetType: sendAssetType ?? undefined, showSnackbar });
  useClaimNotifications({ route, showSnackbar, dismissSnackbar, switchAccount: switchAccount as unknown as (accountIndex: number) => Promise<void> });

  // Navigation hooks
  const {
    showSettings, hasCheckedInitialFlags, settingsTranslateX, settingsOpacity,
    settingsPanResponderRef, openSettings, closeSettings,
  } = useSettingsNavigation();

  const { showReceiveSheet, setShowReceiveSheet, showTxHistory, setShowTxHistory } = useSheetNavigation();

  // QR Scanner
  const [showQRScanner, setShowQRScanner] = useState(false);
  const handleQRScan = useQRCodeHandler({ receiveCashuToken, showToast, showSnackbar, setShowQRScanner });

  // Ecash threshold manager
  const {
    showThresholdSheet, showConversionModal, conversionAmount, savedUnitBalance, pendingThreshold,
    setShowThresholdSheet, setShowConversionModal, handleEcashThresholdPress,
    handleThresholdSelect, handleConfirmConversion, handleLowBalanceTopUp,
  } = useEcashThresholdManager({
    cashuBalance, runesBalance, settingsHandlers, showToast, showSnackbar,
    showSettings, closeSettings, lowBalanceAmountNeeded, closeLowBalanceModal,
  });

  // Settings callbacks
  const {
    handleViewPreferences, handleViewSecurity, handleViewAdvanced, handleViewCashuSettings, handleViewAbout,
  } = useSettingsScreenCallbacks({
    navigation: navigation as Parameters<typeof useSettingsScreenCallbacks>[0]['navigation'],
    settingsHandlers: settingsHandlers as Parameters<typeof useSettingsScreenCallbacks>[0]['settingsHandlers'],
    biometricEnabled,
    setShowAccountPicker,
    handleEcashThresholdPress,
  });

  // Handle navigation param to open receive sheet
  useEffect(() => {
    if (route?.params?.openReceive) {
      setShowReceiveSheet(true);
      (navigation as unknown as { setParams: (params: { openReceive: boolean }) => void }).setParams({ openReceive: false });
    }
  }, [route?.params?.openReceive, setShowReceiveSheet, navigation]);

  // Close settings when account changes (after account switch)
  const prevAccountRef = React.useRef(currentAccount);
  useEffect(() => {
    if (prevAccountRef.current !== currentAccount) {
      // Account changed - close settings immediately
      closeSettings();
      prevAccountRef.current = currentAccount;
    }
  }, [currentAccount, closeSettings]);

  // Vault swipe gesture
  const { vaultTranslateX, walletTranslateX, isSwiping, walletPanResponder, vaultPanResponder } =
    useVaultSwipeGesture({ activeTab, setActiveTab, openVault });

  if (!hasCheckedInitialFlags) return <SplashScreen />;

  return (
    <>
      <View style={localStyles.container} onTouchStart={resetInactivityTimer}>
        <MutinynetBanner />
        <View style={localStyles.contentArea}>
          {/* Vault Screen */}
          <Animated.View
            style={[localStyles.vaultContainer, { transform: [{ translateX: vaultTranslateX }] }]}
            pointerEvents={activeTab === 'vault' || isSwiping ? 'auto' : 'none'}
          >
            <VaultScreen
              key={`vault-${currentAccount}`}
              visible={activeTab === 'vault'}
              walletCredentials={vaultCredentials as Parameters<typeof VaultScreen>[0]['walletCredentials']}
              vaultData={vaultData as Parameters<typeof VaultScreen>[0]['vaultData']}
              showSnackbar={(params) => showSnackbar(params as Parameters<typeof showSnackbar>[0])}
            />
            {activeTab === 'vault' && (
              <View style={localStyles.rightEdgeSwipeArea} {...vaultPanResponder.panHandlers} />
            )}
          </Animated.View>

          {/* Wallet Screen */}
          <Animated.View
            style={[localStyles.screenContainer, { transform: [{ translateX: walletTranslateX }] }]}
            pointerEvents={activeTab === 'wallet' && !isSwiping ? 'auto' : 'none'}
            {...walletPanResponder.panHandlers}
          >
            <WalletScreen
              key={`wallet-${currentAccount}`}
              styles={styles}
              onSendPress={() => (navigation as { navigate: (screen: string, params?: object) => void }).navigate('SendFlow', { screen: 'AssetSelector' })}
              onReceivePress={() => setShowReceiveSheet(true)}
              onHistoryPress={() => setShowTxHistory(true)}
              onQRScanPress={() => setShowQRScanner(true)}
              onSettingsPress={openSettings}
              onCreateVaultPress={() => openVault(true)}
              onVaultPress={openVault}
              onAssetPress={(assetType) => (navigation as { navigate: (screen: string, params?: object) => void }).navigate('AssetDetail', { assetType, advancedMode: settingsHandlers.advancedMode })}
              _sendAddressType={sendAddressType ?? undefined}
              switchingAccount={switchingAccount}
              showZeroAssets={settingsHandlers.showZeroAssets}
            />
          </Animated.View>
        </View>

        {/* Bottom Sheets */}
        <ReceiveScreen key={`receive-${currentAccount}`} styles={styles} showReceiveSheet={showReceiveSheet} onClose={() => setShowReceiveSheet(false)}
          segwitAddress={wallet?.segwitAddress || ''} taprootAddress={wallet?.taprootAddress || ''} showToast={showToast} />
        <TransactionHistoryScreen key={`history-${currentAccount}`} styles={styles} showHistorySheet={showTxHistory} onClose={() => setShowTxHistory(false)}
          segwitAddress={wallet?.segwitAddress || ''} taprootAddress={wallet?.taprootAddress || ''}
          vaultPubkey={wallet?.taprootPubkey || ''} advancedMode={settingsHandlers.advancedMode} />
        <QRScanner visible={showQRScanner} onClose={() => setShowQRScanner(false)} onScan={handleQRScan} />
        <StatusBar style="light" />
        <ToastContainer toasts={toasts} />
      </View>

      {/* Settings Overlay */}
      {(showSettings || (settingsOpacity as unknown as { _value: number })._value > 0) && (
        <Animated.View
          style={[localStyles.settingsOverlay, { opacity: settingsOpacity, transform: [{ translateX: settingsTranslateX }] }]}
          pointerEvents={!showSettings ? 'none' : 'auto'}
          {...(settingsPanResponderRef.current?.panHandlers)}
        >
          <MutinynetBanner />
          <SettingsScreen onClose={closeSettings} onLockWallet={settingsHandlers.handleLogout}
            onViewPreferences={handleViewPreferences} onViewSecurity={handleViewSecurity}
            onViewAdvanced={handleViewAdvanced} onViewCashuSettings={handleViewCashuSettings} onViewAbout={handleViewAbout} />
        </Animated.View>
      )}

      {/* Modals */}
      <EcashThresholdSheet visible={showThresholdSheet} onClose={() => setShowThresholdSheet(false)}
        onSelectThreshold={handleThresholdSelect} currentThreshold={settingsHandlers.ecashThreshold || 100} />
      <EcashConversionModal visible={showConversionModal} onClose={() => setShowConversionModal(false)}
        onConfirm={handleConfirmConversion} amountToConvert={conversionAmount}
        unitBalance={savedUnitBalance} newThreshold={pendingThreshold || 100} />
      <LowEcashBalanceModal visible={showLowBalanceModal} onClose={closeLowBalanceModal}
        onConfirm={handleLowBalanceTopUp} currentBalance={lowBalanceCurrentBalance}
        defaultThreshold={lowBalanceDefaultThreshold} amountNeeded={lowBalanceAmountNeeded} />
    </>
  );
}
