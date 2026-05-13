/**
 * AssetDetailScreen Component
 * Displays detailed information about a specific asset (BTC or UNIT)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  AssetAbout,
  AssetActionButtons,
  AssetActivityList,
  AssetHeader,
  AssetInfo,
  AssetPriceChart,
  AssetTabs,
} from '../../components/assetDetail';
import TokenDetailsSheet from '../../components/ecash/TokenDetailsSheet';
import TransactionDetailsSheet from '../../components/transaction/TransactionDetailsSheet';
import BtcBalanceBreakdown from '../../components/wallet/BtcBalanceBreakdown';
import UnitBalanceBreakdown from '../../components/wallet/UnitBalanceBreakdown';
import { useCashuBalanceState } from '../../contexts/CashuContext';
import { useWallet } from '../../contexts/WalletContext';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import {
  useBalance,
  useEvmAssets,
  useTransactionHistory,
  useVaultData,
} from '../../contexts/WalletDataContext';
import { useAssetTransactions } from '../../hooks/useAssetTransactions';
import { useFuseEcash } from '../../hooks/useFuseEcash';
import { usePriceChart } from '../../hooks/usePriceChart';
import { useRedeemCashuToken } from '../../hooks/useRedeemCashuToken';
import { useTurboConvert } from '../../hooks/useTurboConvert';
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import { useNotifications } from '../../stores/notificationStore';
import { usePendingTransactionsStore } from '../../stores/pendingTransactionsStore';
import { useHasPendingVaultTx } from '../../stores/pendingVaultTransactionStore';
import { usePrice } from '../../stores/priceStore';
import { COLORS } from '../../theme';
import type { DisplayAssetType } from '../../types/assets';
import type { PendingTransaction as UtilsPendingTransaction } from '../../utils/pendingTransactionsUtils';
import { getRunesAmount } from '../../utils/runesHelper';
import type { CashuUnit } from '../../services/cashu/cashuUnits';
import { saveSentLockedToken } from '../../services/cashu/cashuLockedTokensService';

/**
 * Props for AssetDetailScreen component
 */
interface AssetDetailScreenProps {
  /** Route object from React Navigation containing navigation params */
  route?: {
    /** Route parameters */
    params?: {
      /** Type of asset to display (BTC, UNIT, or Sepolia asset) */
      assetType?: 'BTC' | 'UNIT' | 'USDC' | 'ETH';
      /** Whether advanced mode is enabled for additional features */
      advancedMode?: boolean;
      initialEvmUsdcBalance?: number;
      initialEvmEthBalance?: number;
      initialEvmAddress?: string;
    };
  };
  /** Navigation object from React Navigation */
  navigation: {
    /** Navigate to a new screen */
    navigate: (screen: string, params?: object) => void;
    /** Go back to previous screen */
    goBack: () => void;
    /** Whether this navigator has a previous route */
    canGoBack?: () => boolean;
  };
}

/**
 * Token data structure for ecash tokens
 */
interface TokenData {
  /** Recipient address */
  recipient: string;
  /** Short URL for the token */
  shortUrl?: string | null;
  /** The cashu token string */
  token: string;
  /** Whether the token has been claimed */
  claimed: boolean;
  /** Whether this is a self-claim */
  isSelfClaim?: boolean;
  /** Cashu token unit */
  cashuUnit?: CashuUnit;
}

function navigateBackToWalletHome(navigation: AssetDetailScreenProps['navigation']): void {
  if (navigation.canGoBack?.()) {
    navigation.goBack();
    return;
  }

  navigation.navigate('WalletHome');
}

function AssetDetailScreen(props: AssetDetailScreenProps): React.JSX.Element {
  const assetType = props.route?.params?.assetType || 'BTC';
  const { settingsHandlers } = useSettingsHandlers();
  const usdcFeaturesEnabled = settingsHandlers.usdcFeaturesEnabled;
  const isSepoliaAsset = assetType === 'USDC' || assetType === 'ETH';

  useEffect(() => {
    if (isSepoliaAsset && !usdcFeaturesEnabled) {
      navigateBackToWalletHome(props.navigation);
    }
  }, [isSepoliaAsset, props.navigation, usdcFeaturesEnabled]);

  if (isSepoliaAsset && !usdcFeaturesEnabled) {
    return <SafeAreaView style={styles.container} />;
  }

  if (isSepoliaAsset) {
    return <EvmAssetDetailScreen {...props} />;
  }

  return <BtcUnitAssetDetailScreen {...props} />;
}

