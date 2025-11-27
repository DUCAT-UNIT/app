/**
 * AssetInfo Component
 * Displays asset balance and price information
 * For UNIT asset, also displays vault health information
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatBalance, formatFiat } from '../../utils/formatters/index';
import { VaultHealthGauge } from './VaultHealthGauge';
import { AssetInfoSkeleton } from './AssetSkeleton';

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

export interface VaultHealthData {
  healthPercentage: number;
  healthColor: string;
  totalDebt: number;
  totalCollateral: number;
  currentPrice: number;
  hasVault: boolean;
  isLoading: boolean;
  priceChange24h?: number;
}

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
  vaultHealth?: VaultHealthData;
  testID?: string;
}

export function AssetInfo({ assetType, balance, fiatValue, btcPrice, priceData, priceDirection, isLoading, vaultHealth }: AssetInfoProps) {
  // For UNIT, show the actual UNIT amount with commas and 2 decimals
  // For BTC, show the BTC value with 8 decimals
  const displayBalance = assetType === 'BTC'
    ? formatBalance(balance || 0)
    : formatFiat(balance || 0, 2);

  // Show skeleton loading state if balances are still loading
  if (isLoading) {
    return <AssetInfoSkeleton />;
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

      {/* Vault Health Section for UNIT */}
      {assetType === 'UNIT' && vaultHealth && vaultHealth.hasVault && !vaultHealth.isLoading && (
        <VaultHealthGauge
          totalDebt={vaultHealth.totalDebt}
          totalCollateral={vaultHealth.totalCollateral}
          currentPrice={vaultHealth.currentPrice}
          healthPercentage={vaultHealth.healthPercentage}
          priceChange24h={vaultHealth.priceChange24h}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  assetInfoContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 180, // Fixed height to prevent layout jumping
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
});
