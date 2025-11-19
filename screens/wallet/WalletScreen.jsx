import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import TouchableScale from '../../components/common/TouchableScale';
import { useWallet } from '../../contexts/WalletContext';
import { useBalance } from '../../contexts/WalletDataContext';
import { usePrice } from '../../contexts/PriceContext';
import { useVaultData } from '../../contexts/WalletDataContext';
import { useDisplayPreferences } from "../../contexts/DisplayPreferencesContext";
import { useWalletCalculations } from '../../hooks/useWalletCalculations';
import { useFormattedBalances } from '../../hooks/useFormattedBalances';
import { COLORS } from '../../theme';
import TotalBalanceSection from '../../components/wallet/TotalBalanceSection';
import VaultCard from '../../components/wallet/VaultCard';
import AssetCard from '../../components/wallet/AssetCard';
import WalletHeader from '../../components/wallet/WalletHeader';
import ErrorBanner from '../../components/wallet/ErrorBanner';

// Constants
const VAULT_CREATION_RETRY_TIMEOUT = 2000;

const WalletScreen = React.memo(function WalletScreen({
  styles,
  onSendPress,
  onReceivePress,
  onHistoryPress,
  onSettingsPress,
  onCreateVaultPress,
  onVaultPress,
  onAssetPress,
  _sendAddressType,
  switchingAccount,
  showZeroAssets,
}) {
  const { wallet: _wallet, currentAccount } = useWallet();
  const { segwitBalance, taprootBalance, runesBalance, balanceError, setBalanceError, fetchBalance } = useBalance();
  const { btcPrice, _loadingBtcPrice } = usePrice();
  const { vaultData } = useVaultData();
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
    unitValueInBTC,
  } = useWalletCalculations({
    segwitBalance,
    taprootBalance,
    runesBalance,
    btcPrice,
    vaultData,
  });

  // Memoize formatted balances to avoid repeated toLocaleString() calls
  const formatted = useFormattedBalances({
    totalBalanceBTC,
    totalBalanceUSD,
    segwitBalance,
    taprootBalance,
    runesBalance: runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0,
    btcPrice,
  });

  // Prevent multiple rapid clicks on create vault button
  const [creatingVault, setCreatingVault] = React.useState(false);
  const vaultCreationTimeoutRef = React.useRef(null);

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

  return (
    <View style={styles.walletContainer}>
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
          onPress={() => onAssetPress && onAssetPress('BTC')}
        />

        {/* UNIT•RUNE Card - Clickable for asset detail */}
        <AssetCard
          assetName="UNIT•RUNE"
          assetLogo="unit_logo"
          amountLabel="unit_symbol"
          amountValue={runesBalance.length > 0 ? formatted.runes : '0'}
          displayInBTC={showTotalInBTC}
          btcValue={unitValueInBTC}
          usdValue={runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0}
          styles={styles}
          onPress={() => onAssetPress && onAssetPress('UNIT')}
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

      {/* Actions - Send and Receive Buttons - Fixed at Bottom */}
      <View style={styles.xverseActionsRow}>
        <TouchableScale style={styles.xverseActionButton} onPress={onSendPress}>
          <Text style={styles.xverseActionLabel}>Send</Text>
        </TouchableScale>

        <TouchableScale style={styles.xverseActionButton} onPress={onReceivePress}>
          <Text style={styles.xverseActionLabel}>Receive</Text>
        </TouchableScale>
      </View>
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
});

WalletScreen.propTypes = {
  styles: PropTypes.object.isRequired,
  onSendPress: PropTypes.func.isRequired,
  onReceivePress: PropTypes.func.isRequired,
  onSettingsPress: PropTypes.func.isRequired,
  onCreateVaultPress: PropTypes.func.isRequired,
  onVaultPress: PropTypes.func.isRequired,
  onHistoryPress: PropTypes.func.isRequired,
  _sendAddressType: PropTypes.oneOf(['taproot', 'segwit']),
  switchingAccount: PropTypes.bool.isRequired,
  showZeroAssets: PropTypes.bool.isRequired,
};

export default WalletScreen;
