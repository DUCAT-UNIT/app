import React from 'react';
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, Clipboard } from 'react-native';
import { useWallet } from '../contexts/WalletContext';
import { COLORS } from '../utils/colors';

export default function WalletScreen({
  styles,
  onSendPress,
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

  const handleCopyAddress = () => {
    const address = sendAddressType === 'taproot' ? wallet.taprootAddress : wallet.segwitAddress;
    Clipboard.setString(address);
    Alert.alert('Copied', 'Address copied to clipboard');
  };

  return (
    <View style={styles.walletContainer}>
      {/* Loading overlay while switching accounts */}
      {switchingAccount && (
        <View style={styles.switchingOverlay}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
          <Text style={styles.switchingText}>Switching account...</Text>
        </View>
      )}

      {/* Header with Account Number, Copy Icon, and Settings Icon */}
      <View style={styles.xverseHeader}>
        <View style={styles.xverseHeaderLeft}>
          <Text style={styles.xverseAccountName}>Account {currentAccount + 1}</Text>
          <TouchableOpacity onPress={handleCopyAddress} style={styles.copyButton}>
            <Text style={styles.copyIcon}>📋</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.xverseHeaderRight}>
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
                <Text style={styles.xverseBalanceAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {((segwitBalance || 0) + (taprootBalance || 0)).toFixed(8)}
                </Text>
              </View>
            ) : (
              <Text style={styles.xverseBalanceAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
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

        {/* DUCAT UNIT Card - Always reserve space */}
        {runesBalance.length > 0 ? (
          runesBalance.map((rune, index) => (
            <TouchableOpacity
              key={index}
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
                  <Text style={styles.assetName}>Unit</Text>
                </View>
                {showUnitInUnit ? (
                  <View style={styles.assetValueWithIcon}>
                    <Image source={require('../assets/unit-symbol.png')} style={styles.assetIcon} resizeMode="contain" />
                    <Text style={styles.assetValue}>
                      {parseFloat(rune[1]).toLocaleString()}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.assetValue}>
                    $ {(parseFloat(rune[1]) * 1.0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={[styles.assetCard, styles.assetCardPlaceholder]} />
        )}
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
          onPress={() => Alert.alert('Receive', `Your ${sendAddressType === 'taproot' ? 'Taproot' : 'SegWit'} Address:\n\n${sendAddressType === 'taproot' ? wallet.taprootAddress : wallet.segwitAddress}`)}
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
