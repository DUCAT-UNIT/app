import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useWallet } from '../../contexts/WalletContext';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../stores/priceStore';
import { useVaultData } from '../../contexts/WalletDataContext';
import { useCashu } from '../../contexts/CashuContext';
import { useDisplayPreferences } from "../../stores/displayPreferencesStore";
import { useNotificationStore } from '../../stores/notificationStore';
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import { useFormattedBalances } from '../../hooks/useFormattedBalances';
import { useResponsive } from '../../hooks/useResponsive';
import { useVaultCardStyles } from '../../hooks/useVaultCardStyles';
import { useAssetCardStyles } from '../../hooks/useAssetCardStyles';
import { useTotalBalanceStyles } from '../../hooks/useTotalBalanceStyles';
import { COLORS } from '../../theme';
import TotalBalanceSection, { TotalBalanceSectionStyles } from '../../components/wallet/TotalBalanceSection';
import VaultCard, { VaultCardStyles } from '../../components/wallet/VaultCard';
import AssetCard, { AssetCardStyles } from '../../components/wallet/AssetCard';
import WalletHeader, { WalletHeaderStyles } from '../../components/wallet/WalletHeader';
import ErrorBanner from '../../components/wallet/ErrorBanner';
import { getRunesAmount } from '../../utils/runesHelper';
import { formatFiat, formatBalance } from '../../utils/formatters';

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
  const { balance: cashuBalance } = useCashu();
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
  const { s, sf } = useResponsive();
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
    return {
      formatted: formatFiat(totalUnit),
      btcValue: formatBalance(totalUnit / 100_000_000),
      usdValue: totalUnit,
    };
  }, [runesBalance, cashuBalance]);

  // Memoize formatted balances to avoid repeated toLocaleString() calls
  const formatted = useFormattedBalances({
    totalBalanceBTC,
    totalBalanceUSD,
    segwitBalance,
    taprootBalance,
    runesBalance: getRunesAmount(runesBalance),
    btcPrice,
  });

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

  // Handler for disabled vault action buttons - shows popup with haptic feedback
  const handleDisabledPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'Transaction pending',
      description: 'Please wait for the current vault transaction to confirm',
      type: 'warning',
    });
  }, []);

  // Handler for low health - shows popup with haptic feedback
  const handleLowHealthPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'Health too low',
      description: 'Vault health must be above 160% to withdraw or borrow',
      type: 'warning',
    });
  }, []);

  // Handler for no debt (can't repay/borrow) - shows popup with haptic feedback
  const handleNoDebtPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'No debt',
      description: 'You have no UNIT debt to repay or borrow against',
      type: 'warning',
    });
  }, []);

  // Handler for insufficient funds to withdraw - shows popup with haptic feedback
  const handleInsufficientFundsPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    useNotificationStore.getState().showSnackbar({
      title: 'No funds available',
      description: 'You need BTC or UNIT in your wallet to send',
      type: 'warning',
    });
  }, []);

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
      />

      {/* Actions - Vault and Wallet Buttons - Scaled with s() */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginLeft: s(24), gap: s(12) }} testID="wallet-actions">
        <TouchableOpacity style={{ alignItems: 'center', opacity: (isPendingVaultTx || hasNoDebt) ? 0.5 : 1 }} onPress={isPendingVaultTx ? handleDisabledPress : hasNoDebt ? handleNoDebtPress : onRepayPress} testID="wallet-repay-btn">
          <View style={{ width: s(50), height: s(50), borderRadius: s(8), backgroundColor: (isPendingVaultTx || hasNoDebt) ? '#888888' : '#DDDDDD', justifyContent: 'center', alignItems: 'center', marginBottom: s(2) }}>
            <Text style={{ fontSize: sf(24), color: COLORS.DARK_BG, fontWeight: '200' }}>↓</Text>
          </View>
          <Text style={{ fontSize: sf(13), color: (isPendingVaultTx || hasNoDebt) ? COLORS.SECONDARY_TEXT : COLORS.WHITE, fontWeight: '600' }}>Repay</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ alignItems: 'center', opacity: (isPendingVaultTx || isLowHealth || hasNoDebt) ? 0.5 : 1 }} onPress={isPendingVaultTx ? handleDisabledPress : hasNoDebt ? handleNoDebtPress : isLowHealth ? handleLowHealthPress : onBorrowPress} testID="wallet-borrow-btn">
          <View style={{ width: s(50), height: s(50), borderRadius: s(8), backgroundColor: (isPendingVaultTx || isLowHealth || hasNoDebt) ? '#888888' : '#DDDDDD', justifyContent: 'center', alignItems: 'center', marginBottom: s(2) }}>
            <Text style={{ fontSize: sf(24), color: COLORS.DARK_BG, fontWeight: '200' }}>↑</Text>
          </View>
          <Text style={{ fontSize: sf(13), color: (isPendingVaultTx || isLowHealth || hasNoDebt) ? COLORS.SECONDARY_TEXT : COLORS.WHITE, fontWeight: '600' }}>Borrow</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ alignItems: 'center', opacity: hasInsufficientFunds ? 0.5 : 1 }} onPress={hasInsufficientFunds ? handleInsufficientFundsPress : onSendPress} testID="wallet-withdraw-btn">
          <View style={{ width: s(50), height: s(50), borderRadius: s(8), backgroundColor: hasInsufficientFunds ? '#888888' : '#DDDDDD', justifyContent: 'center', alignItems: 'center', marginBottom: s(2) }}>
            <Text style={{ fontSize: sf(24), color: COLORS.DARK_BG, fontWeight: '200' }}>-</Text>
          </View>
          <Text style={{ fontSize: sf(13), color: hasInsufficientFunds ? COLORS.SECONDARY_TEXT : COLORS.WHITE, fontWeight: '600' }}>Withdraw</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ alignItems: 'center' }} onPress={onReceivePress} testID="wallet-deposit-btn">
          <View style={{ width: s(50), height: s(50), borderRadius: s(8), backgroundColor: '#DDDDDD', justifyContent: 'center', alignItems: 'center', marginBottom: s(2) }}>
            <Text style={{ fontSize: sf(24), color: COLORS.DARK_BG, fontWeight: '200' }}>+</Text>
          </View>
          <Text style={{ fontSize: sf(13), color: COLORS.WHITE, fontWeight: '600' }}>Deposit</Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.balanceDivider} />

      {/* Scrollable Assets Container */}
      <ScrollView
        style={styles.assetsScrollContainer}
        contentContainerStyle={{ paddingBottom: s(16) }}
        showsVerticalScrollIndicator={false}
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
