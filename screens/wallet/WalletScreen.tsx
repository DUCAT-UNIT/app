import React,{ useCallback,useRef,useState } from 'react';
import { Animated,RefreshControl,ScrollView,StyleSheet,Text,TextStyle,TouchableOpacity,View,ViewStyle,Dimensions } from 'react-native';
import Icon from '../../components/icons';
import { AmountSlider } from '../../components/vaultAction/AmountSlider';
import { fetchLiquidatableVaults, formatValidatorResponse } from '../../services/liquidation/fetchVaults';
import { computeLiqMeta, getHealthValue } from '../../services/liquidation/calculations';
import { executeLiquidation } from '../../services/liquidation/execution';
import { COIN_SIZE } from '../../services/liquidation/constants';
import { fetchProtocolContract } from '../../services/vaultWallet';
import { VaultAPI } from '@ducat-unit/client-sdk';
import { colors,fonts,fontSizes,spacing } from '../../styles/theme';
import AssetCard,{ AssetCardStyles } from '../../components/wallet/AssetCard';
import ErrorBanner from '../../components/wallet/ErrorBanner';
import TotalBalanceSection,{ TotalBalanceSectionStyles } from '../../components/wallet/TotalBalanceSection';
import VaultCard,{ VaultCardStyles } from '../../components/wallet/VaultCard';
import WalletActions from '../../components/wallet/WalletActions';
import WalletHeader,{ WalletHeaderStyles } from '../../components/wallet/WalletHeader';
import { useCashu } from '../../contexts/CashuContext';
import { useWallet } from '../../contexts/WalletContext';
import { useBalance,useVaultData } from '../../contexts/WalletDataContext';
import { useAssetCardStyles } from '../../hooks/useAssetCardStyles';
import { useFormattedBalances } from '../../hooks/useFormattedBalances';
import { useResponsive } from '../../hooks/useResponsive';
import { useTotalBalanceStyles } from '../../hooks/useTotalBalanceStyles';
import { useVaultCardStyles } from '../../hooks/useVaultCardStyles';
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import { useDisplayPreferences } from "../../stores/displayPreferencesStore";
import { usePrice } from '../../stores/priceStore';
import { COLORS } from '../../theme';
import { formatBalance,formatFiat } from '../../utils/formatters';
import { getRunesAmount } from '../../utils/runesHelper';

// Constants
const VAULT_CREATION_RETRY_TIMEOUT = 2000;
// Minimum collateral for withdraw (in BTC) - covers taproot input (~58vB) + outputs (~86vB) + overhead at ~10sat/vB
const MIN_WITHDRAW_COLLATERAL = 0.00002; // ~2000 sats

/**
 * Style object for WalletScreen - combines all child component styles
 */