function EvmAssetDetailScreen({
  route = {},
  navigation,
}: AssetDetailScreenProps): React.JSX.Element {
  const {
    assetType: requestedAssetType = 'USDC',
    advancedMode = false,
    initialEvmUsdcBalance = 0,
    initialEvmEthBalance = 0,
    initialEvmAddress = '',
  } = route?.params || {};
  const assetType: 'USDC' | 'ETH' = requestedAssetType === 'ETH' ? 'ETH' : 'USDC';
  const {
    evmBalances,
    usdcHistory,
    ethHistory,
    loadingEvmBalances,
    loadingUsdcHistory,
    loadingEthHistory,
    isSepoliaConfigured,
    isEvmConfigured,
    refreshEvmBalances,
    refreshUsdcHistory,
    refreshEthHistory,
  } = useEvmAssets();
  const { ethPrice } = usePrice();
  const { settingsHandlers } = useSettingsHandlers();
  const usdcFeaturesEnabled = settingsHandlers.usdcFeaturesEnabled;
  const [selectedTab, setSelectedTab] = useState<'ACTIVITY' | 'ABOUT'>('ACTIVITY');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '1W' | '1M' | '1Y'>('1M');
  const [isChartScrubbing, setIsChartScrubbing] = useState(false);
  const [selectedRegularTx, setSelectedRegularTx] = useState<{
    txid: string;
    timestamp?: number;
    confirmed: boolean;
    txData: {
      amount: number | bigint;
      assetType: DisplayAssetType;
      isSent: boolean;
      isReceived: boolean;
      displayKind?: 'turbo_mint_claim' | 'turbo_redeem';
    };
  } | null>(null);
  const [showRegularTxDetails, setShowRegularTxDetails] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const balanceLoadedRef = useRef(Boolean(initialEvmAddress));
  const handleBackPress = useCallback(() => {
    navigateBackToWalletHome(navigation);
  }, [navigation]);
  const { priceData, priceDirection, priceLoading, priceError, setPriceError } = usePriceChart(
    assetType,
    selectedTimeframe
  );

  const effectiveEvmBalance = Number(
    assetType === 'ETH'
      ? evmBalances?.eth || initialEvmEthBalance || 0
      : evmBalances?.usdc || initialEvmUsdcBalance || 0
  );
  const effectiveEvmAddress = evmBalances?.address || initialEvmAddress;

  if (!loadingEvmBalances || Boolean(effectiveEvmAddress)) {
    balanceLoadedRef.current = true;
  }

  const isBalanceLoading = !balanceLoadedRef.current && loadingEvmBalances && !effectiveEvmAddress;

  useFocusEffect(
    useCallback(() => {
      refreshEvmBalances().catch(() => undefined);
      if (selectedTab === 'ACTIVITY') {
        if (assetType === 'USDC') {
          refreshUsdcHistory().catch(() => undefined);
        } else {
          refreshEthHistory().catch(() => undefined);
        }
      }
      return undefined;
    }, [assetType, refreshEthHistory, refreshEvmBalances, refreshUsdcHistory, selectedTab])
  );

  const handleActionPress = useCallback(
    (action: 'send' | 'receive' | 'swap') => {
      switch (action) {
        case 'send':
          navigation.navigate('SepoliaSend', { asset: assetType });
          break;
        case 'receive':
          if (!effectiveEvmAddress) {
            Alert.alert('Address unavailable', 'Sepolia address is still loading.');
            return;
          }
          navigation.navigate('ReceiveQR', {
            address: effectiveEvmAddress,
            addressType: 'Sepolia EVM',
            assetType,
            networkLabel: 'Ethereum Sepolia',
          });
          break;
        case 'swap':
          if (assetType === 'USDC') {
            navigation.navigate('SepoliaSwap', { sourceAsset: 'USDC' });
          }
          break;
      }
    },
    [assetType, effectiveEvmAddress, navigation]
  );

  const handleTransactionPress = useCallback(
    (tx: {
      txid: string;
      status?: { confirmed: boolean; block_time?: number };
      txData?: { amount: number | bigint; assetType: string; isSent: boolean; isReceived: boolean };
    }) => {
      if (!tx.txData) {
        return;
      }

      setSelectedRegularTx({
        txid: tx.txid,
        timestamp: tx.status?.block_time,
        confirmed: tx.status?.confirmed ?? false,
        txData: {
          amount: tx.txData.amount,
          assetType: tx.txData.assetType as DisplayAssetType,
          isSent: tx.txData.isSent,
          isReceived: tx.txData.isReceived,
        },
      });
      setShowRegularTxDetails(true);
    },
    []
  );

  const evmTransactions = assetType === 'USDC' ? usdcHistory : ethHistory;
  const evmHistoryLoading = assetType === 'USDC' ? loadingUsdcHistory : loadingEthHistory;

  return (
    <>
      <SafeAreaView style={styles.container} testID="asset-detail-screen">
        <AssetHeader onBackPress={handleBackPress} />

        <Animated.ScrollView
          style={styles.scrollView}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          scrollEnabled={!isChartScrubbing}
        >
          <AssetInfo
            assetType={assetType}
            balance={effectiveEvmBalance}
            fiatValue={
              assetType === 'ETH' ? effectiveEvmBalance * (ethPrice ?? 0) : effectiveEvmBalance
            }
            btcPrice={null}
            priceData={priceData}
            priceDirection={priceDirection}
            isLoading={isBalanceLoading}
          />

          <AssetActionButtons
            onSendPress={() => handleActionPress('send')}
            onReceivePress={() => handleActionPress('receive')}
            onSwapPress={() => handleActionPress('swap')}
            showSwap={assetType === 'USDC' && isEvmConfigured && usdcFeaturesEnabled}
            showSend={isSepoliaConfigured}
            showReceive={true}
            advancedMode={advancedMode}
          />

          <AssetPriceChart
            assetType={assetType}
            priceData={priceData}
            priceError={priceError}
            priceLoading={priceLoading}
            isPositive={priceDirection.isPositive}
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={setSelectedTimeframe}
            onRetry={() => setPriceError(null)}
            currentPrice={assetType === 'ETH' ? ethPrice : 1}
            onScrubStart={() => setIsChartScrubbing(true)}
            onScrubEnd={() => setIsChartScrubbing(false)}
          />

          <AssetTabs
            selectedTab={selectedTab}
            onTabChange={(tab: string) => setSelectedTab(tab as 'ACTIVITY' | 'ABOUT')}
            assetType={assetType}
          />

          {selectedTab === 'ACTIVITY' ? (
            <AssetActivityList
              transactions={evmTransactions}
              isLoading={evmHistoryLoading}
              onTransactionPress={
                handleTransactionPress as (tx: { txid: string; ecashToken?: boolean }) => void
              }
              advancedMode={advancedMode}
            />
          ) : (
            <AssetAbout assetType={assetType} evmAddress={effectiveEvmAddress} />
          )}
        </Animated.ScrollView>
      </SafeAreaView>

      <TransactionDetailsSheet
        visible={showRegularTxDetails}
        onClose={() => setShowRegularTxDetails(false)}
        txid={selectedRegularTx?.txid ?? null}
        timestamp={selectedRegularTx?.timestamp}
        confirmed={selectedRegularTx?.confirmed ?? false}
        txData={selectedRegularTx?.txData ?? null}
      />
    </>
  );
}

