/**
 * WalletPage - Main wallet interface after authentication
 * Contains wallet screen, settings, and transaction flows
 */

import React, { useState, useEffect } from 'react';
import { View, Animated, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../theme';
import { useNavigation } from '@react-navigation/native';

// Components
import WalletScreen from '../screens/wallet/WalletScreen';
import ReceiveScreen from '../screens/wallet/ReceiveScreen';
import TransactionHistoryScreen from '../screens/wallet/TransactionHistoryScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import SplashScreen from '../screens/SplashScreen';
import EcashThresholdSheet from '../components/settings/EcashThresholdSheet';
import EcashConversionModal from '../components/settings/EcashConversionModal';
import LowEcashBalanceModal from '../components/ecash/LowEcashBalanceModal';
import QRScanner from '../components/scanner/QRScanner';
import WithdrawAssetSheet from '../components/withdraw/WithdrawAssetSheet';

// Contexts
import { useWallet } from '../contexts/WalletContext';
import { useSendFlow } from '../contexts/SendFlowContext';
import { useTransactionExecution } from '../contexts/TransactionExecutionContext';
import { useOnboardingFlow } from '../contexts/AuthContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useNotifications } from "../contexts/NotificationContext";
import { useBalance } from '../contexts/WalletDataContext';
import { usePrice } from '../contexts/PriceContext';
import { useCashu } from '../contexts/CashuContext';

// Hooks
import { useSettingsNavigation } from '../hooks/useSettingsNavigation';
import { useSheetNavigation } from '../hooks/useSheetNavigation';
import { useEcashBalanceCheck } from '../hooks/useEcashBalanceCheck';
import { useQRCodeHandler } from '../hooks/useQRCodeHandler';
import { useClaimNotifications } from '../hooks/useClaimNotifications';
import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
import { useEcashThresholdManager } from '../hooks/useEcashThresholdManager';
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
  const { resetInactivityTimer } = useOnboardingFlow();
  const { settingsHandlers, biometricEnabled, setShowAccountPicker, switchingAccount } = useNavigationHandlers();
  const { runesBalance, segwitBalance, taprootBalance } = useBalance();
  const { btcPrice } = usePrice();
  const { balance: cashuBalance, receive: receiveCashuToken } = useCashu();
  const { wallet, switchAccount, currentAccount } = useWallet();
  const { intentStep, sendAssetType, sendAddressType } = useSendFlow();
  const { broadcastedTxid } = useTransactionExecution();
  const { showToast, dismissSnackbar, showSnackbar } = useNotifications();

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

  // Withdraw asset sheet
  const [showWithdrawSheet, setShowWithdrawSheet] = useState(false);

  // QR Scanner
  const [showQRScanner, setShowQRScanner] = useState(false);
  const handleQRScan = useQRCodeHandler({ receiveCashuToken, showSnackbar, setShowQRScanner });

  // Ecash threshold manager
  const {
    showThresholdSheet, showConversionModal, conversionAmount, savedUnitBalance, pendingThreshold,
    setShowThresholdSheet, setShowConversionModal, handleEcashThresholdPress,
    handleThresholdSelect, handleConfirmConversion, handleLowBalanceTopUp,
  } = useEcashThresholdManager({
    cashuBalance, runesBalance, settingsHandlers,
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

  // Navigate to vault detail screen
  const handleVaultPress = () => {
    (navigation as { navigate: (screen: string) => void }).navigate('VaultDetail');
  };

  if (!hasCheckedInitialFlags) return <SplashScreen />;

  return (
    <>
      <View style={localStyles.container} onTouchStart={resetInactivityTimer}>
        <MutinynetBanner />
        <View style={localStyles.contentArea}>
          {/* Wallet Screen */}
          <View style={localStyles.screenContainer}>
            <WalletScreen
              key={`wallet-${currentAccount}`}
              styles={styles}
              onSendPress={() => setShowWithdrawSheet(true)}
              onReceivePress={() => setShowReceiveSheet(true)}
              onHistoryPress={() => setShowTxHistory(true)}
              onQRScanPress={() => setShowQRScanner(true)}
              onSettingsPress={openSettings}
              onCreateVaultPress={handleVaultPress}
              onVaultPress={handleVaultPress}
              onAssetPress={(assetType) => (navigation as { navigate: (screen: string, params?: object) => void }).navigate('AssetDetail', { assetType, advancedMode: settingsHandlers.advancedMode })}
              _sendAddressType={sendAddressType ?? undefined}
              showZeroAssets={settingsHandlers.showZeroAssets}
            />
          </View>
        </View>

        {/* Bottom Sheets */}
        <ReceiveScreen key={`receive-${currentAccount}`} styles={styles} showReceiveSheet={showReceiveSheet} onClose={() => setShowReceiveSheet(false)}
          segwitAddress={wallet?.segwitAddress || ''} taprootAddress={wallet?.taprootAddress || ''} showToast={showToast} />
        <TransactionHistoryScreen key={`history-${currentAccount}`} styles={styles} showHistorySheet={showTxHistory} onClose={() => setShowTxHistory(false)}
          segwitAddress={wallet?.segwitAddress || ''} taprootAddress={wallet?.taprootAddress || ''}
          vaultPubkey={wallet?.taprootPubkey || ''} advancedMode={settingsHandlers.advancedMode} />
        <QRScanner visible={showQRScanner} onClose={() => setShowQRScanner(false)} onScan={handleQRScan} />
        <WithdrawAssetSheet
          visible={showWithdrawSheet}
          onClose={() => setShowWithdrawSheet(false)}
          onAssetSelect={(assetType) => {
            (navigation as { navigate: (screen: string, params?: object) => void }).navigate('SendFlow', {
              screen: 'AddressInput',
              params: { assetType }
            });
          }}
          btcBalance={(segwitBalance || 0) + (taprootBalance || 0)}
          unitBalance={currentUnitBalance + (cashuBalance || 0)}
          btcPrice={btcPrice}
        />
        <StatusBar style="light" />
        {/* Snackbar is rendered at app level in AppNavigatorContent */}
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

      {/* Full-screen loading overlay while switching accounts */}
      {switchingAccount && (
        <View style={switchingStyles.overlay}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
          <Text style={switchingStyles.text}>Switching account...</Text>
        </View>
      )}
    </>
  );
}

const switchingStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    marginTop: 12,
    fontFamily: 'CabinetGrotesk-Medium',
  },
});
