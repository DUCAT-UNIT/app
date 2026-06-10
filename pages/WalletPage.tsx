/**
 * WalletPage - Main wallet interface after authentication
 * Contains wallet screen, settings, and transaction flows
 */

import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';
import { useAuthSession } from '../contexts/AuthContext';

// Components
import MutinynetBanner from '../components/MutinynetBanner';
import SplashScreen from '../screens/SplashScreen';
import ReceiveScreen from '../screens/wallet/ReceiveScreen';
import TransactionHistoryScreen from '../screens/wallet/TransactionHistoryScreen';
import WalletScreen from '../screens/wallet/WalletScreen';
// EcashThresholdSheet is now rendered at app level in AppNavigatorContent
import LowEcashBalanceModal from '../components/ecash/LowEcashBalanceModal';
import QRScanner from '../components/scanner/QRScanner';
import EcashConversionModal from '../components/settings/EcashConversionModal';
import { DepositSheet, WithdrawSheet } from '../components/transfer/TransferSheet';

// Contexts
import { useCashu } from '../contexts/CashuContext';
import {
  useAccountSwitcherContext,
  useSettingsHandlers,
} from '../contexts/NavigationHandlersContext';
import { useTransactionExecution } from '../contexts/TransactionExecutionContext';
import { useWallet } from '../contexts/WalletContext';
import { useBalance } from '../contexts/WalletDataContext';
import { useNotifications } from '../stores/notificationStore';
import { usePrice } from '../stores/priceStore';
import { useSendFlow } from '../stores/sendFlowStore';
import { getReceiveAddressTarget } from '../utils/receiveAddress';

