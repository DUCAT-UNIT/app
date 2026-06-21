import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Icon from '../../components/icons';
import AssetCard, { AssetCardStyles } from '../../components/wallet/AssetCard';
import ErrorBanner from '../../components/wallet/ErrorBanner';
import TotalBalanceSection, {
  TotalBalanceSectionStyles,
} from '../../components/wallet/TotalBalanceSection';
import VaultCard, { VaultCardStyles } from '../../components/wallet/VaultCard';
import WalletActions from '../../components/wallet/WalletActions';
import WalletHeader, { WalletHeaderStyles } from '../../components/wallet/WalletHeader';
import { useSettingsHandlers } from '../../contexts/NavigationHandlersContext';
import { useAirdrop } from '../../contexts/AirdropContext';
import { useCashu } from '../../contexts/CashuContext';
import { useWallet } from '../../contexts/WalletContext';
import { useBalance, useEvmAssets, useVaultData } from '../../contexts/WalletDataContext';
import { useAssetCardStyles } from '../../hooks/useAssetCardStyles';
import { useFormattedBalances } from '../../hooks/useFormattedBalances';
import { useResponsive } from '../../hooks/useResponsive';
import { useTotalBalanceStyles } from '../../hooks/useTotalBalanceStyles';
import { useVaultCardStyles } from '../../hooks/useVaultCardStyles';
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import { useDisplayPreferences } from '../../stores/displayPreferencesStore';
import { usePendingTxs } from '../../stores/pendingTransactionsStore';
import { usePrice } from '../../stores/priceStore';
import { useVaultSettlementStore } from '../../stores/vaultSettlementStore';
import { COLORS } from '../../theme';
import { formatBalance, formatFiat } from '../../utils/formatters';
import { getRunesAmount } from '../../utils/runesHelper';

// Constants
const VAULT_CREATION_RETRY_TIMEOUT = 2000;
const ASSETS_SCROLL_BOTTOM_PADDING = 160;

/**
 * Style object for WalletScreen - combines all child component styles
 */
interface WalletScreenStyles
  extends WalletHeaderStyles,
    TotalBalanceSectionStyles,
    VaultCardStyles,
    AssetCardStyles {
  walletContainer: ViewStyle;
  switchingOverlay: ViewStyle;
  switchingText: TextStyle;
  balanceDivider: ViewStyle;
  assetsScrollContainer: ViewStyle;
  assetsScrollContent: ViewStyle;
}

/**
 * Props for WalletScreen
 */
interface WalletScreenProps {
  styles: WalletScreenStyles;
  onSendPress: () => void;
  onReceivePress: () => void;
  onHistoryPress: () => void;
  onQRScanPress: () => void;
  onSettingsPress: () => void;
  onCreateVaultPress: () => void;
  onVaultPress: () => void;
  onRepayPress: () => void;
  onBorrowPress: () => void;
  onWithdrawPress: () => void;
  onDepositPress: () => void;
  onResumeVaultSettlementPress?: () => void;
  onBridgePress?: () => void;
  onSwapPress?: (sourceAsset?: 'UNIT' | 'USDC') => void;
  onRedeemPress?: () => void;
  onAssetPress?: (asset: string, params?: object) => void;
  _sendAddressType?: 'taproot' | 'segwit';
  showZeroAssets: boolean;
  isPendingVaultTx?: boolean;
}

