/**
 * VaultInfo Component
 * Displays main vault statistics with semicircular gauge
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { VaultHealthGauge } from '../assetDetail/VaultHealthGauge';
import { VaultInfoSkeleton } from './VaultSkeleton';
import type { VaultHistoryTransaction } from '../../services/vaultService';

interface VaultInfoProps {
  totalDebt: number;
  totalCollateral: number;
  currentPrice: number;
  healthPercentage: number;
  healthColor: string;
  isLoading?: boolean;
  priceChange24h?: number;
  transactions?: VaultHistoryTransaction[];
  onHighlightEvent?: (eventDate: number | null) => void;
  onLockFilter?: (eventDate: number | null) => void;
  highlightedEventDate?: number | null;
}

export const VaultInfo = memo(function VaultInfo({
  totalDebt,
  totalCollateral,
  currentPrice,
  healthPercentage,
  isLoading = false,
  priceChange24h = 0,
  transactions = [],
  onHighlightEvent,
  onLockFilter,
  highlightedEventDate,
}: VaultInfoProps) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <VaultInfoSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VaultHealthGauge
        totalDebt={totalDebt}
        totalCollateral={totalCollateral}
        currentPrice={currentPrice}
        healthPercentage={healthPercentage}
        priceChange24h={priceChange24h}
        transactions={transactions}
        onHighlightEvent={onHighlightEvent}
        onLockFilter={onLockFilter}
        highlightedEventDate={highlightedEventDate}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    minHeight: 480, // Fixed height to prevent layout jumping
  },
});