function BtcUnitAssetDetailScreen({
  route = {},
  navigation,
}: AssetDetailScreenProps): React.JSX.Element {
  const {
    assetType = 'BTC',
    advancedMode = false,
    initialEvmUsdcBalance = 0,
    initialEvmAddress = '',
  } = route?.params || {};
  const {
    evmBalances,
    usdcHistory,
    loadingEvmBalances,
    loadingUsdcHistory,
    isEvmConfigured: showSwapAction,
    refreshEvmBalances,
    refreshUsdcHistory,
  } = useEvmAssets();
  const { settingsHandlers } = useSettingsHandlers();
  const usdcFeaturesEnabled = settingsHandlers.usdcFeaturesEnabled;

  const { segwitBalance, taprootBalance, runesBalance, loadingBalance } = useBalance();
  const { btcPrice } = usePrice();
  const { wallet } = useWallet();
  const { balance: cashuBalance, btcBalanceSats, isLoading: loadingCashu } = useCashuBalanceState();
  const { transactionHistory, fetchTransactionHistory } = useTransactionHistory();
  const { getSpentUtxos, unmarkUtxosAsSpent } = usePendingTransactionsStore();

  // Vault data from shared context (participates in 10s polling)
  const { vaultData, loadingVault } = useVaultData();
  const effectiveBtcPrice = btcPrice || vaultData?.currentPrice || 0;

  // Calculate vault health metrics
  const { vaultHealthPercentage, vaultHealthColor, vaultDebt, vaultCollateral, hasVault } =
    useWalletCalculations({
      btcPrice: effectiveBtcPrice,
      vaultData,
    });

  const [selectedTab, setSelectedTab] = useState<'ACTIVITY' | 'ABOUT'>('ACTIVITY');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '1W' | '1M' | '1Y'>('1M');
  const [selectedToken, setSelectedToken] = useState<TokenData | null>(null);
  const [showTokenDetails, setShowTokenDetails] = useState<boolean>(false);
  const [isChartScrubbing, setIsChartScrubbing] = useState(false);
  // Regular transaction details state
  const [selectedRegularTx, setSelectedRegularTx] = useState<{
    txid: string;
    timestamp?: number;
    confirmed: boolean;
    txData: {
      amount: number | bigint;
      assetType: DisplayAssetType;
      isSent: boolean;
      isReceived: boolean;
      displayKind?: 'turbo_mint_claim' | 'turbo_redeem';
    };
  } | null>(null);
  const [showRegularTxDetails, setShowRegularTxDetails] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { showToast } = useNotifications();
  const isPendingVaultTx = useHasPendingVaultTx();
  const handleBackPress = useCallback(() => {
    navigateBackToWalletHome(navigation);
  }, [navigation]);

  // Track if balance has ever loaded (prevents spinner on background updates)
  const balanceLoadedRef = useRef(false);

  // Price chart hook
  const { priceData, priceDirection, priceLoading, priceError, setPriceError } = usePriceChart(
    assetType,
    selectedTimeframe
  );

  // Calculate balances
  // Runes from ord comes in display units (already divided)
  // Ecash is stored in smallest units (needs /100 for display)
  const unitRunesAmount = getRunesAmount(runesBalance);
  const cashuDisplayAmount = (cashuBalance || 0) / 100;
  const totalUnitAmount = unitRunesAmount + cashuDisplayAmount;
  const effectiveEvmUsdcBalance = Number(evmBalances?.usdc || initialEvmUsdcBalance || 0);
  const effectiveEvmAddress = evmBalances?.address || initialEvmAddress;
  const btcOnchainAmount = (segwitBalance || 0) + (taprootBalance || 0);
  const btcTurboAmount = (btcBalanceSats || 0) / 100_000_000;
  const balance =
    assetType === 'BTC'
      ? btcOnchainAmount + btcTurboAmount
      : assetType === 'UNIT'
        ? totalUnitAmount
        : effectiveEvmUsdcBalance;
  const fiatValue = assetType === 'BTC' ? balance * effectiveBtcPrice : balance * 1;

  // Loading states - only show loading on initial load, not background updates
  const hasRunesData = runesBalance !== null && runesBalance !== undefined;
  const hasCashuData = cashuBalance !== null && cashuBalance !== undefined;
  const hasUnitData = hasRunesData || hasCashuData;
  const hasBtcData = segwitBalance !== null && segwitBalance !== undefined;

  // Mark as loaded once we have data
  if (
    (assetType === 'UNIT' && hasUnitData) ||
    (assetType === 'BTC' && hasBtcData) ||
    (assetType === 'USDC' && (!loadingEvmBalances || Boolean(effectiveEvmAddress)))
  ) {
    balanceLoadedRef.current = true;
  }

  // Only show loading if we haven't loaded yet
  const isBalanceLoading =
    !balanceLoadedRef.current &&
    (assetType === 'UNIT'
      ? loadingBalance || loadingCashu
      : assetType === 'USDC'
        ? loadingEvmBalances && !effectiveEvmAddress
        : loadingBalance);

  // Extract stable wallet addresses using refs
  const segwitAddressRef = useRef(wallet?.segwitAddress);
  const taprootAddressRef = useRef(wallet?.taprootAddress);

  if (wallet?.segwitAddress && wallet.segwitAddress !== segwitAddressRef.current) {
    segwitAddressRef.current = wallet.segwitAddress;
  }
  if (wallet?.taprootAddress && wallet.taprootAddress !== taprootAddressRef.current) {
    taprootAddressRef.current = wallet.taprootAddress;
  }

  const segwitAddress = segwitAddressRef.current;
  const taprootAddress = taprootAddressRef.current;

  const isPositive = useMemo(() => priceDirection.isPositive, [priceDirection.isPositive]);
  const historyAssetType: DisplayAssetType = assetType === 'USDC' ? 'BTC' : assetType;

  // Transaction filtering hook - cast transactionHistory to expected type
  const { transactions: filteredTransactions, isLoading: ecashLoading } = useAssetTransactions(
    (transactionHistory || []) as unknown as Parameters<typeof useAssetTransactions>[0],
    historyAssetType,
    segwitAddress,
    taprootAddress,
    advancedMode
  );

  // For activity list loading - useAssetTransactions handles all the logic
  const isActivityLoading = assetType === 'USDC' ? loadingUsdcHistory : ecashLoading;
  const assetTransactions = assetType === 'USDC' ? usdcHistory : filteredTransactions;

  useFocusEffect(
    useCallback(() => {
      if (assetType === 'USDC' && selectedTab === 'ACTIVITY') {
        refreshUsdcHistory().catch(() => undefined);
      }

      if (assetType !== 'USDC' && selectedTab === 'ACTIVITY') {
        fetchTransactionHistory().catch(() => undefined);
      }

      if (assetType !== 'USDC') {
        return undefined;
      }

      refreshEvmBalances().catch(() => undefined);
      return undefined;
    }, [assetType, fetchTransactionHistory, refreshEvmBalances, refreshUsdcHistory, selectedTab])
  );

  // Extracted operation hooks
  const { handleFusePress } = useFuseEcash({
    cashuBalance: assetType === 'BTC' ? btcBalanceSats || 0 : cashuBalance,
    taprootAddress: assetType === 'BTC' ? segwitAddress || '' : taprootAddress || '',
    transactionHistory: transactionHistory || [],
    fetchTransactionHistory,
    cashuUnit: assetType === 'BTC' ? 'sat' : 'unit',
  });

  const { handleTurboPress } = useTurboConvert({
    runesBalance,
    navigation,
    getSpentUtxos,
    unmarkUtxosAsSpent,
    getPendingTransactions: () =>
      (usePendingTransactionsStore.getState?.()?.pendingTransactions ?? {}) as unknown as Record<
        string,
        UtilsPendingTransaction
      >,
    senderTaprootAddress: taprootAddress,
  });

  useRedeemCashuToken({
    fetchTransactionHistory,
    taprootAddress: taprootAddress || '',
  });

  // Action handlers
  const handleActionPress = useCallback(
    (action: string) => {
      switch (action) {
        case 'send':
          if (assetType === 'USDC') {
            navigation.navigate('SepoliaSend', { asset: 'USDC' });
            break;
          }
          navigation.navigate('SendFlow', {
            screen: 'SendInput',
            params: { assetType: assetType.toLowerCase() },
          });
          break;
        case 'receive': {
          const address =
            assetType === 'BTC'
              ? segwitAddress
              : assetType === 'UNIT'
                ? taprootAddress
                : effectiveEvmAddress;
          if (!address) {
            Alert.alert(
              'Address unavailable',
              assetType === 'USDC'
                ? 'Sepolia address is still loading.'
                : 'Address is unavailable right now.'
            );
            return;
          }
          navigation.navigate('ReceiveQR', {
            address,
            addressType:
              assetType === 'BTC'
                ? 'Native SegWit'
                : assetType === 'UNIT'
                  ? 'Taproot'
                  : 'Sepolia EVM',
            assetType,
            networkLabel: assetType === 'USDC' ? 'Ethereum Sepolia' : undefined,
          });
          break;
        }
        case 'swap':
          navigation.navigate('SepoliaSwap', {
            sourceAsset: assetType === 'USDC' ? 'USDC' : 'UNIT',
          });
          break;
        case 'consolidate':
          handleFusePress();
          break;
        case 'turbo':
          handleTurboPress();
          break;
      }
    },
    [
      assetType,
      navigation,
      segwitAddress,
      taprootAddress,
      effectiveEvmAddress,
      handleFusePress,
      handleTurboPress,
    ]
  );

  const handleCopyNotification = useCallback(
    (message: string) => {
      showToast(message, 'success');
    },
    [showToast]
  );

  const handleShortUrlReady = useCallback(
    async (shortUrl: string, amount: number) => {
      const token = selectedToken;
      if (!token?.recipient) {
        return;
      }

      setSelectedToken({
        ...token,
        shortUrl,
      });

      await saveSentLockedToken(
        token.token,
        token.recipient,
        amount,
        null,
        shortUrl,
        taprootAddress ?? null,
        token.cashuUnit
      );
    },
    [selectedToken, taprootAddress]
  );

  const handleChartScrubStart = useCallback(() => {
    setIsChartScrubbing(true);
  }, []);

  const handleChartScrubEnd = useCallback(() => {
    setIsChartScrubbing(false);
  }, []);

  const handleTransactionPress = useCallback(
    (tx: {
      ecashToken?: boolean;
      isAutoclaim?: boolean;
      tokenData?: {
        recipient?: string;
        shortUrl?: string | null;
        token: string;
        claimed?: boolean;
        unit?: CashuUnit;
      };
      txid: string;
      status?: { confirmed: boolean; block_time?: number };
      txData?: {
        amount: number | bigint;
        assetType: string;
        isSent: boolean;
        isReceived: boolean;
        displayKind?: 'turbo_mint_claim' | 'turbo_redeem';
      };
    }) => {
      if (tx.ecashToken) {
        setSelectedToken(
          tx.tokenData
            ? {
                recipient: tx.tokenData.recipient ?? '',
                shortUrl: tx.tokenData.shortUrl ?? null,
                token: tx.tokenData.token,
                claimed: tx.tokenData.claimed ?? false,
                isSelfClaim: tx.isAutoclaim,
                cashuUnit: tx.tokenData.unit,
              }
            : null
        );
        setShowTokenDetails(true);
        return;
      }

      // Show transaction details sheet for regular transactions
      if (tx.txData) {
        setSelectedRegularTx({
          txid: tx.txid,
          timestamp: tx.status?.block_time,
          confirmed: tx.status?.confirmed ?? false,
          txData: {
            amount: tx.txData.amount,
            assetType: tx.txData.assetType as DisplayAssetType,
            isSent: tx.txData.isSent,
            isReceived: tx.txData.isReceived,
            displayKind: tx.txData.displayKind,
          },
        });
        setShowRegularTxDetails(true);
      }
    },
    []
  );

  return (
    <>
      <SafeAreaView style={styles.container} testID="asset-detail-screen">
        <AssetHeader onBackPress={handleBackPress} />

        <Animated.ScrollView
          style={styles.scrollView}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          scrollEnabled={!isChartScrubbing}
        >
          <AssetInfo
            assetType={assetType}
            balance={balance}
            fiatValue={fiatValue}
            btcPrice={assetType === 'BTC' ? effectiveBtcPrice : btcPrice}
            priceData={priceData}
            priceDirection={priceDirection}
            runesBalance={unitRunesAmount}
            cashuBalance={cashuBalance}
            isLoading={isBalanceLoading}
            vaultHealth={
              assetType === 'UNIT'
                ? {
                    healthPercentage: vaultHealthPercentage,
                    healthColor: vaultHealthColor,
                    totalDebt: vaultDebt,
                    totalCollateral: vaultCollateral,
                    currentPrice: effectiveBtcPrice,
                    hasVault,
                    isLoading: loadingVault,
                    priceChange24h: priceDirection.isPositive
                      ? parseFloat(priceDirection.percentChange)
                      : -parseFloat(priceDirection.percentChange),
                  }
                : undefined
            }
            isPendingVaultTx={isPendingVaultTx}
          />

          {assetType === 'BTC' && (
            <BtcBalanceBreakdown
              onchainBalance={btcOnchainAmount}
              cashuBalanceSats={btcBalanceSats || 0}
            />
          )}

          {assetType === 'UNIT' && (
            <UnitBalanceBreakdown ecashBalance={cashuBalance} runesBalance={unitRunesAmount} />
          )}

          <AssetActionButtons
            onSendPress={() => handleActionPress('send')}
            onReceivePress={() => handleActionPress('receive')}
            onSwapPress={() => handleActionPress('swap')}
            onConsolidatePress={() => handleActionPress('consolidate')}
            onTurboPress={() => handleActionPress('turbo')}
            showSwap={assetType === 'UNIT' && showSwapAction && usdcFeaturesEnabled}
            showSend={assetType !== 'USDC' || showSwapAction}
            showReceive={true}
            showConsolidate={
              (assetType === 'UNIT' && cashuBalance > 0) ||
              (assetType === 'BTC' && (btcBalanceSats || 0) > 0)
            }
            advancedMode={advancedMode}
          />

          <AssetPriceChart
            assetType={assetType}
            priceData={priceData}
            priceError={priceError}
            priceLoading={priceLoading}
            isPositive={isPositive}
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={setSelectedTimeframe}
            onRetry={() => setPriceError(null)}
            currentPrice={assetType === 'BTC' ? effectiveBtcPrice : 1}
            onScrubStart={handleChartScrubStart}
            onScrubEnd={handleChartScrubEnd}
          />

          <AssetTabs
            selectedTab={selectedTab}
            onTabChange={(tab: string) => setSelectedTab(tab as 'ACTIVITY' | 'ABOUT')}
            assetType={assetType}
          />

          {selectedTab === 'ACTIVITY' ? (
            <AssetActivityList
              transactions={assetTransactions}
              isLoading={isActivityLoading}
              onTransactionPress={
                handleTransactionPress as (tx: { txid: string; ecashToken?: boolean }) => void
              }
              advancedMode={advancedMode}
            />
          ) : (
            <AssetAbout
              assetType={assetType}
              evmAddress={assetType === 'USDC' ? effectiveEvmAddress : undefined}
            />
          )}
        </Animated.ScrollView>
      </SafeAreaView>

      {selectedToken && (
        <TokenDetailsSheet
          visible={showTokenDetails}
          onClose={() => setShowTokenDetails(false)}
          recipientAddress={selectedToken.recipient}
          shortUrl={selectedToken.shortUrl}
          cashuToken={selectedToken.token}
          onCopy={handleCopyNotification}
          advancedMode={advancedMode}
          claimed={selectedToken.claimed}
          isSelfClaim={selectedToken.isSelfClaim}
          cashuUnit={selectedToken.cashuUnit}
          onShortUrlReady={handleShortUrlReady}
        />
      )}

      {/* Regular Transaction Details Sheet */}
      <TransactionDetailsSheet
        visible={showRegularTxDetails}
        onClose={() => setShowRegularTxDetails(false)}
        txid={selectedRegularTx?.txid ?? null}
        timestamp={selectedRegularTx?.timestamp}
        confirmed={selectedRegularTx?.confirmed ?? false}
        txData={selectedRegularTx?.txData ?? null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  scrollView: {
    flex: 1,
  },
});

export default React.memo(AssetDetailScreen);
