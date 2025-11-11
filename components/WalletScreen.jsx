import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '../contexts/WalletContext';
import { useBalance } from '../contexts/BalanceContext';
import { useDisplayPreferences } from '../contexts/DisplayPreferencesContext';
import { useWalletCalculations } from '../hooks/useWalletCalculations';
import { COLORS } from '../utils/colors';
import Icon from './Icon';

export default function WalletScreen({
  styles,
  onSendPress,
  onReceivePress,
  onHistoryPress,
  onSettingsPress,
  onCreateVaultPress,
  sendAddressType,
  switchingAccount,
  showZeroAssets,
}) {
  const { wallet, currentAccount, vaultData } = useWallet();
  const {
    segwitBalance,
    taprootBalance,
    runesBalance,
    loadingBtcPrice,
    btcPrice,
  } = useBalance();
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

  // Prevent multiple rapid clicks on create vault button
  const [creatingVault, setCreatingVault] = React.useState(false);
  const handleCreateVault = React.useCallback(() => {
    if (creatingVault) return;
    setCreatingVault(true);
    onCreateVaultPress();
    // Reset after 2 seconds to allow retry if needed
    setTimeout(() => setCreatingVault(false), 2000);
  }, [creatingVault, onCreateVaultPress]);

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
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onHistoryPress}
          >
            <Icon name="transaction_history" size={22} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onSettingsPress}
          >
            <Icon name="settings" size={22} color={COLORS.VERY_LIGHT_GRAY} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Total Balance Section - Xverse Style */}
      <View style={styles.xverseBalanceSection}>
        <View style={styles.xverseBalanceLeft}>
          <Text style={styles.xverseBalanceLabel}>Total Balance USD</Text>
          <TouchableOpacity onPress={() => setShowTotalInBTC(!showTotalInBTC)}>
            {showTotalInBTC ? (
              <View style={styles.balanceWithIcon}>
                <Icon name="btc_symbol" size={12} color={COLORS.VERY_LIGHT_GRAY} style={styles.balanceIcon} />
                <Text style={styles.xverseBalanceAmount}>
                  {totalBalanceBTC.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })}
                </Text>
              </View>
            ) : (
              <Text style={[styles.xverseBalanceAmount, totalBalanceUSD >= 10000000 && { fontSize: 32 }]}>
                ${totalBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        <View style={styles.vaultCard}>
          <View style={styles.vaultIconContainer}>
            <Icon name="vault_logo" size={40} color="#DDDDDD" />
            <View style={[
              styles.vaultStatusIndicator,
              { backgroundColor: vaultHealthColor }
            ]} />
          </View>
          <View style={styles.vaultContentWrapper}>
            <View style={styles.vaultHeader}>
              <View style={styles.vaultHeaderLeft}>
                <View style={styles.assetInfo}>
                  <Text style={styles.vaultAssetName}>Vault</Text>
                </View>
              </View>
              <Text style={[
                styles.assetValue,
                { color: vaultHealthColor }
              ]}>
                {vaultHealthPercentage}%
              </Text>
            </View>
            <View style={styles.vaultDetailsContainer}>
              <View style={styles.vaultDetailRow}>
                <Text style={styles.vaultLabel}>Overall Debt</Text>
                <View style={styles.vaultValueContainer}>
                  <Icon name="unit_symbol" size={10} color={COLORS.SECONDARY_TEXT} style={styles.assetAmountIcon} />
                  <Text style={styles.assetAmount}>
                    {vaultDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
              <View style={styles.vaultDetailRow}>
                <Text style={styles.vaultLabel}>Total collateral</Text>
                <View style={styles.vaultValueContainer}>
                  <Icon name="btc_symbol" size={10} color={COLORS.SECONDARY_TEXT} style={styles.assetAmountIcon} />
                  <Text style={styles.assetAmount}>
                    {vaultCollateral.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })}
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
        </View>

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
                    <Icon name="btc_symbol" size={10} color={COLORS.SECONDARY_TEXT} style={styles.assetAmountIcon} />
                    <Text style={styles.assetAmount}>
                      {(segwitBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })}
                    </Text>
                  </View>
                </View>
              </View>
              {showTotalInBTC ? (
                <View style={styles.assetValueWithIcon}>
                  <Icon name="btc_symbol" size={10} color={COLORS.SECONDARY_TEXT} style={styles.assetIcon} />
                  <Text style={styles.assetValue}>
                    {(segwitBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })}
                  </Text>
                </View>
              ) : (
                <Text style={styles.assetValue}>
                  $ {((segwitBalance || 0) * (btcPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
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
                    <Icon name="unit_symbol" size={10} color={COLORS.SECONDARY_TEXT} style={styles.assetAmountIcon} />
                    <Text style={styles.assetAmount}>
                      {runesBalance.length > 0 ? parseFloat(runesBalance[0][1]).toLocaleString() : '0'}
                    </Text>
                  </View>
                </View>
              </View>
              {showTotalInBTC ? (
                <View style={styles.assetValueWithIcon}>
                  <Icon name="btc_symbol" size={10} color={COLORS.SECONDARY_TEXT} style={styles.assetIcon} />
                  <Text style={styles.assetValue}>
                    {unitValueInBTC.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })}
                  </Text>
                </View>
              ) : (
                <Text style={styles.assetValue}>
                  $ {runesBalance.length > 0
                      ? parseFloat(runesBalance[0][1]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
                  <Text style={[styles.assetAmount, { textAlign: 'left' }]}>Đ 0.00</Text>
                </View>
              </View>
              {showTotalInBTC ? (
                <View style={styles.assetValueWithIcon}>
                  <Icon name="btc_symbol" size={10} color={COLORS.SECONDARY_TEXT} style={styles.assetIcon} />
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
        <TouchableOpacity
          style={styles.xverseActionButton}
          onPress={onSendPress}
        >
          <Text style={styles.xverseActionLabel}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.xverseActionButton}
          onPress={onReceivePress}
        >
          <Text style={styles.xverseActionLabel}>Receive</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

WalletScreen.propTypes = {
  styles: PropTypes.object.isRequired,
  onSendPress: PropTypes.func.isRequired,
  onReceivePress: PropTypes.func.isRequired,
  onSettingsPress: PropTypes.func.isRequired,
  onCreateVaultPress: PropTypes.func.isRequired,
  onHistoryPress: PropTypes.func.isRequired,
  sendAddressType: PropTypes.oneOf(['taproot', 'segwit']),
  switchingAccount: PropTypes.bool.isRequired,
  showZeroAssets: PropTypes.bool.isRequired,
};