// Hooks
import { useClaimNotifications } from '../hooks/useClaimNotifications';
import { useEcashBalanceCheck } from '../hooks/useEcashBalanceCheck';
import { useEcashThresholdManager } from '../hooks/useEcashThresholdManager';
import { useQRCodeHandler } from '../hooks/useQRCodeHandler';
import { useSettingsNavigation } from '../hooks/useSettingsNavigation';
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
import type {
  ExtendedNavigation,
  RootNavigatorParamList,
  WalletStackParamList,
} from '../navigation/types';

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

  const getRootNavigation = useCallback(() => {
    let current = navigation as unknown as ExtendedNavigation;
    let parent = current.getParent?.();

    while (parent) {
      current = parent;
      parent = current.getParent?.();
    }

    return current as ExtendedNavigation & {
      navigate: <T extends keyof RootNavigatorParamList>(
        screen: T,
        params?: RootNavigatorParamList[T]
      ) => void;
    };
  }, [navigation]);

  const navigateRoot = useCallback(
    <T extends keyof RootNavigatorParamList>(screen: T, params?: RootNavigatorParamList[T]) => {
      getRootNavigation().navigate(screen, params);
    },
    [getRootNavigation]
  );

  const navigateWalletFlow = useCallback(
    (screen: keyof WalletStackParamList, params?: Record<string, unknown>) => {
      navigateRoot('WalletFlow', { screen, params } as RootNavigatorParamList['WalletFlow']);
    },
    [navigateRoot]
  );

  // Context consumption
  const { isAuthenticated } = useAuthSession();
  const { settingsHandlers } = useSettingsHandlers();
  const { switchingAccount } = useAccountSwitcherContext();
  const { runesBalance, segwitBalance, taprootBalance } = useBalance();
  const { btcPrice } = usePrice();
  const {
    balance: cashuBalance,
    btcBalanceSats,
    receive: receiveCashuToken,
    receiveBtc: receiveBtcCashuToken,
  } = useCashu();
  const { wallet, switchAccount, currentAccount, walletProfile } = useWallet();
  const { intentStep, sendAssetType, sendAddressType, turboEnabled, btcTurboEnabled } =
    useSendFlow();
  const { broadcastedTxid } = useTransactionExecution();
  const { showToast, dismissSnackbar, showSnackbar } = useNotifications();
  const isPendingVaultTx = useHasPendingVaultTx();

  // Calculate current UNIT balance for ecash balance check
  const currentUnitBalance = getRunesAmount(runesBalance);

  // Low ecash balance check
  const {
    showLowBalanceModal,
    closeModal: closeLowBalanceModal,
    amountNeeded: lowBalanceAmountNeeded,
    currentBalance: lowBalanceCurrentBalance,
    defaultThreshold: lowBalanceDefaultThreshold,
  } = useEcashBalanceCheck(
    cashuBalance,
    settingsHandlers.ecashThreshold,
    currentUnitBalance,
    isAuthenticated
  );

  // Transaction notifications
  useTransactionNotifications({
    intentStep,
    broadcastedTxid: broadcastedTxid ?? undefined,
    sendAssetType: sendAssetType ?? undefined,
    turboEnabled,
    btcTurboEnabled,
    showSnackbar,
  });
  useClaimNotifications({
    route,
    showSnackbar,
    dismissSnackbar,
    switchAccount: switchAccount as unknown as (accountIndex: number) => Promise<void>,
  });

  // Navigation hooks
  const { showSettings, hasCheckedInitialFlags, closeSettings } = useSettingsNavigation();

  const { showTxHistory, setShowTxHistory } = useSheetNavigation();

  // Withdraw and Deposit sheets
  const [showWithdrawSheet, setShowWithdrawSheet] = useState(false);
  const [showDepositSheet, setShowDepositSheet] = useState(false);

  // Receive screen with QR (for when user selects asset from deposit sheet)
  const [showReceiveQR, setShowReceiveQR] = useState(false);
  const [receiveAssetType, setReceiveAssetType] = useState<'btc' | 'unit' | null>(null);
  const shouldHideTabBarForOverlay = showWithdrawSheet || showDepositSheet || showReceiveQR;
  const btcReceiveTarget = getReceiveAddressTarget({
    assetType: 'BTC',
    wallet,
    walletProfile,
  });
  const unitReceiveTarget = getReceiveAddressTarget({
    assetType: 'UNIT',
    wallet,
    walletProfile,
  });

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
    showConversionModal,
    conversionAmount,
    savedUnitBalance,
    pendingThreshold,
    setShowConversionModal,
    handleConfirmConversion,
    handleLowBalanceTopUp,
  } = useEcashThresholdManager({
    cashuBalance,
    runesBalance,
    settingsHandlers,
    showSettings,
    closeSettings,
    lowBalanceAmountNeeded,
    closeLowBalanceModal,
    senderTaprootAddress: wallet?.taprootAddress,
  });

  // Handle navigation param to open deposit sheet
  useEffect(() => {
    if (route?.params?.openReceive) {
      setShowDepositSheet(true);
      (
        navigation as unknown as { setParams: (params: { openReceive: boolean }) => void }
      ).setParams({ openReceive: false });
    }
  }, [route?.params?.openReceive, navigation]);

  useEffect(() => {
    if (!showSettings) return;

    navigateWalletFlow('SettingsHome');
    closeSettings();
  }, [closeSettings, navigateWalletFlow, showSettings]);

  useEffect(() => {
    (
      navigation as unknown as { setOptions?: (options: { tabBarHidden?: boolean }) => void }
    ).setOptions?.({ tabBarHidden: shouldHideTabBarForOverlay });

    return () => {
      (
        navigation as unknown as { setOptions?: (options: { tabBarHidden?: boolean }) => void }
      ).setOptions?.({ tabBarHidden: false });
    };
  }, [navigation, shouldHideTabBarForOverlay]);

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
    navigateWalletFlow('VaultDetail');
  };

  // Navigate to repay flow
  const handleRepayPress = () => {
    navigateRoot('RepayFlow');
  };

  // Navigate to borrow flow
  const handleBorrowPress = () => {
    navigateRoot('BorrowFlow');
  };

  const handleResumeVaultSettlementPress = () => {
    navigateRoot('BorrowFlow', { screen: 'BorrowProcessing' });
  };

  // Navigate to vault withdraw flow
  const handleVaultWithdraw = () => {
    navigateRoot('WithdrawFlow');
  };

  // Navigate to vault deposit flow
  const handleVaultDeposit = () => {
    navigateRoot('DepositFlow');
  };

  // Navigate to vault creation flow
  const handleCreateVaultPress = () => {
    navigateRoot('VaultCreateFlow');
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
              onSettingsPress={() => navigateWalletFlow('SettingsHome')}
              onCreateVaultPress={handleCreateVaultPress}
              onVaultPress={handleVaultPress}
              onRepayPress={handleRepayPress}
              onBorrowPress={handleBorrowPress}
              onWithdrawPress={handleVaultWithdraw}
              onDepositPress={handleVaultDeposit}
              onResumeVaultSettlementPress={handleResumeVaultSettlementPress}
              onBridgePress={() => navigateWalletFlow('UnitBridge')}
              onSwapPress={(sourceAsset?: 'UNIT' | 'USDC') =>
                navigateWalletFlow('SepoliaSwap', sourceAsset ? { sourceAsset } : undefined)
              }
              onRedeemPress={() => navigateWalletFlow('SepoliaRedeem')}
              onAssetPress={(assetType, params) =>
                navigateWalletFlow('AssetDetail', {
                  assetType,
                  advancedMode: settingsHandlers.advancedMode,
                  ...(params || {}),
                })
              }
              _sendAddressType={sendAddressType ?? undefined}
              showZeroAssets={settingsHandlers.showZeroAssets}
              isPendingVaultTx={isPendingVaultTx}
            />
          </View>
        </View>

        {/* Bottom Sheets */}
        <TransactionHistoryScreen
          key={`history-${currentAccount}`}
          styles={styles}
          showHistorySheet={showTxHistory}
          onClose={() => setShowTxHistory(false)}
          segwitAddress={wallet?.segwitAddress || ''}
          taprootAddress={wallet?.taprootAddress || ''}
          vaultPubkey={wallet?.taprootPubkey || ''}
          advancedMode={settingsHandlers.advancedMode}
        />
        <QRScanner
          visible={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScan}
        />
        <WithdrawSheet
          visible={showWithdrawSheet}
          onClose={() => setShowWithdrawSheet(false)}
          onAssetSelect={(assetType) => {
            navigateRoot('SendFlow', {
              screen: 'SendInput',
              params: { assetType: assetType ?? undefined },
            });
          }}
          btcBalance={
            (segwitBalance || 0) + (taprootBalance || 0) + (btcBalanceSats || 0) / 100_000_000
          }
          unitBalance={currentUnitBalance + (cashuBalance || 0) / 100}
          btcPrice={btcPrice}
        />
        <DepositSheet
          visible={showDepositSheet}
          onClose={() => setShowDepositSheet(false)}
          onAssetSelect={(assetType) => {
            setReceiveAssetType(assetType);
            setShowReceiveQR(true);
          }}
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
          btcAddress={btcReceiveTarget.address || ''}
          btcAddressType={btcReceiveTarget.addressType}
          showToast={showToast}
          autoOpenQR={true}
          preSelectedAddress={
            receiveAssetType === 'btc' ? btcReceiveTarget.address : unitReceiveTarget.address
          }
          preSelectedType={
            receiveAssetType === 'btc' ? btcReceiveTarget.addressType : unitReceiveTarget.addressType
          }
        />
        <StatusBar style="light" />
        {/* Snackbar is rendered at app level in AppNavigatorContent */}
      </View>

      {/* Modals */}
      {/* EcashThresholdSheet is now rendered at app level in AppNavigatorContent */}
      <EcashConversionModal
        visible={showConversionModal}
        onClose={() => setShowConversionModal(false)}
        onConfirm={handleConfirmConversion}
        amountToConvert={conversionAmount}
        unitBalance={savedUnitBalance}
        newThreshold={pendingThreshold || 100}
      />
      <LowEcashBalanceModal
        visible={showLowBalanceModal}
        onClose={closeLowBalanceModal}
        onConfirm={handleLowBalanceTopUp}
        currentBalance={lowBalanceCurrentBalance}
        defaultThreshold={lowBalanceDefaultThreshold}
        amountNeeded={lowBalanceAmountNeeded}
      />

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