const WalletScreen = React.memo(function WalletScreen({
  styles,
  onSendPress,
  onReceivePress,
  onHistoryPress,
  onQRScanPress,
  onSettingsPress,
  onCreateVaultPress,
  onVaultPress,
  onRepayPress,
  onBorrowPress,
  onWithdrawPress,
  onDepositPress,
  onResumeVaultSettlementPress,
  onAssetPress,
  _sendAddressType,
  showZeroAssets,
  isPendingVaultTx = false,
}: WalletScreenProps): React.ReactElement {
  const { currentAccount } = useWallet();
  const {
    segwitBalance,
    taprootBalance,
    runesBalance,
    balanceError,
    setBalanceError,
    fetchBalance,
  } = useBalance();
  const {
    evmBalances,
    loadingEvmBalances: isEvmBalanceLoading,
    isSepoliaConfigured,
    refreshEvmBalances,
  } = useEvmAssets();
  const { btcPrice, ethPrice, loadingBtcPrice, fetchBtcPrice } = usePrice();
  const { vaultData } = useVaultData();
  const { balance: cashuBalance, btcBalanceSats, refresh: refreshCashu } = useCashu();
  const { airdropPending, showAirdropModal } = useAirdrop();
  const { settingsHandlers } = useSettingsHandlers();
  const usdcFeaturesEnabled = settingsHandlers.usdcFeaturesEnabled;
  const {
    kind: settlementKind,
    phase: settlementPhase,
    faceValueUsd: settlementFaceValueUsd,
    requestedPayoutAsset: settlementRequestedPayoutAsset,
    bridgeSendTxid: settlementBridgeSendTxid,
    cashuMintSendTxid: settlementCashuMintSendTxid,
    error: settlementError,
  } = useVaultSettlementStore();
  const { showTotalInBTC, setShowTotalInBTC } = useDisplayPreferences();
  const pendingTransactions = usePendingTxs();
  const hasBtcBalance = segwitBalance > 0 || taprootBalance > 0 || btcBalanceSats > 0;

  React.useEffect(() => {
    if (!hasBtcBalance || btcPrice || loadingBtcPrice) {
      return;
    }

    fetchBtcPrice().catch(() => undefined);
  }, [hasBtcBalance, btcPrice, loadingBtcPrice, fetchBtcPrice]);

  const handleToggleBTCDisplay = useCallback(
    () => setShowTotalInBTC((prev) => !prev),
    [setShowTotalInBTC]
  );

  // Calculate all wallet-related values (business logic extracted to hook)
  const {
    totalBalanceBTC,
    totalBalanceUSD,
    vaultHealthColor,
    vaultHealthPercentage,
    vaultDebt,
    vaultCollateral,
    hasVault,
  } = useWalletCalculations({
    segwitBalance,
    taprootBalance,
    runesBalance,
    cashuBalance,
    cashuBtcBalanceSats: btcBalanceSats,
    btcPrice,
    vaultData: vaultData as {
      totalDebt?: number;
      totalCollateral?: number;
      currentPrice?: number;
    } | null,
  });

  // Responsive scaling (needs totalBalanceUSD)
  const { s } = useResponsive();
  const vaultCardStyles = useVaultCardStyles();
  const assetCardStyles = useAssetCardStyles();
  const { styles: totalBalanceStyles, largeBalanceStyle: responsiveLargeBalanceStyle } =
    useTotalBalanceStyles({ totalBalanceUSD });

  // Calculate UNIT totals (Runes + Ecash)
  // Runes from ord comes in display units (already divided)
  // Ecash is stored in smallest units (needs /100 for display)
  const unitTotals = React.useMemo(() => {
    const runesAmount = getRunesAmount(runesBalance);
    const cashuDisplayAmount = (cashuBalance || 0) / 100;
    const totalUnit = runesAmount + cashuDisplayAmount;
    // UNIT is pegged ~$1 USD, so usdValue ≈ totalUnit
    // btcValue = USD value / BTC price to get BTC equivalent
    const btcEquivalent = btcPrice ? totalUnit / btcPrice : 0;
    return {
      formatted: formatFiat(totalUnit),
      btcValue: formatBalance(btcEquivalent),
      usdValue: totalUnit,
    };
  }, [runesBalance, cashuBalance, btcPrice]);

  const btcTotals = React.useMemo(() => {
    const onchainBtc = (segwitBalance || 0) + (taprootBalance || 0);
    const turboBtc = (btcBalanceSats || 0) / 100_000_000;
    const totalBtc = onchainBtc + turboBtc;
    return {
      btcValue: formatBalance(totalBtc, 8),
      usdValue: formatFiat(totalBtc * (btcPrice || 0)),
    };
  }, [segwitBalance, taprootBalance, btcBalanceSats, btcPrice]);

  const usdcTotals = React.useMemo(() => {
    const parsedAmount = Number(evmBalances?.usdc || '0');
    const amount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const btcEquivalent = btcPrice ? amount / btcPrice : 0;

    return {
      formatted: formatFiat(amount),
      btcValue: formatBalance(btcEquivalent),
      usdValue: amount,
    };
  }, [evmBalances?.usdc, btcPrice]);

  const ethTotals = React.useMemo(() => {
    const parsedAmount = Number(evmBalances?.eth || '0');
    const amount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const usdValue = ethPrice ? amount * ethPrice : 0;
    const btcEquivalent = btcPrice && ethPrice ? usdValue / btcPrice : 0;

    return {
      formatted: `${formatBalance(amount, 6)} ETH`,
      btcValue: formatBalance(btcEquivalent),
      usdValue,
    };
  }, [btcPrice, ethPrice, evmBalances?.eth]);

  // Memoize formatted balances to avoid repeated toLocaleString() calls
  const formatted = useFormattedBalances({
    totalBalanceBTC,
    totalBalanceUSD,
    segwitBalance,
    taprootBalance,
    runesBalance: getRunesAmount(runesBalance),
    btcPrice,
  });

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Handle pull-to-refresh - refreshes balance and recovers any unclaimed mint quotes
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh balance (also triggers mint quote recovery)
      await Promise.all([
        fetchBalance(),
        refreshCashu(),
        usdcFeaturesEnabled && isSepoliaConfigured
          ? refreshEvmBalances().catch(() => undefined)
          : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchBalance, refreshCashu, refreshEvmBalances, isSepoliaConfigured, usdcFeaturesEnabled]);

  // Prevent multiple rapid clicks on create vault button
  const [creatingVault, setCreatingVault] = React.useState(false);
  const vaultCreationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCreateVault = React.useCallback(() => {
    if (creatingVault) return;
    setCreatingVault(true);
    onCreateVaultPress();
    // Reset after timeout to allow retry if needed
    vaultCreationTimeoutRef.current = setTimeout(
      () => setCreatingVault(false),
      VAULT_CREATION_RETRY_TIMEOUT
    );
  }, [creatingVault, onCreateVaultPress]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (vaultCreationTimeoutRef.current) {
        clearTimeout(vaultCreationTimeoutRef.current);
      }
    };
  }, []);

  // Handle retry when balance fetch fails
  const handleRetryBalance = React.useCallback(async () => {
    setBalanceError(null);
    await fetchBalance();
  }, [setBalanceError, fetchBalance]);

  // Memoized asset press handlers to prevent AssetCard re-renders
  const handleBTCPress = useCallback(() => {
    onAssetPress?.('BTC');
  }, [onAssetPress]);

  const handleUNITPress = useCallback(() => {
    onAssetPress?.('UNIT');
  }, [onAssetPress]);

  const handleUsdcPress = useCallback(() => {
    onAssetPress?.('USDC', {
      initialEvmUsdcBalance: Number(evmBalances?.usdc || '0'),
      initialEvmAddress: evmBalances?.address || '',
    });
  }, [evmBalances?.address, evmBalances?.usdc, onAssetPress]);

  const handleEthPress = useCallback(() => {
    onAssetPress?.('ETH', {
      initialEvmEthBalance: Number(evmBalances?.eth || '0'),
      initialEvmAddress: evmBalances?.address || '',
    });
  }, [evmBalances?.address, evmBalances?.eth, onAssetPress]);

  useFocusEffect(
    useCallback(() => {
      if (!usdcFeaturesEnabled || !isSepoliaConfigured) {
        return undefined;
      }

      refreshEvmBalances().catch(() => undefined);
      return undefined;
    }, [refreshEvmBalances, isSepoliaConfigured, usdcFeaturesEnabled])
  );

  // Check if vault health is below minimum (160%)
  const isLowHealth = vaultHealthPercentage > 0 && vaultHealthPercentage < 160;
  // No debt disables repay only. Borrow remains available when there is vault collateral.
  const hasNoDebt = vaultDebt === 0;
  const hasVaultCollateral = vaultCollateral > 0;
  const showAirdropWaitingPanel =
    airdropPending && !showAirdropModal && segwitBalance === 0 && taprootBalance === 0;
  const showVaultSettlementRecovery =
    settlementKind === 'borrow' &&
    settlementFaceValueUsd > 0 &&
    settlementRequestedPayoutAsset !== 'UNIT' &&
    !!onResumeVaultSettlementPress &&
    (settlementPhase === 'needs_retry' ||
      (settlementRequestedPayoutAsset === 'USDC' &&
        !settlementBridgeSendTxid &&
        (settlementPhase === 'building_bridge_send' ||
          settlementPhase === 'signing_bridge_send' ||
          settlementPhase === 'broadcasting_bridge_send' ||
          settlementPhase === 'waiting_bridge_fulfillment')) ||
      (settlementRequestedPayoutAsset === 'TURBOUNIT' &&
        !settlementCashuMintSendTxid &&
        (settlementPhase === 'building_turbo_send' ||
          settlementPhase === 'signing_turbo_send' ||
          settlementPhase === 'broadcasting_turbo_send' ||
          settlementPhase === 'waiting_turbo_mint')));
  const pendingWalletTxCount = React.useMemo(
    () =>
      Object.values(pendingTransactions).filter((transaction) => transaction.status === 'pending')
        .length,
    [pendingTransactions]
  );
  const showPendingTransactionPanel = isPendingVaultTx || pendingWalletTxCount > 0;
  const pendingTransactionTitle = isPendingVaultTx
    ? 'Vault transaction pending'
    : pendingWalletTxCount > 1
      ? `${pendingWalletTxCount} transactions pending`
      : 'Transaction pending';
  const pendingTransactionMessage = isPendingVaultTx
    ? 'Waiting for confirmation before another vault action can start.'
    : 'Waiting for confirmation. You can keep track in history.';

  return (
    <View style={styles.walletContainer} testID="wallet-screen">
      {/* Header with Total Balance label and Settings Icon */}
      <WalletHeader
        accountNumber={currentAccount + 1}
        onHistoryPress={onHistoryPress}
        onQRScanPress={onQRScanPress}
        onSettingsPress={onSettingsPress}
        styles={styles}
      />

      {/* Error Banner - Show when balance fetch fails */}
      <ErrorBanner errorMessage={balanceError} onRetry={handleRetryBalance} />

      {/* Total Balance Section - Xverse Style */}
      <TotalBalanceSection
        showTotalInBTC={showTotalInBTC}
        onToggle={handleToggleBTCDisplay}
        totalBTC={formatted.totalBTC}
        totalUSD={formatted.totalUSD}
        totalBalanceUSD={totalBalanceUSD}
        styles={{ ...styles, ...totalBalanceStyles }}
        largeBalanceStyle={responsiveLargeBalanceStyle || localStyles.largeBalanceAmount}
        testID="balance-section"
      />

      {/* Actions - Vault and Wallet Buttons */}
      <WalletActions
        isPendingVaultTx={isPendingVaultTx}
        isLowHealth={isLowHealth}
        hasNoDebt={hasNoDebt}
        hasVault={hasVault}
        hasVaultCollateral={hasVaultCollateral}
        onRepayPress={onRepayPress}
        onBorrowPress={onBorrowPress}
        onWithdrawPress={onWithdrawPress}
        onDepositPress={onDepositPress}
        onSendPress={onSendPress}
        onReceivePress={onReceivePress}
      />

      {showPendingTransactionPanel && (
        <TouchableOpacity
          style={localStyles.pendingTransactionPanel}
          onPress={onHistoryPress}
          testID="wallet-pending-transaction-panel"
          accessibilityRole="button"
          accessibilityLabel={pendingTransactionTitle}
          accessibilityHint="Opens transaction history"
        >
          <View style={localStyles.pendingTransactionIconWrap}>
            <ActivityIndicator color={COLORS.YELLOW} size="small" />
          </View>
          <View style={localStyles.pendingTransactionTextWrap}>
            <Text style={localStyles.pendingTransactionTitle}>{pendingTransactionTitle}</Text>
            <Text style={localStyles.pendingTransactionMessage} numberOfLines={2}>
              {pendingTransactionMessage}
            </Text>
          </View>
          <Icon name="transaction_history" size={18} color={COLORS.YELLOW} />
        </TouchableOpacity>
      )}

      {showAirdropWaitingPanel && (
        <View style={localStyles.airdropPanel} testID="airdrop-waiting-panel">
          <View style={localStyles.airdropPanelHeader}>
            <View style={localStyles.airdropIconWrap}>
              <ActivityIndicator size="small" color={COLORS.BITCOIN_ORANGE} />
            </View>
            <View style={localStyles.airdropPanelTextWrap}>
              <Text style={localStyles.airdropPanelTitle}>Waiting for BTC to appear</Text>
              <Text style={localStyles.airdropPanelMessage}>
                The faucet accepted the request. Your balance will update automatically once the
                network sees it.
              </Text>
            </View>
          </View>
        </View>
      )}

      {showVaultSettlementRecovery && (
        <TouchableOpacity
          style={localStyles.settlementRecoveryPanel}
          onPress={onResumeVaultSettlementPress}
          testID="vault-settlement-recovery-panel"
          accessibilityRole="button"
          accessibilityLabel="Resume vault settlement"
        >
          <View style={localStyles.settlementRecoveryIconWrap}>
            <Icon name="warning" size={18} color={COLORS.WARNING} />
          </View>
          <View style={localStyles.settlementRecoveryTextWrap}>
            <Text style={localStyles.settlementRecoveryTitle}>
              {settlementRequestedPayoutAsset === 'TURBOUNIT'
                ? 'TurboUNIT settlement needs retry'
                : 'USDC settlement needs retry'}
            </Text>
            <Text style={localStyles.settlementRecoveryMessage} numberOfLines={2}>
              {settlementError || 'Borrow recorded. Retry the settlement without borrowing again.'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Divider */}
      <View style={styles.balanceDivider} />

      {/* Scrollable Assets Container */}
      <ScrollView
        style={styles.assetsScrollContainer}
        contentContainerStyle={{ paddingBottom: s(ASSETS_SCROLL_BOTTOM_PADDING) }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.PRIMARY_BLUE}
            colors={[COLORS.PRIMARY_BLUE]}
          />
        }
      >
        {/* Vault Card */}
        <View style={{ paddingHorizontal: s(24), marginBottom: s(8) }}>
          <VaultCard
            hasVault={hasVault}
            vaultHealthColor={vaultHealthColor}
            vaultHealthPercentage={vaultHealthPercentage}
            vaultDebt={vaultDebt}
            vaultCollateral={vaultCollateral}
            onVaultPress={onVaultPress}
            onCreateVault={handleCreateVault}
            creatingVault={creatingVault}
            isPendingVaultTx={isPendingVaultTx}
            styles={vaultCardStyles}
          />
        </View>

        {/* Bitcoin Balance Card */}
        <View style={{ paddingHorizontal: s(24), marginBottom: s(8) }}>
          <AssetCard
            assetName="Bitcoin"
            assetLogo="btc_logo"
            amountLabel="btc_symbol"
            amountValue={btcTotals.btcValue}
            displayInBTC={showTotalInBTC}
            btcValue={btcTotals.btcValue}
            usdValue={btcTotals.usdValue}
            styles={assetCardStyles}
            onPress={handleBTCPress}
            testID="asset-card-btc"
          />
        </View>

        {/* UNIT (Runes + Ecash) Combined Card */}
        <View style={{ paddingHorizontal: s(24), marginBottom: s(8) }}>
          <AssetCard
            assetName="UNIT"
            assetLogo="unit_logo"
            amountLabel="unit_symbol"
            amountValue={unitTotals.formatted}
            displayInBTC={showTotalInBTC}
            btcValue={unitTotals.btcValue}
            usdValue={unitTotals.usdValue}
            styles={assetCardStyles}
            onPress={handleUNITPress}
            testID="asset-card-unit"
          />
        </View>

        {usdcFeaturesEnabled && (
          <>
            <View style={{ paddingHorizontal: s(24), marginBottom: s(8) }}>
              <AssetCard
                assetName="Sepolia ETH"
                assetLogo="eth_logo"
                amountValue={isEvmBalanceLoading && !evmBalances ? '...' : ethTotals.formatted}
                displayInBTC={showTotalInBTC}
                btcValue={ethTotals.btcValue}
                usdValue={ethTotals.usdValue}
                styles={assetCardStyles}
                onPress={handleEthPress}
                testID="asset-card-eth"
              />
            </View>
            <View style={{ paddingHorizontal: s(24), marginBottom: s(8) }}>
              <AssetCard
                assetName="Sepolia USDC"
                assetLogo="usdc_logo"
                amountValue={
                  isEvmBalanceLoading && !evmBalances ? '...' : `$${usdcTotals.formatted}`
                }
                displayInBTC={showTotalInBTC}
                btcValue={usdcTotals.btcValue}
                usdValue={usdcTotals.usdValue}
                styles={assetCardStyles}
                onPress={handleUsdcPress}
                testID="asset-card-usdc"
              />
            </View>
          </>
        )}
        {/* DUCAT Card - Non-clickable */}
        {showZeroAssets && (
          <View style={{ paddingHorizontal: s(24) }}>
            <AssetCard
              assetName="DUCAT"
              assetLogo="ducat_logo"
              amountValue="Đ 0.00"
              displayInBTC={showTotalInBTC}
              btcValue="0.00"
              usdValue="0.00"
              styles={assetCardStyles}
              isLast={true}
              customAmountStyle={localStyles.ducatAmount}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
});

const localStyles = StyleSheet.create({
  largeBalanceAmount: {
    fontSize: 32,
  },
  pendingTransactionPanel: {
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 228, 162, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(245, 228, 162, 0.26)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingTransactionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 228, 162, 0.12)',
  },
  pendingTransactionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  pendingTransactionTitle: {
    color: COLORS.YELLOW,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  pendingTransactionMessage: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  airdropPanel: {
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 184, 0, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.22)',
  },
  airdropPanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  airdropIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
  },
  airdropPanelTextWrap: {
    flex: 1,
  },
  airdropPanelTitle: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  airdropPanelMessage: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    lineHeight: 18,
  },
  settlementRecoveryPanel: {
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 184, 0, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.26)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settlementRecoveryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 0, 0.14)',
  },
  settlementRecoveryTextWrap: {
    flex: 1,
  },
  settlementRecoveryTitle: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  settlementRecoveryMessage: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 12,
    lineHeight: 16,
  },
  ducatAmount: {
    textAlign: 'left',
  },
});

export default WalletScreen;
