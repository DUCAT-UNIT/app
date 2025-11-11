/**
 * AssetSelectorSheet Component
 * Bottom sheet for selecting which asset to send (BTC, UNIT, or DUCAT)
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text, View, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import Icon from '../Icon';
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

  // Calculate USD values
  const btcUsdValue = (btcBalance || 0) * (btcPrice || 0);
  const unitUsdValue = unitBalance || 0;
  const ducatUsdValue = 0;

  // Create asset array with all data
  const assets = [
    {
      id: 'btc',
      name: 'Bitcoin',
      icon: 'btc_logo',
      balance: btcBalance || 0,
      balanceText: `${(btcBalance || 0).toFixed(8)} BTC`,
      usdValue: btcUsdValue,
      disabled: btcBalance === 0,
    },
    {
      id: 'unit',
      name: 'UNIT•RUNE',
      icon: 'unit_logo',
      balance: unitBalance || 0,
      balanceText: `${(unitBalance || 0).toLocaleString()} UNIT`,
      usdValue: unitUsdValue,
      disabled: unitBalance === 0,
    },
    {
      id: 'ducat',
      name: 'DUCAT•RUNE',
      icon: 'ducat_logo',
      balance: 0,
      balanceText: '0.00 DUCAT',
      usdValue: ducatUsdValue,
      disabled: true,
    },
  ];

  // Sort by USD value (highest first)
  const sortedAssets = assets.sort((a, b) => b.usdValue - a.usdValue);

  return (
    <>
      <TouchableOpacity style={styles.bottomSheetBackdrop} onPress={onDismiss} activeOpacity={1} />
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <View {...panHandlers}>
          <View style={styles.bottomSheetHandle} />
          <Text style={styles.bottomSheetTitle}>Send What?</Text>
        </View>

        {sortedAssets.map((asset) => (
          <TouchableOpacity
            key={asset.id}
            style={[styles.assetOption, asset.disabled && styles.assetOptionDisabled]}
            onPress={() => {
              if (!asset.disabled) {
                onSelectAsset(asset.id);
              }
            }}
            disabled={asset.disabled}
            activeOpacity={asset.disabled ? 1 : 0.7}
          >
            <View style={localStyles.assetIcon}>
              <Icon name={asset.icon} size={36} />
            </View>
            <View style={styles.assetOptionInfo}>
              <Text
                style={[styles.assetOptionTitle, asset.disabled && styles.assetOptionTitleDisabled]}
              >
                {asset.name}
              </Text>
              <Text
                style={[
                  styles.assetOptionSubtitle,
                  asset.disabled && styles.assetOptionSubtitleDisabled,
                ]}
              >
                {asset.balanceText}
              </Text>
            </View>
            <Text
              style={[styles.assetOptionValue, asset.disabled && styles.assetOptionValueDisabled]}
            >
              $
              {asset.usdValue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </>
  );
}

const localStyles = StyleSheet.create({
  assetIcon: {
    marginRight: 20,
  },
});

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
