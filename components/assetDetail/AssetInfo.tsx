/**
 * AssetInfo Component
 * Displays asset balance and price information
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatBalance, formatFiat } from '../../utils/formatters/index';

export interface PriceDirection {
  isPositive: boolean;
  percentChange: string;
  dollarChange: string;
}

export interface PriceData {
  prices: Array<[number, number]>;
  market_caps?: Array<[number, number]>;
  total_volumes?: Array<[number, number]>;
}

// PricePoint type from usePriceChart hook - [timestamp, price]
type PricePoint = [number, number];

export interface AssetInfoProps {
  assetType: 'BTC' | 'UNIT';
  balance: number;
  fiatValue: number;
  btcPrice: number | null;
  priceData: PriceData | PricePoint[] | null;
  priceDirection: PriceDirection;
  runesBalance?: number;
  cashuBalance?: number;
  isLoading: boolean;
  testID?: string;
}

export function AssetInfo({ assetType, balance, fiatValue, btcPrice, priceData, priceDirection, isLoading }: AssetInfoProps) {
  // For UNIT, show the actual UNIT amount with commas and 2 decimals
  // For BTC, show the BTC value with 8 decimals
  const displayBalance = assetType === 'BTC'
    ? formatBalance(balance || 0)
    : formatFiat(balance || 0, 2);

  // Show loading state if balances are still loading
  if (isLoading) {
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

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
          <Text style={styles.loadingText}>Loading balance...</Text>
        </View>
      </View>
    );
  }

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
        ${formatFiat(fiatValue || 0)} USD
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
  },
});
