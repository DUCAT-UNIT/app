import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useWallet } from '../contexts/WalletContext';
import { COLORS } from '../utils/colors';

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
            <Image
              source={require('../assets/icons/transaction_history.png')}
              style={styles.headerIconImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onSettingsPress}
          >
            <Image
              source={require('../assets/icons/settings.png')}
              style={styles.headerIconImage}
              resizeMode="contain"
            />
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
        {/* Bitcoin Balance Card - Non-clickable */}
        <View style={styles.assetCard}>
          <View style={styles.assetRow}>
            <View style={styles.assetLeft}>
              <View style={styles.btcIcon}>
                <Image
                  source={require('../assets/btc-logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>Bitcoin</Text>
                <View style={styles.balanceWithIcon}>
                  <Image source={require('../assets/btc-symbol.png')} style={styles.assetAmountIcon} resizeMode="contain" />
                  <Text style={styles.assetAmount}>
                    {((segwitBalance || 0) + (taprootBalance || 0)).toFixed(8)}
                  </Text>
                </View>
              </View>
            </View>
            {showTotalInBTC ? (
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
        </View>

        {/* UNIT•RUNE Card - Non-clickable */}
        <View style={styles.assetCard}>
          <View style={styles.assetRow}>
            <View style={styles.assetLeft}>
              <View style={[styles.btcIcon, styles.ducatIcon]}>
                <Image
                  source={require('../assets/unit-logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>UNIT•RUNE</Text>
                <View style={styles.balanceWithIcon}>
                  <Image source={require('../assets/unit-symbol.png')} style={styles.assetAmountIcon} resizeMode="contain" />
                  <Text style={styles.assetAmount}>
                    {runesBalance.length > 0 ? parseFloat(runesBalance[0][1]).toLocaleString() : '0'}
                  </Text>
                </View>
              </View>
            </View>
            {showTotalInBTC ? (
              <View style={styles.assetValueWithIcon}>
                <Image source={require('../assets/btc-symbol.png')} style={styles.assetIcon} resizeMode="contain" />
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
                <Image
                  source={require('../assets/ducat-logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>DUCAT•RUNE</Text>
                <Text style={styles.assetAmount}>0</Text>
              </View>
            </View>
            {showTotalInBTC ? (
              <View style={styles.assetValueWithIcon}>
                <Image source={require('../assets/btc-symbol.png')} style={styles.assetIcon} resizeMode="contain" />
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
            <Image
              source={require('../assets/icons/send.png')}
              style={styles.xverseActionIconImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.xverseActionLabel}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.xverseActionButton}
          onPress={onReceivePress}
        >
          <View style={styles.xverseActionIcon}>
            <Image
              source={require('../assets/icons/receive.png')}
              style={styles.xverseActionIconImage}
              resizeMode="contain"
            />
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