interface WalletScreenStyles extends WalletHeaderStyles, TotalBalanceSectionStyles, VaultCardStyles, AssetCardStyles {
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
  onAssetPress?: (asset: string) => void;
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
  onAssetPress,
  _sendAddressType,
  showZeroAssets,
  isPendingVaultTx = false,
}: WalletScreenProps): React.ReactElement {
  const { wallet: _wallet, currentAccount } = useWallet();
  const { segwitBalance, taprootBalance, runesBalance, balanceError, setBalanceError, fetchBalance } = useBalance();
  const { btcPrice } = usePrice();
  const { vaultData } = useVaultData();
  const { balance: cashuBalance, refresh: refreshCashu } = useCashu();
  const { showTotalInBTC, setShowTotalInBTC } = useDisplayPreferences();

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
    btcPrice,
    vaultData: vaultData as { totalDebt?: number; totalCollateral?: number; currentPrice?: number } | null,
  });

  // Responsive scaling (needs totalBalanceUSD)
  const { s } = useResponsive();
  const vaultCardStyles = useVaultCardStyles();
  const assetCardStyles = useAssetCardStyles();
  const { styles: totalBalanceStyles, largeBalanceStyle: responsiveLargeBalanceStyle } = useTotalBalanceStyles({ totalBalanceUSD });

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

  // Memoize formatted balances to avoid repeated toLocaleString() calls
  const formatted = useFormattedBalances({
    totalBalanceBTC,
    totalBalanceUSD,
    segwitBalance,
    taprootBalance,
    runesBalance: getRunesAmount(runesBalance),
    btcPrice,
  });

  // Liquidations screen state
  const [showLiquidations, setShowLiquidations] = useState(false);
  const [liquidationsShowBTC, setLiquidationsShowBTC] = useState(false);
  const [liqInvestAmount, setLiqInvestAmount] = useState(0);
  const [liqVaultExpanded, setLiqVaultExpanded] = useState(false);
  const [liqStep, setLiqStep] = useState<'input' | 'review' | 'processing' | 'success' | 'error'>('input');
  const [liqReviewTab, setLiqReviewTab] = useState<'overview' | 'howItWorks'>('overview');
  const [liqProcessingMsg, setLiqProcessingMsg] = useState('Preparing liquidation...');
  const [liqResultTxid, setLiqResultTxid] = useState<string | null>(null);
  const [liqError, setLiqError] = useState<string | null>(null);

  // Liquidation: use refs to avoid render loops in React.memo
  const liqVaultsRef = useRef<Array<{ vaultId: string; unit: number; btcInVault: number; claimAmountBtc: number; profitBtc: number; profitPercent: number; postTaxBtcInVault: number; unitSwapBtc: number }>>([]);
  const [liqVaultsLoaded, setLiqVaultsLoaded] = useState(false);
  const liqProfitRateRef = useRef(0.15); // Updated from SDK
  const maxInvestable = vaultCollateral || (liqVaultsRef.current.length > 0 ? liqVaultsRef.current.reduce((acc, v) => acc + v.claimAmountBtc, 0) : 0.06);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

  const toggleLiquidations = useCallback(() => {
    if (showLiquidations) {
      // Collapse back to wallet (fast)
      Animated.timing(expandAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowLiquidations(false);
        setLiqStep('input');
      });
    } else {
      // Expand from bottom-left (spring for natural feel)
      setShowLiquidations(true);
      // Fetch liquidatable vaults
      if (btcPrice) {
        (async () => {
          try {
            const [raw, contract] = await Promise.all([
              fetchLiquidatableVaults(),
              fetchProtocolContract(),
            ]);
            const currentPrice = btcPrice || 67000;
            const extended = formatValidatorResponse(raw);

            const mapped = extended.map(v => {
              try {
                const profile = VaultAPI.repo.liquidation.get_profile(
                  contract, v as any, v.thold_key, currentPrice
                );
                const meta = computeLiqMeta(profile);
                return {
                  vaultId: v.vaultId,
                  unit: v.unit,
                  btcInVault: v.btcInVault,
                  claimAmountBtc: meta.claimAmountBtc,
                  profitBtc: meta.profitBtc,
                  profitPercent: meta.profitPercent,
                  postTaxBtcInVault: meta.postTaxBtcInVault,
                  unitSwapBtc: v.unit / currentPrice,
                };
              } catch {
                // Fallback if SDK fails for this vault
                const deficit = Math.max(0, (1.6 * v.unit / currentPrice) - v.btcInVault);
                return {
                  vaultId: v.vaultId, unit: v.unit, btcInVault: v.btcInVault,
                  claimAmountBtc: deficit || v.btcInVault * 0.1,
                  profitBtc: deficit * 0.15, profitPercent: 15,
                  postTaxBtcInVault: v.btcInVault * 0.95,
                  unitSwapBtc: v.unit / currentPrice,
                };
              }
            }).filter(v => v.profitBtc > 0 && v.claimAmountBtc > 0)
              .sort((a, b) => b.profitPercent - a.profitPercent);

            if (mapped.length > 0) {
              liqProfitRateRef.current = mapped[0].profitPercent / 100;
            }
            liqVaultsRef.current = mapped;
            setLiqVaultsLoaded(true);
          } catch {
            // Fallback: just show basic data
            setLiqVaultsLoaded(true);
          }
        })();
      }
      Animated.spring(expandAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [showLiquidations, expandAnim]);

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
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchBalance, refreshCashu]);

  // Prevent multiple rapid clicks on create vault button
  const [creatingVault, setCreatingVault] = React.useState(false);
  const vaultCreationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCreateVault = React.useCallback(() => {
    if (creatingVault) return;
    setCreatingVault(true);
    onCreateVaultPress();
    // Reset after timeout to allow retry if needed
    vaultCreationTimeoutRef.current = setTimeout(() => setCreatingVault(false), VAULT_CREATION_RETRY_TIMEOUT);
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

  // Check if vault health is below minimum (160%)
  const isLowHealth = vaultHealthPercentage > 0 && vaultHealthPercentage < 160;
  // Check if there's no debt (can't repay/borrow)
  const hasNoDebt = vaultDebt === 0;
  // Check if total wallet BTC is too low for withdraw (not vault collateral)
  const totalWalletBTC = (segwitBalance || 0) + (taprootBalance || 0);
  // Check if wallet has no funds to send (neither BTC nor UNIT)
  const totalUnitBalance = getRunesAmount(runesBalance) + ((cashuBalance || 0) / 100);
  const hasInsufficientFunds = totalWalletBTC < MIN_WITHDRAW_COLLATERAL && totalUnitBalance <= 0;

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
        onToggle={() => setShowTotalInBTC(!showTotalInBTC)}
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
        hasInsufficientFunds={hasInsufficientFunds}
        onRepayPress={onRepayPress}
        onBorrowPress={onBorrowPress}
        onSendPress={onSendPress}
        onReceivePress={onReceivePress}
      />

      {/* Divider */}
      <View style={styles.balanceDivider} />

      {/* Scrollable Assets Container */}
      <ScrollView
        style={styles.assetsScrollContainer}
        contentContainerStyle={{ paddingBottom: s(16) }}
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
            styles={vaultCardStyles}
          />
        </View>

        {/* Bitcoin Balance Card */}
        <View style={{ paddingHorizontal: s(24), marginBottom: s(8) }}>
          <AssetCard
            assetName="Bitcoin"
            assetLogo="btc_logo"
            amountLabel="btc_symbol"
            amountValue={formatted.segwitBTC}
            displayInBTC={showTotalInBTC}
            btcValue={formatted.segwitBTC}
            usdValue={formatted.segwitUSD}
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

      {/* Liquidations Screen - circular reveal from bottom-left FAB */}
      {showLiquidations && (
        <Animated.View
          style={[
            localStyles.liquidationsScreen,
            {
              opacity: expandAnim.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0, 1, 1],
              }),
              // Circular expand: scale from bottom-left origin
              transform: [
                { translateX: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-screenWidth * 0.5, 0],
                })},
                { translateY: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [screenHeight * 0.5, 0],
                })},
                { scale: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                })},
              ],
            },
          ]}
        >
          <View style={localStyles.liquidationsHeader}>
            <Text style={localStyles.liquidationsTitle}>Liquidations</Text>
            <TouchableOpacity
              style={localStyles.currencyToggle}
              onPress={() => setLiquidationsShowBTC(!liquidationsShowBTC)}
              accessibilityRole="switch"
              accessibilityLabel={liquidationsShowBTC ? 'Show in USD' : 'Show in BTC'}
            >
              <View style={[
                localStyles.currencyToggleTrack,
                liquidationsShowBTC && localStyles.currencyToggleTrackActive,
              ]}>
                <View style={[
                  localStyles.currencyToggleThumb,
                  liquidationsShowBTC && localStyles.currencyToggleThumbActive,
                ]}>
                  <Text style={localStyles.currencyToggleActiveText}>
                    {liquidationsShowBTC ? '₿' : '$'}
                  </Text>
                </View>
                <Text style={[
                  localStyles.currencyToggleLabel,
                  liquidationsShowBTC ? localStyles.currencyToggleLabelLeft : localStyles.currencyToggleLabelRight,
                ]}>
                  {liquidationsShowBTC ? '$' : '₿'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          {(liqStep === 'processing' || liqStep === 'success' || liqStep === 'error') ? (
          <View style={localStyles.liqStatusScreen}>
            {liqStep === 'processing' && (
              <>
                <View style={localStyles.liqStatusIcon}>
                  <Icon name="liquidations" size={s(48)} color={colors.brand.primary} />
                </View>
                <Text style={localStyles.liqStatusTitle}>Processing Liquidation</Text>
                <Text style={localStyles.liqStatusSub}>{liqProcessingMsg}</Text>
              </>
            )}
            {liqStep === 'success' && (
              <>
                <View style={[localStyles.liqStatusIcon, { backgroundColor: '#1a3a2a' }]}>
                  <Text style={{ fontSize: 32 }}>✓</Text>
                </View>
                <Text style={localStyles.liqStatusTitle}>Liquidation Claimed</Text>
                <Text style={localStyles.liqStatusSub}>
                  Your vault has been updated with the liquidated collateral and debt.
                </Text>
                {liqResultTxid && (
                  <Text style={[localStyles.liqStatusSub, { fontSize: 11, marginTop: 8 }]}>
                    TX: {liqResultTxid.substring(0, 16)}...
                  </Text>
                )}
              </>
            )}
            {liqStep === 'error' && (
              <>
                <View style={[localStyles.liqStatusIcon, { backgroundColor: '#3a1a1a' }]}>
                  <Text style={{ fontSize: 32 }}>✕</Text>
                </View>
                <Text style={localStyles.liqStatusTitle}>Liquidation Failed</Text>
                <Text style={localStyles.liqStatusSub}>{liqError || 'An error occurred'}</Text>
              </>
            )}
          </View>
          ) : liqStep === 'review' ? (() => {
          // Compute review values from investment amount
          const price = btcPrice ?? 0;
          const profitRate = liqProfitRateRef.current; // From SDK liquid_quote.profit_margin
          const depositRate = 0.32;
          const swapRate = 0.68;
          const liqProfitBtc = liqInvestAmount * profitRate;
          const liqDepositBtc = liqInvestAmount * depositRate;
          const liqSwapBtc = liqInvestAmount * swapRate;
          const liqTotalBtc = liqInvestAmount;
          const liqReturnBtc = liqInvestAmount + liqProfitBtc;
          const liqCollateralBtc = liqInvestAmount * 0.76;
          const liqSwapUnit = liqSwapBtc * price;
          const liqProfitPct = Math.round(profitRate * 100);
          const fmt = (v: number, d = 8) => v.toFixed(d);
          const fmtUsd = (v: number) => `$${(v * price).toFixed(2)}`;
          const fmtBtcOrUsd = (v: number) => liquidationsShowBTC ? `${fmt(v)} BTC` : fmtUsd(v);

          return (<>
          {/* Tab Bar */}
          <View style={localStyles.liqTabBar}>
            <TouchableOpacity
              style={[localStyles.liqTab, liqReviewTab === 'overview' && localStyles.liqTabActive]}
              onPress={() => setLiqReviewTab('overview')}
            >
              <Text style={[localStyles.liqTabText, liqReviewTab === 'overview' && localStyles.liqTabTextActive]}>⚡ Quick Overview</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[localStyles.liqTab, liqReviewTab === 'howItWorks' && localStyles.liqTabActive]}
              onPress={() => setLiqReviewTab('howItWorks')}
            >
              <Text style={[localStyles.liqTabText, liqReviewTab === 'howItWorks' && localStyles.liqTabTextActive]}>ⓘ How it works</Text>
            </TouchableOpacity>
          </View>

          {liqReviewTab === 'overview' ? (
          <ScrollView style={localStyles.liquidationsBody} contentContainerStyle={{ paddingBottom: s(120) }} showsVerticalScrollIndicator={false}>
            {/* Profit (upper) + Breakdown (lower) — two-tone card */}
            <View style={[localStyles.liqVaultOuter, { marginTop: 0 }]}>
              {/* Upper: Profit */}
              <View style={localStyles.liqReviewUpper}>
                <View style={localStyles.liqReviewProfitHeader}>
                  <Text style={localStyles.liqReviewProfitTitle}>Total profit</Text>
                  <View style={localStyles.liqReviewProfitBadge}>
                    <Text style={localStyles.liqReviewProfitBadgeText}>+15%</Text>
                  </View>
                </View>
                <Text style={localStyles.liqReviewProfitAmount}>
                  {liquidationsShowBTC
                    ? `+${fmt(liqProfitBtc)} BTC`
                    : `+$${(liqProfitBtc * price).toFixed(2)}`}
                </Text>
                <Text style={localStyles.liqReviewProfitSub}>
                  {liquidationsShowBTC
                    ? `$ ${(liqProfitBtc * price).toFixed(2)}`
                    : `₿ ${fmt(liqProfitBtc)}`}
                </Text>
              </View>

              {/* Lower: Breakdown */}
              <View style={localStyles.liqReviewLower}>
                <View style={localStyles.liqReviewRow}>
                  <Text style={localStyles.liqReviewRowLabel}>Your deposit</Text>
                  <View>
                    <Text style={localStyles.liqReviewRowValue}>{fmt(liqDepositBtc)} BTC</Text>
                    <Text style={localStyles.liqReviewRowSub}>$ {(liqDepositBtc * price).toFixed(2)}</Text>
                  </View>
                </View>
                <View style={localStyles.liqReviewDivider} />
                <View style={localStyles.liqReviewRow}>
                  <Text style={[localStyles.liqReviewRowLabel, { color: colors.brand.primary }]}>You swap to UNIT</Text>
                  <View>
                    <Text style={localStyles.liqReviewRowValue}>{fmt(liqSwapBtc)} BTC</Text>
                    <Text style={localStyles.liqReviewRowSub}>$ {liqSwapUnit.toFixed(2)}</Text>
                  </View>
                </View>
                <View style={localStyles.liqReviewDivider} />
                <View style={localStyles.liqReviewRow}>
                  <View>
                    <Text style={localStyles.liqReviewRowLabel}>Total BTC required</Text>
                    <Text style={[localStyles.liqReviewRowSub, { textAlign: 'left' }]}>from your vault</Text>
                  </View>
                  <View>
                    <Text style={[localStyles.liqReviewRowValue, { fontFamily: fonts.bold }]}>{liqInvestAmount.toFixed(8)} BTC</Text>
                    <Text style={localStyles.liqReviewRowSub}>$ {(liqInvestAmount * (btcPrice ?? 0)).toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* You get in your vault */}
            <View style={localStyles.liqReviewCard}>
              <View style={localStyles.liqReviewGetHeader}>
                <Icon name="vault_logo" size={s(20)} color={colors.text.secondary} />
                <Text style={localStyles.liqReviewGetTitle}>You get in your vault</Text>
              </View>
              <View style={localStyles.liqReviewGetGrid}>
                <View style={localStyles.liqReviewGetBox}>
                  <Text style={localStyles.liqReviewGetBoxValue}>{fmt(liqReturnBtc, 6)} BTC</Text>
                  <Text style={localStyles.liqReviewGetBoxSub}>{fmt(liqCollateralBtc, 6)} collateral</Text>
                  <Text style={localStyles.liqReviewGetBoxSub}>{(liqInvestAmount * 0.32).toFixed(6)} deposit</Text>
                </View>
                <Text style={localStyles.liqReviewGetPlus}>+</Text>
                <View style={[localStyles.liqReviewGetBox, { borderColor: colors.brand.primary }]}>
                  <Text style={localStyles.liqReviewGetBoxValue}>{liqSwapUnit.toFixed(2)} UNIT</Text>
                  <Text style={localStyles.liqReviewGetBoxSub}>repayable debt</Text>
                </View>
              </View>
            </View>

            {/* You get in your wallet */}
            <View style={localStyles.liqReviewCard}>
              <View style={localStyles.liqReviewGetHeader}>
                <Icon name="wallet" size={s(20)} color={colors.text.secondary} />
                <Text style={localStyles.liqReviewGetTitle}>You get in your wallet</Text>
              </View>
              <View style={[localStyles.liqReviewGetBox, { borderColor: colors.brand.primary, alignSelf: 'center', width: '60%' }]}>
                <Text style={localStyles.liqReviewGetBoxValue}>{liqSwapUnit.toFixed(2)} UNIT</Text>
                <Text style={localStyles.liqReviewGetBoxSub}>to pay the vault debt</Text>
              </View>
            </View>
          </ScrollView>
          ) : (
          /* How it works tab */
          <ScrollView style={localStyles.liquidationsBody} contentContainerStyle={{ paddingBottom: s(120) }} showsVerticalScrollIndicator={false}>
            {/* Description */}
            <View style={localStyles.liqReviewCard}>
              <Text style={localStyles.liqHowDesc}>
                You deposit BTC to restore an unhealthy vault to health. In return, you receive the liquidated vault's collateral and debt to your vault, including a{' '}
                <Text style={{ color: '#59AA8A', fontFamily: fonts.bold }}>15% profit</Text>
                {' '}for taking on the liquidation.
              </Text>
            </View>

            {/* What happens next */}
            <View style={localStyles.liqReviewCard}>
              <Text style={localStyles.liqHowSectionTitle}>What happens next?</Text>
              {[
                { num: '1', title: 'Your vault gets updated', desc: `Added to your vault: ${fmt(liqReturnBtc, 6)} BTC + ${liqSwapUnit.toFixed(2)} UNIT debt.`, auto: true },
                { num: '2', title: 'Receive UNIT in wallet', desc: `You receive ${liqSwapUnit.toFixed(2)} UNIT in your wallet to repay the debt.`, auto: true },
                { num: '3', title: 'Repay your vault debt', desc: `Use the ${liqSwapUnit.toFixed(2)} UNIT in your wallet to clear the debt in your vault.`, auto: false },
                { num: '4', title: 'Withdraw your profit', desc: `After clearing the debt, withdraw your ${fmt(liqReturnBtc, 6)} BTC (includes the ${fmt(liqProfitBtc, 6)} BTC profit).`, auto: false },
              ].map((step) => (
                <View key={step.num} style={localStyles.liqHowStep}>
                  <View style={localStyles.liqHowStepNum}>
                    <Text style={localStyles.liqHowStepNumText}>{step.num}</Text>
                  </View>
                  <View style={localStyles.liqHowStepContent}>
                    <Text style={localStyles.liqHowStepTitle}>{step.title}</Text>
                    <Text style={localStyles.liqHowStepDesc}>{step.desc}</Text>
                  </View>
                  <Text style={[localStyles.liqHowStepBadge, step.auto ? { color: '#59AA8A' } : { color: colors.text.secondary }]}>
                    {step.auto ? 'Automatic ⚡' : 'Manual\n(Optional)'}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
          )}
          </>);
          })() : (
          <ScrollView style={localStyles.liquidationsBody} contentContainerStyle={{ paddingBottom: s(80) }} showsVerticalScrollIndicator={false}>
            {/* Investment Amount - uses existing AmountSlider component */}
            <AmountSlider
              value={liqInvestAmount}
              maxValue={maxInvestable}
              onValueChange={(val: number) => {
                setLiqInvestAmount(val);
              }}
              label="Amount to Invest"
              btcPrice={btcPrice ?? undefined}
              attachedBottom
              renderFooter={() => {
                const profitBtc = liqInvestAmount * liqProfitRateRef.current;
                const returnBtc = liqInvestAmount + profitBtc;
                const price = btcPrice ?? 0;
                return (
                <View style={localStyles.liqFooter}>
                  <View style={localStyles.liqInfoRow}>
                    <Text style={localStyles.liqInfoLabel}>You invest</Text>
                    <Text style={localStyles.liqInfoValue}>
                      {liquidationsShowBTC ? `${liqInvestAmount.toFixed(8)} BTC` : `$${(liqInvestAmount * price).toFixed(2)}`}
                    </Text>
                  </View>
                  <View style={localStyles.liqInfoRow}>
                    <Text style={localStyles.liqInfoLabel}>You get back</Text>
                    <Text style={localStyles.liqInfoValue}>
                      {liquidationsShowBTC ? `${returnBtc.toFixed(8)} BTC` : `$${(returnBtc * price).toFixed(2)}`}
                    </Text>
                  </View>
                  <View style={[localStyles.liqInfoRow, { borderBottomWidth: 0 }]}>
                    <Text style={localStyles.liqProfitLabel}>Total profit</Text>
                    <Text style={localStyles.liqProfitValue}>
                      {liquidationsShowBTC ? `+${profitBtc.toFixed(8)} BTC` : `+$${(profitBtc * price).toFixed(2)}`}
                    </Text>
                  </View>
                </View>
                );
              }}
            />

            {/* Vault Selector — upper card + lower table */}
            <View style={localStyles.liqVaultOuter}>
              {/* Upper: Vaults label */}
              <TouchableOpacity
                style={localStyles.liqVaultUpper}
                onPress={() => setLiqVaultExpanded(!liqVaultExpanded)}
                activeOpacity={1}
                testID="liq-vault-selector"
              >
                <View style={localStyles.liqVaultLeft}>
                  <Icon name="vault_logo" size={s(18)} color={colors.text.secondary} />
                  <Text style={localStyles.liqVaultName}>Vaults</Text>
                </View>
                <Text style={localStyles.liqVaultChevron}>{liqVaultExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {/* Lower: Table */}
              {liqVaultExpanded && (
                <View style={localStyles.liqVaultLower}>
                  <View style={localStyles.liqVaultTableHeader}>
                    <View style={localStyles.liqVaultRowCheck} />
                    <Text style={localStyles.liqVaultColHeader}>Debt</Text>
                    <Text style={localStyles.liqVaultColHeader}>Collateral</Text>
                    <Text style={localStyles.liqVaultColHeader}>Claim</Text>
                  </View>
                  {(liqVaultsRef.current.length > 0 ? liqVaultsRef.current : [
                    { unit: 3689.90, btcInVault: 0.06182657, claimAmountBtc: 0.01744, vaultId: 'mock-1', postTaxBtcInVault: 0.058, unitSwapBtc: 0.045, profitBtc: 0.004, profitPercent: 15, profitPercentPrecised: 15 },
                  ]).map((vault, i, arr) => (
                    <TouchableOpacity
                      key={vault.vaultId || `vault-${i}`}
                      style={[localStyles.liqVaultRow, i === arr.length - 1 && { borderBottomWidth: 0, paddingBottom: 16 }]}
                      onPress={() => setLiqVaultExpanded(false)}
                    >
                      <View style={localStyles.liqVaultRowCheck}>
                        <Text style={{ color: '#59AA8A', fontSize: 14 }}>✓</Text>
                      </View>
                      <View style={localStyles.liqVaultRowValue}>
                        <Icon name="unit_symbol" size={10} color={colors.text.secondary} />
                        <Text style={localStyles.liqVaultRowText}>{formatFiat(vault.unit, 2)}</Text>
                      </View>
                      <View style={localStyles.liqVaultRowValue}>
                        <Icon name="btc_symbol" size={10} color={colors.text.secondary} />
                        <Text style={localStyles.liqVaultRowText}>{vault.btcInVault.toFixed(6)}</Text>
                      </View>
                      <Text style={[localStyles.liqVaultRowText, { flex: 1, textAlign: 'center' }]}>${formatFiat(vault.claimAmountBtc * (btcPrice ?? 0), 2)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

            </View>

          </ScrollView>
          )}

          {/* Bottom Button — fixed */}
          <View style={localStyles.liqContinueWrap}>
            <TouchableOpacity
              style={[localStyles.liqContinueBtn, liqStep === 'input' && liqInvestAmount <= 0 && { opacity: 0.5 }]}
              onPress={async () => {
                if (liqStep === 'input') {
                  setLiqStep('review');
                } else if (liqStep === 'review') {
                  setLiqStep('processing');
                  setLiqProcessingMsg('Connecting to oracle...');
                  try {
                    const result = await executeLiquidation({
                      selectedVaults: liqVaultsRef.current as any,
                      vaultPubkey: _wallet?.taprootPubkey || '',
                      btcInVault: vaultCollateral || 0,
                      unitDebt: vaultDebt || 0,
                      feeRate: 1,
                      signPsbts: async (psbts) => psbts, // TODO: real signing
                    });
                    if (result.success) {
                      setLiqResultTxid(result.txid || null);
                      setLiqStep('success');
                    } else {
                      setLiqError(result.error || 'Liquidation failed');
                      setLiqStep('error');
                    }
                  } catch (err: unknown) {
                    setLiqError(err instanceof Error ? err.message : 'Liquidation failed');
                    setLiqStep('error');
                  }
                } else if (liqStep === 'success' || liqStep === 'error') {
                  setLiqStep('input');
                  setLiqError(null);
                  setLiqResultTxid(null);
                }
              }}
              testID="liquidation-continue-btn"
              disabled={(liqStep === 'input' && liqInvestAmount <= 0) || liqStep === 'processing'}
            >
              <Text style={localStyles.liqContinueBtnText}>
                {liqStep === 'processing' ? 'Processing...' :
                 liqStep === 'success' ? 'Done' :
                 liqStep === 'error' ? 'Try Again' :
                 liqStep === 'review' ? 'Claim Liquidation' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* FAB - toggles between liquidations and vault icon */}
      <TouchableOpacity
        style={[localStyles.liquidationsFab, { bottom: s(38), left: s(16), width: s(52), height: s(52), borderRadius: s(26) }]}
        onPress={toggleLiquidations}
        testID="liquidations-fab"
        accessibilityRole="button"
        accessibilityLabel={showLiquidations ? 'Back to wallet' : 'Liquidations'}
      >
        <Icon
          name={showLiquidations ? 'vault' : 'liquidations'}
          size={s(24)}
          color="#FFFFFF"
        />
      </TouchableOpacity>
    </View>
  );
});

const localStyles = StyleSheet.create({
  largeBalanceAmount: {
    fontSize: 32,
  },
  ducatAmount: {
    textAlign: 'left',
  },
  liquidationsFab: {
    position: 'absolute',
    backgroundColor: '#2A2A2E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  liquidationsScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.primary,
    zIndex: 50,
    borderRadius: 0,
    overflow: 'hidden',
  },
  liquidationsHeader: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liquidationsTitle: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  currencyToggle: {
    padding: 4,
  },
  currencyToggleTrack: {
    width: 64,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2A2E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  currencyToggleTrackActive: {
    flexDirection: 'row-reverse',
  },
  currencyToggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyToggleThumbActive: {
    backgroundColor: '#F7931A',
  },
  currencyToggleActiveText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  currencyToggleLabel: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text.secondary,
    position: 'absolute',
  },
  currencyToggleLabelLeft: {
    left: 10,
  },
  currencyToggleLabelRight: {
    right: 10,
  },
  liquidationsBody: {
    flex: 1,
    paddingHorizontal: 16,
  },
  liqVaultOuter: {
    marginTop: 12,
    marginBottom: 16,
  },
  liqVaultUpper: {
    backgroundColor: '#1D1C21',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#28272C',
    zIndex: 2,
    elevation: 3,
  },
  liqVaultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liqVaultName: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  liqVaultChevron: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  liqVaultLower: {
    backgroundColor: '#28272C',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -16,
    paddingTop: 24,
    paddingBottom: 4,
    zIndex: 1,
  },
  liqVaultTableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2E',
  },
  liqVaultColHeader: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  liqVaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  liqVaultRowCheck: {
    width: 20,
    alignItems: 'center',
  },
  liqVaultRowValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  liqVaultRowText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  liqFooter: {
    paddingTop: 8,
  },
  liqInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2E',
  },
  liqInfoLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  liqInfoValue: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  liqProfitLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: '#59AA8A',
  },
  liqProfitValue: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: '#59AA8A',
  },
  liqReviewCard: {
    backgroundColor: '#1D1C21',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#28272C',
    padding: 14,
    marginBottom: 8,
    marginTop: 0,
  },
  liqReviewProfitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liqReviewProfitTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  liqReviewProfitBadge: {
    backgroundColor: '#59AA8A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liqReviewProfitBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  liqReviewProfitAmount: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: '#59AA8A',
    textAlign: 'center',
    marginBottom: 2,
  },
  liqReviewProfitSub: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  liqTabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1D1C21',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#28272C',
    alignItems: 'stretch',
  },
  liqTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  liqTabActive: {
    backgroundColor: '#28272C',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  liqTabText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  liqTabTextActive: {
    color: colors.text.primary,
  },
  liqHowFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  liqHowFlowItem: {
    backgroundColor: '#28272C',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  liqHowFlowPlus: {
    color: colors.text.secondary,
    fontSize: 18,
    marginHorizontal: 8,
  },
  liqHowFlowTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginTop: 4,
  },
  liqHowFlowSub: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: '#D04C68',
    marginTop: 2,
  },
  liqHowArrow: {
    textAlign: 'center',
    color: colors.text.secondary,
    fontSize: 16,
    marginVertical: 6,
  },
  liqHowDesc: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  liqHowSectionTitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: 12,
  },
  liqHowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28272C',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  liqHowStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1D1C21',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  liqHowStepNumText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.brand.primary,
  },
  liqHowStepContent: {
    flex: 1,
  },
  liqHowStepTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  liqHowStepDesc: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginTop: 2,
    marginRight: 50,
  },
  liqHowStepBadge: {
    fontSize: 10,
    fontFamily: fonts.medium,
    textAlign: 'right',
    width: 65,
  },
  liqReviewUpper: {
    backgroundColor: '#1D1C21',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#28272C',
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 2,
    elevation: 3,
  },
  liqReviewLower: {
    backgroundColor: '#28272C',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -16,
    paddingTop: 22,
    paddingHorizontal: 14,
    paddingBottom: 12,
    zIndex: 1,
  },
  liqReviewDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 10,
  },
  liqReviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liqReviewRowLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  liqReviewRowValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
    textAlign: 'right',
  },
  liqReviewRowSub: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: 2,
  },
  liqReviewGetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  liqReviewGetTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  liqReviewGetGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liqReviewGetBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#28272C',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  liqReviewGetPlus: {
    color: colors.text.secondary,
    fontSize: 18,
    marginHorizontal: 6,
  },
  liqReviewGetBoxValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  liqReviewGetBoxSub: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  liqStatusScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  liqStatusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1D1C21',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  liqStatusTitle: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  liqStatusSub: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  liqContinueWrap: {
    position: 'absolute',
    bottom: 38,
    left: 80,
    right: 16,
    zIndex: 100,
  },
  liqContinueBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  liqContinueBtnText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    padding: 0,
    margin: 0,
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 62,
  },
  actionButtonIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#DDDDDD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  buttonIcon: {
    fontSize: 24,
    color: COLORS.DARK_BG,
    fontWeight: '200',
  },
  actionButtonLabel: {
    fontSize: 13,
    color: COLORS.WHITE,
    fontWeight: '600',
  },
});

export default WalletScreen;
