import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../contexts/WalletContext';
import { useBalance } from '../contexts/WalletDataContext';
import { usePrice } from '../contexts/PriceContext';
import { useVaultData } from '../contexts/WalletDataContext';
import { useDisplayPreferences } from '../contexts/UIContext';
import { useWalletCalculations } from '../hooks/useWalletCalculations';
import { useFormattedBalances } from '../hooks/useFormattedBalances';
import { COLORS } from '../utils/colors';
import Icon from './icons';

const WalletScreen = React.memo(function WalletScreen({
  styles,
  onSendPress,
  onReceivePress,
  onHistoryPress,
  onSettingsPress,
  onCreateVaultPress,
  onVaultPress,
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
  const handleCreateVault = React.useCallback(() => {
    if (creatingVault) return;
    setCreatingVault(true);
    onCreateVaultPress();
    // Reset after 2 seconds to allow retry if needed
    setTimeout(() => setCreatingVault(false), 2000);
  }, [creatingVault, onCreateVaultPress]);

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
      <View style={styles.xverseHeader}>
        <View style={styles.xverseHeaderLeft}>
          <Text style={styles.xverseAccountName}>Account {currentAccount + 1}</Text>
        </View>
        <View style={styles.xverseHeaderRight}>
          <TouchableOpacity style={styles.headerIconButton} onPress={onHistoryPress}>
            <Icon name="transaction_history" size={22} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={onSettingsPress}>
            <Icon name="settings" size={22} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Banner - Show when balance fetch fails */}
      {balanceError && (
        <TouchableOpacity
          style={localStyles.errorBanner}
          onPress={handleRetryBalance}
          activeOpacity={0.8}
        >
          <Icon name="warning" size={18} color={COLORS.DANGER_RED} style={localStyles.errorIcon} />
          <Text style={localStyles.errorText}>{balanceError}</Text>
        </TouchableOpacity>
      )}

      {/* Total Balance Section - Xverse Style */}
      <View style={styles.xverseBalanceSection}>
        <View style={styles.xverseBalanceLeft}>
          <Text style={styles.xverseBalanceLabel}>Total Balance USD</Text>
          <TouchableOpacity onPress={() => setShowTotalInBTC(!showTotalInBTC)}>
            {showTotalInBTC ? (
              <View style={styles.balanceWithIcon}>
                <Icon
                  name="btc_symbol"
                  size={12}
                  color={COLORS.VERY_LIGHT_GRAY}
                  style={styles.balanceIcon}
                />
                <Text style={styles.xverseBalanceAmount}>{formatted.totalBTC}</Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.xverseBalanceAmount,
                  totalBalanceUSD >= 10000000 && localStyles.largeBalanceAmount,
                ]}
              >
                ${formatted.totalUSD}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
        <TouchableOpacity
          style={styles.vaultCard}
          onPress={hasVault ? onVaultPress : undefined}
          activeOpacity={hasVault ? 0.7 : 1}
          disabled={!hasVault}
        >
          <View style={styles.vaultIconContainer}>
            <Icon name="vault_logo" size={40} color="#DDDDDD" />
            <View style={[styles.vaultStatusIndicator, { backgroundColor: vaultHealthColor }]} />
          </View>
          <View style={styles.vaultContentWrapper}>
            <View style={styles.vaultHeader}>
              <View style={styles.vaultHeaderLeft}>
                <View style={styles.assetInfo}>
                  <Text style={styles.vaultAssetName}>Vault</Text>
                </View>
              </View>
              <Text style={[styles.assetValue, { color: vaultHealthColor }]}>
                {vaultHealthPercentage}%
              </Text>
            </View>
            <View style={styles.vaultDetailsContainer}>
              <View style={styles.vaultDetailRow}>
                <Text style={styles.vaultLabel}>Overall Debt</Text>
                <View style={styles.vaultValueContainer}>
                  <Icon
                    name="unit_symbol"
                    size={10}
                    color={COLORS.SECONDARY_TEXT}
                    style={styles.assetAmountIcon}
                  />
                  <Text style={styles.assetAmount}>
                    {vaultDebt.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              </View>
              <View style={styles.vaultDetailRow}>
                <Text style={styles.vaultLabel}>Total collateral</Text>
                <View style={styles.vaultValueContainer}>
                  <Icon
                    name="btc_symbol"
                    size={10}
                    color={COLORS.SECONDARY_TEXT}
                    style={styles.assetAmountIcon}
                  />
                  <Text style={styles.assetAmount}>
                    {vaultCollateral.toLocaleString('en-US', {
                      minimumFractionDigits: 8,
                      maximumFractionDigits: 8,
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Create Vault Overlay - Only show when no vault exists */}
          {!hasVault && (
            <LinearGradient
              colors={['rgba(20, 20, 20, 0.8)', 'rgba(20, 20, 20, 1)']}
              style={styles.vaultOverlay}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            >
              <TouchableOpacity
                style={styles.createVaultButton}
                onPress={handleCreateVault}
                activeOpacity={0.8}
                disabled={creatingVault}
              >
                <Text style={styles.createVaultButtonText}>Create Vault</Text>
              </TouchableOpacity>
            </LinearGradient>
          )}
        </TouchableOpacity>

        {/* Bitcoin Balance Card - Non-clickable */}
        <View style={styles.assetCard}>
          <View style={styles.assetRow}>
            <View style={styles.assetLeft}>
              <View style={styles.btcIcon}>
                <Icon name="btc_logo" size={36} />
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>Bitcoin</Text>
                <View style={styles.balanceWithIcon}>
                  <Icon
                    name="btc_symbol"
                    size={10}
                    color={COLORS.SECONDARY_TEXT}
                    style={styles.assetAmountIcon}
                  />
                  <Text style={styles.assetAmount}>{formatted.segwitBTC}</Text>
                </View>
              </View>
            </View>
            {showTotalInBTC ? (
              <View style={styles.assetValueWithIcon}>
                <Icon
                  name="btc_symbol"
                  size={10}
                  color={COLORS.SECONDARY_TEXT}
                  style={styles.assetIcon}
                />
                <Text style={styles.assetValue}>{formatted.segwitBTC}</Text>
              </View>
            ) : (
              <Text style={styles.assetValue}>$ {formatted.segwitUSD}</Text>
            )}
          </View>
        </View>

        {/* UNIT•RUNE Card - Non-clickable */}
        <View style={styles.assetCard}>
          <View style={styles.assetRow}>
            <View style={styles.assetLeft}>
              <View style={[styles.btcIcon, styles.ducatIcon]}>
                <Icon name="unit_logo" size={36} />
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>UNIT•RUNE</Text>
                <View style={styles.balanceWithIcon}>
                  <Icon
                    name="unit_symbol"
                    size={10}
                    color={COLORS.SECONDARY_TEXT}
                    style={styles.assetAmountIcon}
                  />
                  <Text style={styles.assetAmount}>
                    {runesBalance.length > 0 ? formatted.runes : '0'}
                  </Text>
                </View>
              </View>
            </View>
            {showTotalInBTC ? (
              <View style={styles.assetValueWithIcon}>
                <Icon
                  name="btc_symbol"
                  size={10}
                  color={COLORS.SECONDARY_TEXT}
                  style={styles.assetIcon}
                />
                <Text style={styles.assetValue}>
                  {unitValueInBTC.toLocaleString('en-US', {
                    minimumFractionDigits: 8,
                    maximumFractionDigits: 8,
                  })}
                </Text>
              </View>
            ) : (
              <Text style={styles.assetValue}>
                ${' '}
                {runesBalance.length > 0
                  ? parseFloat(runesBalance[0][1]).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '0.00'}
              </Text>
            )}
          </View>
        </View>

        {/* DUCAT•RUNE Card - Non-clickable */}
        {showZeroAssets && (
          <View style={[styles.assetCard, styles.assetCardLast]}>
            <View style={styles.assetRow}>
              <View style={styles.assetLeft}>
                <View style={[styles.btcIcon, styles.ducatIcon]}>
                  <Icon name="ducat_logo" size={36} />
                </View>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetName}>DUCAT•RUNE</Text>
                  <Text style={[styles.assetAmount, localStyles.ducatAmount]}>Đ 0.00</Text>
                </View>
              </View>
              {showTotalInBTC ? (
                <View style={styles.assetValueWithIcon}>
                  <Icon
                    name="btc_symbol"
                    size={10}
                    color={COLORS.SECONDARY_TEXT}
                    style={styles.assetIcon}
                  />
                  <Text style={styles.assetValue}>0.00</Text>
                </View>
              ) : (
                <Text style={styles.assetValue}>$ 0.00</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Actions - Send and Receive Buttons - Fixed at Bottom */}
      <View style={styles.xverseActionsRow}>
        <TouchableOpacity style={styles.xverseActionButton} onPress={onSendPress}>
          <Text style={styles.xverseActionLabel}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.xverseActionButton} onPress={onReceivePress}>
          <Text style={styles.xverseActionLabel}>Receive</Text>
        </TouchableOpacity>
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(208, 76, 104, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.DANGER_RED,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 8,
  },
  errorIcon: {
    marginRight: 10,
  },
  errorText: {
    flex: 1,
    color: COLORS.DANGER_RED,
    fontSize: 13,
    fontWeight: '500',
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
  sendAddressType: PropTypes.oneOf(['taproot', 'segwit']),
  switchingAccount: PropTypes.bool.isRequired,
  showZeroAssets: PropTypes.bool.isRequired,
};

export default WalletScreen;
