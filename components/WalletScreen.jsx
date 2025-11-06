import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useWallet } from '../contexts/WalletContext';
import { COLORS } from '../utils/colors';

export default function WalletScreen({
  styles,
  onSendPress,
  onReceivePress,
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
    showBTCInBTC,
    setShowBTCInBTC,
    showUnitInUnit,
    setShowUnitInUnit,
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
            <Text style={styles.headerIcon}>🕐</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onSettingsPress}
          >
            <Text style={styles.headerIcon}>⚙️</Text>
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
                <Image source={require('../assets/btc-symbol.png')} style={styles.balanceIcon} resizeMode="contain" />
                <Text style={styles.xverseBalanceAmount}>
                  {((segwitBalance || 0) + (taprootBalance || 0)).toFixed(8)}
                </Text>
              </View>
            ) : (
              <Text style={styles.xverseBalanceAmount}>
                ${(((segwitBalance || 0) + (taprootBalance || 0)) * (btcPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.balanceDivider} />

      {/* Assets Container - Fixed height to prevent jumping */}
      <View style={styles.assetsContainer}>
        {/* Bitcoin Balance Card - Shows aggregate */}
        <TouchableOpacity
          style={styles.assetCard}
          onPress={() => setShowBTCInBTC(!showBTCInBTC)}
        >
          <View style={styles.assetRow}>
            <View style={styles.assetLeft}>
              <View style={styles.btcIcon}>
                <Image
                  source={require('../assets/btc-logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.assetName}>Bitcoin</Text>
            </View>
            {showBTCInBTC ? (
              <View style={styles.assetValueWithIcon}>
                <Image source={require('../assets/btc-symbol.png')} style={styles.assetIcon} resizeMode="contain" />
                <Text style={styles.assetValue}>
                  {((segwitBalance || 0) + (taprootBalance || 0)).toFixed(8)}
                </Text>
              </View>
            ) : (
              <Text style={styles.assetValue}>
                $ {(((segwitBalance || 0) + (taprootBalance || 0)) * (btcPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* UNIT•RUNE Card */}
        <TouchableOpacity
          style={styles.assetCard}
          onPress={() => setShowUnitInUnit(!showUnitInUnit)}
        >
          <View style={styles.assetRow}>
            <View style={styles.assetLeft}>
              <View style={[styles.btcIcon, styles.ducatIcon]}>
                <Image
                  source={require('../assets/unit-logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.assetName}>UNIT•RUNE</Text>
            </View>
            {showUnitInUnit ? (
              <View style={styles.assetValueWithIcon}>
                <Image source={require('../assets/unit-symbol.png')} style={styles.assetIcon} resizeMode="contain" />
                <Text style={styles.assetValue}>
                  {runesBalance.length > 0 ? parseFloat(runesBalance[0][1]).toLocaleString() : '0'}
                </Text>
              </View>
            ) : (
              <Text style={styles.assetValue}>
                $ {runesBalance.length > 0
                  ? (parseFloat(runesBalance[0][1]) * 1.0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : '0.00'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* DUCAT•RUNE Card */}
        <TouchableOpacity
          style={styles.assetCard}
          onPress={() => {}}
        >
          <View style={styles.assetRow}>
            <View style={styles.assetLeft}>
              <View style={[styles.btcIcon, styles.ducatIcon]}>
                <Image
                  source={require('../assets/ducat-logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.assetName}>DUCAT•RUNE</Text>
            </View>
            <Text style={styles.assetValue}>$ 0.00</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Actions - Send and Receive Buttons - Full Width */}
      <View style={styles.xverseActionsRow}>
        <TouchableOpacity
          style={styles.xverseActionButton}
          onPress={onSendPress}
        >
          <View style={styles.xverseActionIcon}>
            <Text style={styles.xverseActionIconText}>↑</Text>
          </View>
          <Text style={styles.xverseActionLabel}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.xverseActionButton}
          onPress={onReceivePress}
        >
          <View style={styles.xverseActionIcon}>
            <Text style={styles.xverseActionIconText}>↓</Text>
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
