/**
 * AssetSelectorSheet Component
 * Bottom sheet for selecting which asset to send (BTC, UNIT, or DUCAT)
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, Image, Animated } from 'react-native';
import styles from '../../styles';

export default function AssetSelectorSheet({
  visible,
  opacity,
  translateY,
  panHandlers,
  btcBalance,
  unitBalance,
  btcPrice,
  onDismiss,
  onSelectAsset,
}) {
  if (!visible) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.bottomSheetBackdrop}
        onPress={onDismiss}
        activeOpacity={1}
      />
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            opacity,
            transform: [{ translateY }]
          }
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <View {...panHandlers}>
          <View style={styles.bottomSheetHandle} />
          <Text style={styles.bottomSheetTitle}>Send What?</Text>
        </View>

        <TouchableOpacity
          style={styles.assetOption}
          onPress={() => {
            onSelectAsset('btc');
          }}
        >
          <Image
            source={require('../../assets/btc-logo.png')}
            style={styles.assetOptionLogo}
          />
          <View style={styles.assetOptionInfo}>
            <Text style={styles.assetOptionTitle}>Bitcoin</Text>
            <Text style={styles.assetOptionSubtitle}>{(btcBalance || 0).toFixed(8)} BTC</Text>
          </View>
          <Text style={styles.assetOptionValue}>
            ${((btcBalance || 0) * (btcPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.assetOption}
          onPress={() => {
            onSelectAsset('unit');
          }}
        >
          <Image
            source={require('../../assets/unit-logo.png')}
            style={styles.assetOptionLogo}
          />
          <View style={styles.assetOptionInfo}>
            <Text style={styles.assetOptionTitle}>UNIT•RUNE</Text>
            <Text style={styles.assetOptionSubtitle}>{(unitBalance || 0).toLocaleString()} UNIT</Text>
          </View>
          <Text style={styles.assetOptionValue}>
            ${(unitBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.assetOption}
          onPress={() => {
            onSelectAsset('ducat');
          }}
        >
          <Image
            source={require('../../assets/ducat-logo.png')}
            style={styles.assetOptionLogo}
          />
          <View style={styles.assetOptionInfo}>
            <Text style={styles.assetOptionTitle}>DUCAT•RUNE</Text>
            <Text style={styles.assetOptionSubtitle}>0 DUCAT</Text>
          </View>
          <Text style={styles.assetOptionValue}>
            $0.00
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

AssetSelectorSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  opacity: PropTypes.object.isRequired, // Animated.Value
  translateY: PropTypes.object.isRequired, // Animated.Value
  panHandlers: PropTypes.object,
  btcBalance: PropTypes.number,
  unitBalance: PropTypes.number,
  btcPrice: PropTypes.number,
  onDismiss: PropTypes.func.isRequired,
  onSelectAsset: PropTypes.func.isRequired,
};
