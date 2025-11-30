/**
 * VaultInfo Component
 * Displays main vault statistics with semicircular gauge
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { VaultHealthGauge } from '../assetDetail/VaultHealthGauge';
import { VaultInfoSkeleton } from './VaultSkeleton';
import { useResponsive } from '../../hooks/useResponsive';

interface VaultInfoProps {
  totalDebt: number;
  totalCollateral: number;
  currentPrice: number;
  healthPercentage: number;
  healthColor: string;
  isLoading?: boolean;
  priceChange24h?: number;
  onChartPress?: () => void;
}

export const VaultInfo = memo(function VaultInfo({
  totalDebt,
  totalCollateral,
  currentPrice,
  healthPercentage,
  isLoading = false,
  priceChange24h = 0,
  onChartPress,
}: VaultInfoProps) {
  const { s } = useResponsive();

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingVertical: s(8) }]}>
        <VaultInfoSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingVertical: s(8) }]}>
      <VaultHealthGauge
        totalDebt={totalDebt}
        totalCollateral={totalCollateral}
        currentPrice={currentPrice}
        healthPercentage={healthPercentage}
        priceChange24h={priceChange24h}
        onChartPress={onChartPress}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {},
});
