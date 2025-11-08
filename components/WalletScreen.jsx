import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useWallet } from '../contexts/WalletContext';
import { COLORS } from '../utils/colors';
import Icon from './Icon';

export default function WalletScreen({
  styles,
  onSendPress,
  onReceivePress,
  onHistoryPress,
  onSettingsPress,
  sendAddressType,
  switchingAccount,
}) {
  const {
    wallet,
    currentAccount,
    segwitBalance,
    taprootBalance,
    runesBalance,
    loadingBtcPrice,
    btcPrice,
    showTotalInBTC,
    setShowTotalInBTC,
  } = useWallet();

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
                  {(() => {
                    // Convert all assets to BTC equivalent
                    const btcValue = segwitBalance || 0;
                    const unitValue = runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) / (btcPrice || 1) : 0;
                    const ducatValue = 0; // DUCAT value in BTC
                    const totalBtc = btcValue + unitValue + ducatValue;
                    return totalBtc.toFixed(8);
                  })()}
                </Text>
              </View>
            ) : (
              <Text style={styles.xverseBalanceAmount}>
                ${(() => {
                  // Calculate total USD value of all assets
                  const btcUsdValue = (segwitBalance || 0) * (btcPrice || 0);
                  const unitUsdValue = runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
                  const ducatUsdValue = 0; // DUCAT value in USD
                  const totalUsd = btcUsdValue + unitUsdValue + ducatUsdValue;
                  return totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                })()}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.balanceDivider} />

      {/* Assets Container - Fixed height to prevent jumping */}
      <View style={styles.assetsContainer}>
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
                    {(segwitBalance || 0).toFixed(8)}
                  </Text>
                </View>
              </View>
            </View>
            {showTotalInBTC ? (
              <View style={styles.assetValueWithIcon}>
                <Icon name="btc_symbol" size={10} color={COLORS.SECONDARY_TEXT} style={styles.assetIcon} />
                <Text style={styles.assetValue}>
                  {(segwitBalance || 0).toFixed(8)}
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
                  {runesBalance.length > 0 ? (parseFloat(runesBalance[0][1]) / (btcPrice || 1)).toFixed(8) : '0.00000000'}
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
        <View style={styles.assetCard}>
          <View style={styles.assetRow}>
            <View style={styles.assetLeft}>
              <View style={[styles.btcIcon, styles.ducatIcon]}>
                <Icon name="ducat_logo" size={36} />
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>DUCAT•RUNE</Text>
                <Text style={styles.assetAmount}>0</Text>
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
      </View>

      {/* Actions - Send and Receive Buttons - Full Width */}
      <View style={styles.xverseActionsRow}>
        <TouchableOpacity
          style={styles.xverseActionButton}
          onPress={onSendPress}
        >
          <View style={styles.xverseActionIcon}>
            <Icon name="send" size={20} color={COLORS.BLACK} />
          </View>
          <Text style={styles.xverseActionLabel}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.xverseActionButton}
          onPress={onReceivePress}
        >
          <View style={styles.xverseActionIcon}>
            <Icon name="receive" size={20} color={COLORS.BLACK} />
          </View>
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
  onHistoryPress: PropTypes.func.isRequired,
  sendAddressType: PropTypes.oneOf(['taproot', 'segwit']),
  switchingAccount: PropTypes.bool.isRequired,
};
