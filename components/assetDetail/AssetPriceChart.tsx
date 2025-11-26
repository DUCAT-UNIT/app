/**
 * AssetPriceChart Component
 * Displays price chart with timeframe selector for BTC and UNIT assets
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import PriceChart from '../charts/PriceChart';
import { COLORS } from '../../theme';
import { generateUnitPriceData, PriceTimeframe, PriceDataPoint } from '../../utils/priceDataGenerator';

interface TimeframeButtonProps {
  timeframe: string;
  isActive: boolean;
  isLoading: boolean;
  onPress: () => void;
}

// Memoized timeframe button to prevent re-renders
const TimeframeButton = memo(function TimeframeButton({
  timeframe,
  isActive,
  isLoading,
  onPress,
}: TimeframeButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.timeframeButton,
        isActive && styles.timeframeButtonActive,
      ]}
      onPress={onPress}
    >
      {isLoading && isActive ? (
        <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
      ) : (
        <Text
          style={[
            styles.timeframeButtonText,
            isActive && styles.timeframeButtonTextActive,
          ]}
        >
          {timeframe}
        </Text>
      )}
    </TouchableOpacity>
  );
});

const TIMEFRAMES = ['1D', '1W', '1M', '1Y'];

interface AssetPriceChartProps {
  assetType: 'BTC' | 'UNIT';
  priceData: PriceDataPoint[] | null;
  priceError: string | null;
  priceLoading: boolean;
  isPositive: boolean;
  selectedTimeframe: PriceTimeframe;
  onTimeframeChange: (timeframe: PriceTimeframe) => void;
  onRetry: () => void;
}

export const AssetPriceChart = memo(function AssetPriceChart({
  assetType,
  priceData,
  priceError,
  priceLoading,
  isPositive,
  selectedTimeframe,
  onTimeframeChange,
  onRetry,
}: AssetPriceChartProps) {
  // Create stable callbacks for each timeframe
  const handleTimeframePress = useCallback((timeframe: PriceTimeframe) => {
    onTimeframeChange(timeframe);
  }, [onTimeframeChange]);

  // Memoize UNIT price data
  const unitData = useMemo(() => {
    if (assetType === 'UNIT') {
      return generateUnitPriceData(selectedTimeframe);
    }
    return null;
  }, [assetType, selectedTimeframe]);

  // Render timeframe buttons (shared between UNIT and BTC)
  const renderTimeframeButtons = useCallback((showLoading = false) => (
    <View style={styles.timeframeButtons}>
      {TIMEFRAMES.map((timeframe) => (
        <TimeframeButton
          key={timeframe}
          timeframe={timeframe}
          isActive={selectedTimeframe === timeframe}
          isLoading={showLoading && priceLoading}
          onPress={() => handleTimeframePress(timeframe as PriceTimeframe)}
        />
      ))}
    </View>
  ), [selectedTimeframe, priceLoading, handleTimeframePress]);

  // For UNIT, use generated data
  if (assetType === 'UNIT') {
    return (
      <View style={styles.chartContainer}>
        <PriceChart
          data={unitData}
          isPositive={true}
          minBoundary={0.5}
          maxBoundary={1.5}
        />
        {renderTimeframeButtons(false)}
      </View>
    );
  }

  // For BTC, use real data
  if (assetType !== 'BTC') return null;

  return (
    <View style={styles.chartContainer}>
      {priceError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {priceError.includes('Rate limit')
              ? 'Rate limit reached'
              : 'Failed to load price data'}
          </Text>
          <Text style={styles.errorSubtext}>
            {priceError.includes('Rate limit')
              ? 'Please wait a moment before retrying'
              : 'Check your connection and try again'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRetry}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : priceData ? (
        <>
          <PriceChart data={priceData} isPositive={isPositive} minBoundary={undefined} maxBoundary={undefined} />
          {renderTimeframeButtons(true)}
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  chartContainer: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginTop: 2,
  },
  timeframeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    marginTop: 4,
    paddingHorizontal: 5,
  },
  timeframeButton: {
    paddingHorizontal: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'transparent',
    minWidth: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  timeframeButtonText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    fontWeight: '700',
  },
  timeframeButtonTextActive: {
    color: COLORS.WHITE,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  errorText: {
    color: COLORS.RED,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 1.5,
  },
  errorSubtext: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 10,
  },
  retryButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
});
