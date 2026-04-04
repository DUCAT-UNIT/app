import React,{ useCallback,useRef,useState } from 'react';
import { Animated,RefreshControl,ScrollView,StyleSheet,Text,TextStyle,TouchableOpacity,View,ViewStyle,Dimensions } from 'react-native';
import Icon from '../../components/icons';
import { AmountSlider } from '../../components/vaultAction/AmountSlider';
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
  const maxInvestable = vaultCollateral || 0;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

  const toggleLiquidations = useCallback(() => {
    if (showLiquidations) {
      // Collapse back to wallet (fast)
      Animated.timing(expandAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowLiquidations(false));
    } else {
      // Expand from bottom-left (spring for natural feel)
      setShowLiquidations(true);
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
          <ScrollView style={localStyles.liquidationsBody} contentContainerStyle={{ paddingBottom: s(80) }} showsVerticalScrollIndicator={false}>
            {/* Investment Amount - uses existing AmountSlider component */}
            <AmountSlider
              value={liqInvestAmount}
              maxValue={maxInvestable}
              onValueChange={setLiqInvestAmount}
              label="Amount to Invest"
              btcPrice={btcPrice ?? undefined}
              attachedBottom
              renderFooter={() => (
                <View style={localStyles.liqFooter}>
                  <View style={localStyles.liqInfoRow}>
                    <Text style={localStyles.liqInfoLabel}>You invest</Text>
                    <Text style={localStyles.liqInfoValue}>
                      {liquidationsShowBTC
                        ? `${liqInvestAmount.toFixed(8)} BTC`
                        : `$${((liqInvestAmount) * (btcPrice ?? 0)).toFixed(2)}`}
                    </Text>
                  </View>
                  <View style={localStyles.liqInfoRow}>
                    <Text style={localStyles.liqInfoLabel}>You get back</Text>
                    <Text style={localStyles.liqInfoValue}>
                      {liquidationsShowBTC
                        ? `${(liqInvestAmount * 1.15).toFixed(8)} BTC`
                        : `$${((liqInvestAmount * 1.15) * (btcPrice ?? 0)).toFixed(2)}`}
                    </Text>
                  </View>
                  <View style={[localStyles.liqInfoRow, { borderBottomWidth: 0 }]}>
                    <Text style={localStyles.liqProfitLabel}>Total profit</Text>
                    <Text style={localStyles.liqProfitValue}>
                      {liquidationsShowBTC
                        ? `+${(liqInvestAmount * 0.15).toFixed(8)} BTC`
                        : `+$${((liqInvestAmount * 0.15) * (btcPrice ?? 0)).toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              )}
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
                  {[
                    { debt: 3689.90, collateral: 0.06182657, claim: 1744.88 },
                    { debt: 4554.82, collateral: 0.07631896, claim: 2153.88 },
                    { debt: 4914.93, collateral: 0.08235282, claim: 2324.17 },
                    { debt: 5064.74, collateral: 0.08450776, claim: 2419.50 },
                    { debt: 4872.92, collateral: 0.07862603, claim: 2508.15 },
                  ].map((vault, i, arr) => (
                    <TouchableOpacity
                      key={`vault-${i}`}
                      style={[localStyles.liqVaultRow, i === arr.length - 1 && { borderBottomWidth: 0, paddingBottom: 16 }]}
                      onPress={() => setLiqVaultExpanded(false)}
                    >
                      <View style={localStyles.liqVaultRowCheck}>
                        <Text style={{ color: '#59AA8A', fontSize: 14 }}>✓</Text>
                      </View>
                      <View style={localStyles.liqVaultRowValue}>
                        <Icon name="unit_symbol" size={10} color={colors.text.secondary} />
                        <Text style={localStyles.liqVaultRowText}>{formatFiat(vault.debt, 2)}</Text>
                      </View>
                      <View style={localStyles.liqVaultRowValue}>
                        <Icon name="btc_symbol" size={10} color={colors.text.secondary} />
                        <Text style={localStyles.liqVaultRowText}>{vault.collateral.toFixed(6)}</Text>
                      </View>
                      <Text style={[localStyles.liqVaultRowText, { flex: 1, textAlign: 'center' }]}>${formatFiat(vault.claim, 2)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

            </View>

          </ScrollView>

          {/* Continue Button — fixed at bottom */}
          <View style={localStyles.liqContinueWrap}>
            <TouchableOpacity
              style={[localStyles.liqContinueBtn, liqInvestAmount <= 0 && { opacity: 0.4 }]}
              onPress={() => {/* TODO */}}
              testID="liquidation-continue-btn"
              disabled={liqInvestAmount <= 0}
            >
              <Text style={localStyles.liqContinueBtnText}>Continue</Text>
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
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 16,
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
  liqContinueWrap: {
    position: 'absolute',
    bottom: 32,
    left: 80,
    right: 16,
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
