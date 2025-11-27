/**
 * AssetPriceChart Component
 * Displays price chart with timeframe selector for BTC and UNIT assets
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
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
  currentPrice?: number | null;
}

// Price chip component - displays current price with chart-matching color
const PriceChip = memo(function PriceChip({ price, assetType, isPositive }: { price: number; assetType: 'BTC' | 'UNIT'; isPositive: boolean }) {
  const formattedPrice = assetType === 'BTC'
    ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${price.toFixed(2)}`;

  const chipColor = isPositive ? COLORS.SUCCESS_GREEN : COLORS.RED;

  return (
    <View style={[styles.priceChip, { backgroundColor: chipColor }]}>
      <Text style={styles.priceChipText}>{formattedPrice}</Text>
    </View>
  );
});

export const AssetPriceChart = memo(function AssetPriceChart({
  assetType,
  priceData,
  priceError,
  priceLoading,
  isPositive,
  selectedTimeframe,
  onTimeframeChange,
  onRetry,
  currentPrice,
}: AssetPriceChartProps) {
  // State for scrubbed price (when user is dragging on chart)
  const [scrubbedPrice, setScrubbedPrice] = useState<number | null>(null);

  // Handle scrub callback from chart
  const handleScrub = useCallback((price: number | null) => {
    setScrubbedPrice(price);
  }, []);

  // Create stable callbacks for each timeframe to prevent re-renders
  const handlePress1D = useCallback(() => onTimeframeChange('1D'), [onTimeframeChange]);
  const handlePress1W = useCallback(() => onTimeframeChange('1W'), [onTimeframeChange]);
  const handlePress1M = useCallback(() => onTimeframeChange('1M'), [onTimeframeChange]);
  const handlePress1Y = useCallback(() => onTimeframeChange('1Y'), [onTimeframeChange]);

  const timeframeHandlers = useMemo(() => ({
    '1D': handlePress1D,
    '1W': handlePress1W,
    '1M': handlePress1M,
    '1Y': handlePress1Y,
  }), [handlePress1D, handlePress1W, handlePress1M, handlePress1Y]);

  // Memoize UNIT price data
  const unitData = useMemo(() => {
    if (assetType === 'UNIT') {
      return generateUnitPriceData(selectedTimeframe);
    }
    return null;
  }, [assetType, selectedTimeframe]);

  // Memoize timeframe buttons to prevent re-renders
  const timeframeButtonsNoLoading = useMemo(() => (
    <View style={styles.timeframeButtons}>
      {TIMEFRAMES.map((timeframe) => (
        <TimeframeButton
          key={timeframe}
          timeframe={timeframe}
          isActive={selectedTimeframe === timeframe}
          isLoading={false}
          onPress={timeframeHandlers[timeframe as PriceTimeframe]}
        />
      ))}
    </View>
  ), [selectedTimeframe, timeframeHandlers]);

  const timeframeButtonsWithLoading = useMemo(() => (
    <View style={styles.timeframeButtons}>
      {TIMEFRAMES.map((timeframe) => (
        <TimeframeButton
          key={timeframe}
          timeframe={timeframe}
          isActive={selectedTimeframe === timeframe}
          isLoading={priceLoading}
          onPress={timeframeHandlers[timeframe as PriceTimeframe]}
        />
      ))}
    </View>
  ), [selectedTimeframe, priceLoading, timeframeHandlers]);

  // For UNIT, use generated data
  if (assetType === 'UNIT') {
    // Get the last price from the unit data
    const unitLastPrice = unitData && unitData.length > 0 ? unitData[unitData.length - 1][1] : 1.00;
    // Show scrubbed price when scrubbing, otherwise show the last price
    const unitDisplayPrice = scrubbedPrice ?? unitLastPrice;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartWrapper}>
          <PriceChart
            data={unitData}
            isPositive={true}
            minBoundary={0.5}
            maxBoundary={1.5}
            onScrub={handleScrub}
          />
          <PriceChip price={unitDisplayPrice} assetType="UNIT" isPositive={true} />
        </View>
        {timeframeButtonsNoLoading}
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
        (() => {
          // Get price from currentPrice prop or last value in chart data
          const defaultPrice = currentPrice ?? (priceData.length > 0 ? priceData[priceData.length - 1][1] : null);
          // Show scrubbed price when scrubbing, otherwise show the default price
          const displayPrice = scrubbedPrice ?? defaultPrice;
          return (
            <>
              <View style={styles.chartWrapper}>
                <PriceChart data={priceData} isPositive={isPositive} minBoundary={undefined} maxBoundary={undefined} onScrub={handleScrub} />
                {displayPrice && <PriceChip price={displayPrice} assetType="BTC" isPositive={isPositive} />}
              </View>
              {timeframeButtonsWithLoading}
            </>
          );
        })()
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
  chartWrapper: {
    position: 'relative',
  },
  priceChip: {
    position: 'absolute',
    top: 8,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priceChipText: {
    color: COLORS.WHITE,
    fontSize: 12,
    fontWeight: '700',
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
