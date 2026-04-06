import React, { useCallback, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, TextStyle, TouchableOpacity, View, ViewStyle, Dimensions } from 'react-native';
import Icon from '../../components/icons';
import LiquidationScreen from '../../components/liquidation/LiquidationScreen';
import { colors } from '../../styles/theme';
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
  const expandAnim = useRef(new Animated.Value(0)).current;
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

  const handleLiquidationClose = useCallback(() => {
    Animated.timing(expandAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowLiquidations(false);
    });
  }, [expandAnim]);

  const toggleLiquidations = useCallback(() => {
    if (showLiquidations) {
      handleLiquidationClose();
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
  }, [showLiquidations, expandAnim, handleLiquidationClose]);

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
          <LiquidationScreen
            btcPrice={btcPrice}
            segwitBalance={segwitBalance}
            taprootBalance={taprootBalance}
            vaultCollateral={vaultCollateral}
            vaultDebt={vaultDebt}
            hasVault={hasVault}
            wallet={_wallet}
            vaultData={vaultData}
            visible={showLiquidations}
            onClose={handleLiquidationClose}
            onToggle={toggleLiquidations}
          />
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
});

export default WalletScreen;
