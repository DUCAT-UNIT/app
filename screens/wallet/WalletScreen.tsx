import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useWallet } from '../../contexts/WalletContext';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../contexts/PriceContext';
import { useVaultData } from '../../contexts/WalletDataContext';
import { useCashu } from '../../contexts/CashuContext';
import { useDisplayPreferences } from "../../contexts/DisplayPreferencesContext";
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import { useFormattedBalances } from '../../hooks/useFormattedBalances';
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
  onAssetPress?: (asset: string) => void;
  _sendAddressType?: 'taproot' | 'segwit';
  switchingAccount: boolean;
  showZeroAssets: boolean;
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
  onAssetPress,
  _sendAddressType,
  switchingAccount,
  showZeroAssets,
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

  return (
    <View style={styles.walletContainer} testID="wallet-screen">
      {/* Loading overlay while switching accounts */}
      {switchingAccount && (
        <View style={styles.switchingOverlay}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
          <Text style={styles.switchingText}>Switching account...</Text>
        </View>
      )}

      {/* Header with Account Number and Settings Icon */}
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
        styles={styles}
        largeBalanceStyle={localStyles.largeBalanceAmount}
      />

      {/* Actions - Vault and Wallet Buttons */}
      <View style={localStyles.actionsRow} testID="wallet-actions">
        <TouchableOpacity style={localStyles.actionButton} onPress={onVaultPress} testID="wallet-repay-btn">
          <View style={localStyles.actionButtonIcon}>
            <Text style={localStyles.buttonIcon}>↓</Text>
          </View>
          <Text style={localStyles.actionButtonLabel}>Repay</Text>
        </TouchableOpacity>

        <TouchableOpacity style={localStyles.actionButton} onPress={onReceivePress} testID="wallet-deposit-btn">
          <View style={localStyles.actionButtonIcon}>
            <Text style={localStyles.buttonIcon}>+</Text>
          </View>
          <Text style={localStyles.actionButtonLabel}>Deposit</Text>
        </TouchableOpacity>

        <TouchableOpacity style={localStyles.actionButton} onPress={onSendPress} testID="wallet-withdraw-btn">
          <View style={localStyles.actionButtonIcon}>
            <Text style={localStyles.buttonIcon}>-</Text>
          </View>
          <Text style={localStyles.actionButtonLabel}>Withdraw</Text>
        </TouchableOpacity>

        <TouchableOpacity style={localStyles.actionButton} onPress={onVaultPress} testID="wallet-borrow-btn">
          <View style={localStyles.actionButtonIcon}>
            <Text style={localStyles.buttonIcon}>↑</Text>
          </View>
          <Text style={localStyles.actionButtonLabel}>Borrow</Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.balanceDivider} />

      {/* Scrollable Assets Container */}
      <ScrollView
        style={styles.assetsScrollContainer}
        contentContainerStyle={styles.assetsScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Vault Card */}
        <VaultCard
          hasVault={hasVault}
          vaultHealthColor={vaultHealthColor}
          vaultHealthPercentage={vaultHealthPercentage}
          vaultDebt={vaultDebt}
          vaultCollateral={vaultCollateral}
          onVaultPress={onVaultPress}
          onCreateVault={handleCreateVault}
          creatingVault={creatingVault}
          styles={styles}
        />

        {/* Bitcoin Balance Card - Clickable for asset detail */}
        <AssetCard
          assetName="Bitcoin"
          assetLogo="btc_logo"
          amountLabel="btc_symbol"
          amountValue={formatted.segwitBTC}
          displayInBTC={showTotalInBTC}
          btcValue={formatted.segwitBTC}
          usdValue={formatted.segwitUSD}
          styles={styles}
          onPress={handleBTCPress}
        />

        {/* UNIT (Runes + Ecash) Combined Card */}
        <AssetCard
          assetName="UNIT"
          assetLogo="unit_logo"
          amountLabel="unit_symbol"
          amountValue={unitTotals.formatted}
          displayInBTC={showTotalInBTC}
          btcValue={unitTotals.btcValue}
          usdValue={unitTotals.usdValue}
          styles={styles}
          onPress={handleUNITPress}
        />

        {/* DUCAT•RUNE Card - Non-clickable */}
        {showZeroAssets && (
          <AssetCard
            assetName="DUCAT•RUNE"
            assetLogo="ducat_logo"
            amountValue="Đ 0.00"
            displayInBTC={showTotalInBTC}
            btcValue="0.00"
            usdValue="0.00"
            styles={styles}
            isLast={true}
            customAmountStyle={localStyles.ducatAmount}
          />
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
    paddingHorizontal: 20,
    paddingVertical: 8,
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
