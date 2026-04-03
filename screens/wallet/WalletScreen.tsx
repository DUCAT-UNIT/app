import React,{ useCallback,useState } from 'react';
import { RefreshControl,ScrollView,StyleSheet,TextStyle,View,ViewStyle } from 'react-native';
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
