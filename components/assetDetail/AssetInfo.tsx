/**
 * AssetInfo Component
 * Displays asset balance and price information
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatBalance, formatFiat } from '../../utils/formatters/index';
import { AssetInfoSkeleton } from './AssetSkeleton';
import { useResponsive } from '../../hooks/useResponsive';

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
  isPendingVaultTx?: boolean;
}

export function AssetInfo({ assetType, balance, fiatValue, btcPrice, priceData, priceDirection, isLoading }: AssetInfoProps) {
  const { s, sf } = useResponsive();

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
    <View style={[styles.assetInfoContainer, { paddingVertical: s(12), minHeight: s(180) }]}>
      <View style={[styles.iconContainer, { marginBottom: s(4) }]}>
        <Icon
          name={assetType === 'BTC' ? 'btc_logo' : 'unit_logo'}
          size={s(60)}
        />
      </View>

      <Text style={[styles.assetName, { fontSize: sf(16), marginBottom: s(12) }]}>
        {assetType === 'BTC' ? 'Bitcoin' : 'UNIT'}
      </Text>

      <Text style={[styles.balanceAmount, { fontSize: sf(31), marginBottom: s(8) }]}>
        {displayBalance} {assetType}
      </Text>

      <Text style={[styles.balanceFiat, { fontSize: sf(20), marginBottom: s(12) }]}>
        ${formatFiat(fiatValue || 0)} USD
      </Text>


      {assetType === 'BTC' && btcPrice && priceData && (
        <Text style={[styles.priceChange, { fontSize: sf(16), color: priceDirection.isPositive ? COLORS.SUCCESS_GREEN : COLORS.RED }]}>
          {priceDirection.isPositive ? '▲' : '▼'} {priceDirection.percentChange}% ({priceDirection.isPositive ? '+' : '-'}${priceDirection.dollarChange})
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  assetInfoContainer: {
    alignItems: 'center',
  },
  iconContainer: {},
  assetName: {
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
  },
  balanceAmount: {
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  balanceFiat: {
    fontWeight: '400',
    color: COLORS.SECONDARY_TEXT,
  },
  priceChange: {
    fontWeight: '400',
  },
});
