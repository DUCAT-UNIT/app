/**
 * AssetInfo Component
 * Displays asset balance and price information
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatBalance, formatFiat } from '../../utils/formatters/index';

export function AssetInfo({ assetType, balance, fiatValue, btcPrice, priceData, priceDirection, runesBalance, cashuBalance }) {
  // For UNIT, divide by 100 (divisibility of 2) before displaying
  // For BTC, show the BTC value with 8 decimals
  const displayBalance = assetType === 'BTC'
    ? formatBalance(balance || 0)
    : formatFiat((balance || 0) / 100, 2);

  return (
    <View style={styles.assetInfoContainer}>
      <View style={styles.iconContainer}>
        <Icon
          name={assetType === 'BTC' ? 'btc_logo' : 'unit_logo'}
          size={60}
        />
      </View>

      <Text style={styles.assetName}>
        {assetType === 'BTC' ? 'Bitcoin' : 'UNIT'}
      </Text>

      <Text style={styles.balanceAmount}>
        {displayBalance} {assetType}
      </Text>

      <Text style={styles.balanceFiat}>
        ${formatFiat(assetType === 'BTC' ? (fiatValue || 0) : (fiatValue || 0) / 100)} USD
      </Text>


      {assetType === 'BTC' && btcPrice && priceData && (
        <Text style={[styles.priceChange, { color: priceDirection.isPositive ? COLORS.SUCCESS_GREEN : COLORS.RED }]}>
          {priceDirection.isPositive ? '▲' : '▼'} {priceDirection.percentChange}% ({priceDirection.isPositive ? '+' : '-'}${priceDirection.dollarChange})
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  assetInfoContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconContainer: {
    marginBottom: 4,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 12,
  },
  balanceAmount: {
    fontSize: 31,
    fontWeight: '700',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  balanceFiat: {
    fontSize: 20,
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 12,
  },
  priceChange: {
    fontSize: 16,
    fontWeight: '400',
  },
  breakdownContainer: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  breakdownText: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
  },
});
