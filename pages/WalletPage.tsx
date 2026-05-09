/**
 * WalletPage - Main wallet interface after authentication
 * Contains wallet screen, settings, and transaction flows
 */

import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React,{ useCallback,useEffect,useState } from 'react';
import { ActivityIndicator,Animated,StyleSheet,Text,View } from 'react-native';
import { COLORS } from '../theme';
import { useAuthSession } from '../contexts/AuthContext';

// Components
import MutinynetBanner from '../components/MutinynetBanner';
import SettingsScreen from '../screens/settings/SettingsScreen';
import SplashScreen from '../screens/SplashScreen';
import ReceiveScreen from '../screens/wallet/ReceiveScreen';
import TransactionHistoryScreen from '../screens/wallet/TransactionHistoryScreen';
import WalletScreen from '../screens/wallet/WalletScreen';
// EcashThresholdSheet is now rendered at app level in AppNavigatorContent
import LowEcashBalanceModal from '../components/ecash/LowEcashBalanceModal';
import QRScanner from '../components/scanner/QRScanner';
import EcashConversionModal from '../components/settings/EcashConversionModal';
import { DepositSheet,WithdrawSheet } from '../components/transfer/TransferSheet';

// Contexts
import { useCashu } from '../contexts/CashuContext';
import { useAccountSwitcherContext,useSettingsHandlers } from '../contexts/NavigationHandlersContext';
import { useTransactionExecution } from '../contexts/TransactionExecutionContext';
import { useWallet } from '../contexts/WalletContext';
import { useBalance,useVaultData } from '../contexts/WalletDataContext';
import { useNotifications } from "../stores/notificationStore";
import { usePrice } from '../stores/priceStore';
import { useSendFlow } from '../stores/sendFlowStore';

// Hooks
import { useClaimNotifications } from '../hooks/useClaimNotifications';
import { useEcashBalanceCheck } from '../hooks/useEcashBalanceCheck';
import { useEcashThresholdManager } from '../hooks/useEcashThresholdManager';
import { useQRCodeHandler } from '../hooks/useQRCodeHandler';
import { useSettingsNavigation } from '../hooks/useSettingsNavigation';
import { useSettingsScreenCallbacks } from '../hooks/useSettingsScreenCallbacks';
import { useSheetNavigation } from '../hooks/useSheetNavigation';
import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
import { useHasPendingVaultTx } from '../stores/pendingVaultTransactionStore';
import { decodeTokenMetadata } from '../services/cashu/cashuWalletService';
import { DEFAULT_CASHU_UNIT, normalizeCashuUnit } from '../services/cashu/cashuUnits';
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
  const { isAuthenticated } = useAuthSession();
  const { settingsHandlers, biometricEnabled } = useSettingsHandlers();
  const { setShowAccountPicker, switchingAccount } = useAccountSwitcherContext();
  const { runesBalance, segwitBalance, taprootBalance } = useBalance();
  const { vaultData } = useVaultData();
  const hasVault = !!(vaultData && (vaultData.totalCollateral ?? 0) > 0);
  const vaultCollateral = vaultData?.totalCollateral ?? 0;
  const { btcPrice } = usePrice();
  const {
    balance: cashuBalance,
    btcBalanceSats,
    receive: receiveCashuToken,
    receiveBtc: receiveBtcCashuToken,
  } = useCashu();
  const { wallet, switchAccount, currentAccount } = useWallet();
  const { intentStep, sendAssetType, sendAddressType, turboEnabled, btcTurboEnabled } = useSendFlow();
  const { broadcastedTxid } = useTransactionExecution();
  const { showToast, dismissSnackbar, showSnackbar } = useNotifications();
  const isPendingVaultTx = useHasPendingVaultTx();

  // Calculate current UNIT balance for ecash balance check
  const currentUnitBalance = getRunesAmount(runesBalance);

  // Low ecash balance check
  const {
    showLowBalanceModal, closeModal: closeLowBalanceModal,
    amountNeeded: lowBalanceAmountNeeded, currentBalance: lowBalanceCurrentBalance,
    defaultThreshold: lowBalanceDefaultThreshold,
  } = useEcashBalanceCheck(cashuBalance, settingsHandlers.ecashThreshold, currentUnitBalance, isAuthenticated);

  // Transaction notifications
  useTransactionNotifications({
    intentStep,
    broadcastedTxid: broadcastedTxid ?? undefined,
    sendAssetType: sendAssetType ?? undefined,
    turboEnabled,
    btcTurboEnabled,
    showSnackbar,
  });
  useClaimNotifications({ route, showSnackbar, dismissSnackbar, switchAccount: switchAccount as unknown as (accountIndex: number) => Promise<void> });

  // Navigation hooks
  const {
    showSettings, hasCheckedInitialFlags, settingsTranslateX, settingsOpacity,
    settingsPanResponderRef, openSettings, closeSettings,
  } = useSettingsNavigation();

  const { showTxHistory, setShowTxHistory } = useSheetNavigation();

  // Withdraw and Deposit sheets
  const [showWithdrawSheet, setShowWithdrawSheet] = useState(false);
  const [showDepositSheet, setShowDepositSheet] = useState(false);

  // Receive screen with QR (for when user selects asset from deposit sheet)
  const [showReceiveQR, setShowReceiveQR] = useState(false);
  const [receiveAssetType, setReceiveAssetType] = useState<'btc' | 'unit' | null>(null);

  // QR Scanner
  const [showQRScanner, setShowQRScanner] = useState(false);
  const receiveCashuTokenByUnit = useCallback(
    async (token: string) => {
      const metadata = decodeTokenMetadata(token);
      const unit = normalizeCashuUnit(metadata.unit ?? DEFAULT_CASHU_UNIT);
      return unit === 'sat' ? receiveBtcCashuToken(token) : receiveCashuToken(token);
    },
    [receiveBtcCashuToken, receiveCashuToken]
  );
  const handleQRScan = useQRCodeHandler({
    receiveCashuToken: receiveCashuTokenByUnit,
    showSnackbar,
    setShowQRScanner,
  });

  // Ecash threshold manager
  const {
    showConversionModal, conversionAmount, savedUnitBalance, pendingThreshold,
    setShowConversionModal, handleEcashThresholdPress,
    handleConfirmConversion, handleLowBalanceTopUp,
  } = useEcashThresholdManager({
    cashuBalance, runesBalance, settingsHandlers,
    showSettings, closeSettings, lowBalanceAmountNeeded, closeLowBalanceModal,
    senderTaprootAddress: wallet?.taprootAddress,
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

  // Handle navigation param to open deposit sheet
  useEffect(() => {
    if (route?.params?.openReceive) {
      setShowDepositSheet(true);
      (navigation as unknown as { setParams: (params: { openReceive: boolean }) => void }).setParams({ openReceive: false });
    }
  }, [route?.params?.openReceive, navigation]);

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

  // Navigate to repay flow - go up to root navigator (WalletStack -> MainTabs -> Root)
  const handleRepayPress = () => {
    navigation.getParent()?.getParent()?.navigate('RepayFlow' as never);
  };

  // Navigate to borrow flow - go up to root navigator (WalletStack -> MainTabs -> Root)
  const handleBorrowPress = () => {
    navigation.getParent()?.getParent()?.navigate('BorrowFlow' as never);
  };

  // Navigate to vault withdraw flow - go up to root navigator (WalletStack -> MainTabs -> Root)
  const handleVaultWithdraw = () => {
    navigation.getParent()?.getParent()?.navigate('WithdrawFlow' as never);
  };

  // Navigate to vault deposit flow - go up to root navigator (WalletStack -> MainTabs -> Root)
  const handleVaultDeposit = () => {
    navigation.getParent()?.getParent()?.navigate('DepositFlow' as never);
  };

  // Navigate to vault creation flow
  const handleCreateVaultPress = () => {
    (navigation as { navigate: (screen: string) => void }).navigate('VaultCreateFlow');
  };

  if (!hasCheckedInitialFlags) return <SplashScreen />;

  return (
    <>
      <View style={localStyles.container}>
        <MutinynetBanner />
        <View style={localStyles.contentArea}>
          {/* Wallet Screen */}
          <View style={localStyles.screenContainer}>
            <WalletScreen
              key={`wallet-${currentAccount}`}
              styles={styles}
              onSendPress={() => setShowWithdrawSheet(true)}
              onReceivePress={() => setShowDepositSheet(true)}
              onHistoryPress={() => setShowTxHistory(true)}
              onQRScanPress={() => setShowQRScanner(true)}
              onSettingsPress={openSettings}
              onCreateVaultPress={handleCreateVaultPress}
              onVaultPress={handleVaultPress}
              onRepayPress={handleRepayPress}
              onBorrowPress={handleBorrowPress}
              onBridgePress={() => (navigation as { navigate: (screen: string) => void }).navigate('UnitBridge')}
              onSwapPress={(sourceAsset?: 'UNIT' | 'USDC') => (
                navigation as { navigate: (screen: string, params?: object) => void }
              ).navigate('SepoliaSwap', sourceAsset ? { sourceAsset } : undefined)}
              onRedeemPress={() => (navigation as { navigate: (screen: string) => void }).navigate('SepoliaRedeem')}
              onAssetPress={(assetType, params) => (navigation as { navigate: (screen: string, params?: object) => void }).navigate('AssetDetail', {
                assetType,
                advancedMode: settingsHandlers.advancedMode,
                ...(params || {}),
              })}
              _sendAddressType={sendAddressType ?? undefined}
              showZeroAssets={settingsHandlers.showZeroAssets}
              isPendingVaultTx={isPendingVaultTx}
            />
          </View>
        </View>

        {/* Bottom Sheets */}
        <TransactionHistoryScreen key={`history-${currentAccount}`} styles={styles} showHistorySheet={showTxHistory} onClose={() => setShowTxHistory(false)}
          segwitAddress={wallet?.segwitAddress || ''} taprootAddress={wallet?.taprootAddress || ''}
          vaultPubkey={wallet?.taprootPubkey || ''} advancedMode={settingsHandlers.advancedMode} />
        <QRScanner visible={showQRScanner} onClose={() => setShowQRScanner(false)} onScan={handleQRScan} />
        <WithdrawSheet
          visible={showWithdrawSheet}
          onClose={() => setShowWithdrawSheet(false)}
          onAssetSelect={(assetType) => {
            (navigation as { navigate: (screen: string, params?: object) => void }).navigate('SendFlow', {
              screen: 'SendInput',
              params: { assetType }
            });
          }}
          onVaultWithdraw={handleVaultWithdraw}
          btcBalance={(segwitBalance || 0) + (taprootBalance || 0) + (btcBalanceSats || 0) / 100_000_000}
          unitBalance={currentUnitBalance + (cashuBalance || 0) / 100}
          btcPrice={btcPrice}
          vaultCollateral={vaultCollateral}
          hasVault={hasVault}
        />
        <DepositSheet
          visible={showDepositSheet}
          onClose={() => setShowDepositSheet(false)}
          onAssetSelect={(assetType) => {
            setReceiveAssetType(assetType);
            setShowReceiveQR(true);
          }}
          onVaultDeposit={handleVaultDeposit}
          hasVault={hasVault}
        />
        <ReceiveScreen
          key={`receive-qr-${currentAccount}`}
          styles={styles}
          showReceiveSheet={showReceiveQR}
          onClose={() => {
            setShowReceiveQR(false);
            setReceiveAssetType(null);
          }}
          segwitAddress={wallet?.segwitAddress || ''}
          taprootAddress={wallet?.taprootAddress || ''}
          showToast={showToast}
          autoOpenQR={true}
          preSelectedAddress={receiveAssetType === 'btc' ? wallet?.segwitAddress : wallet?.taprootAddress}
          preSelectedType={receiveAssetType === 'btc' ? 'BTC Address' : 'UNIT Address'}
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
            onViewAdvanced={handleViewAdvanced} onViewCashuSettings={handleViewCashuSettings} onViewAbout={handleViewAbout}
            advancedMode={settingsHandlers.advancedMode} />
        </Animated.View>
      )}

      {/* Modals */}
      {/* EcashThresholdSheet is now rendered at app level in AppNavigatorContent */}
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
