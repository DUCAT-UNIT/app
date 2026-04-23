/**
 * AssetPriceChart Component
 * Displays price chart with timeframe selector for BTC and UNIT assets
 * Uses responsive scaling with s() and sf() functions
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import PriceChart from '../charts/PriceChart';
import { COLORS } from '../../theme';
import { generateUnitPriceData, generateUsdcPriceData, PriceTimeframe, PriceDataPoint } from '../../utils/priceDataGenerator';
import { formatFiat } from '../../utils/formatters';
import { AssetChartSkeleton } from './AssetSkeleton';
import { useResponsive } from '../../hooks/useResponsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TIMEFRAMES = ['1D', '1W', '1M', '1Y'];

interface AssetPriceChartProps {
  assetType: 'BTC' | 'UNIT' | 'USDC';
  priceData: PriceDataPoint[] | null;
  priceError: string | null;
  priceLoading: boolean;
  isPositive: boolean;
  selectedTimeframe: PriceTimeframe;
  onTimeframeChange: (timeframe: PriceTimeframe) => void;
  onRetry: () => void;
  currentPrice?: number | null;
  width?: number;
  height?: number;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
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
  currentPrice,
  width,
  height,
  onScrubStart,
  onScrubEnd,
}: AssetPriceChartProps) {
  const { s, sf } = useResponsive();
  const [scrubbedPrice, setScrubbedPrice] = useState<number | null>(null);

  const handleScrub = useCallback((price: number | null) => {
    setScrubbedPrice(price);
  }, []);

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

  const unitData = useMemo(() => {
    if (assetType === 'UNIT') {
      return generateUnitPriceData(selectedTimeframe);
    }
    return null;
  }, [assetType, selectedTimeframe]);

  const usdcData = useMemo(() => {
    if (assetType === 'USDC') {
      return generateUsdcPriceData(selectedTimeframe);
    }
    return null;
  }, [assetType, selectedTimeframe]);

  // Price chip component
  const renderPriceChip = (price: number, chipIsPositive: boolean) => {
    const formattedPrice = `$${formatFiat(price)}`;
    const chipColor = chipIsPositive ? COLORS.SUCCESS_GREEN : COLORS.RED;
    const chipBgColor = chipIsPositive ? 'rgba(89, 170, 138, 0.1)' : 'rgba(208, 76, 104, 0.1)';

    return (
      <View style={{
        position: 'absolute',
        top: s(8),
        right: 0,
        paddingHorizontal: s(10),
        paddingVertical: s(4),
        borderRadius: s(12),
        borderWidth: 1,
        backgroundColor: chipBgColor,
        borderColor: chipColor,
      }}>
        <Text style={{ fontSize: sf(12), fontWeight: '700', color: chipColor }}>
          {formattedPrice}
        </Text>
      </View>
    );
  };

  // Timeframe buttons
  const renderTimeframeButtons = (showLoading: boolean) => (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'center',
      gap: s(3),
      marginTop: s(4),
      paddingHorizontal: s(5),
    }}>
      {TIMEFRAMES.map((timeframe) => {
        const isActive = selectedTimeframe === timeframe;
        return (
          <TouchableOpacity
            key={timeframe}
            style={{
              paddingHorizontal: s(2),
              paddingVertical: s(12),
              borderRadius: s(10),
              backgroundColor: isActive ? COLORS.VERY_DARK_GRAY : 'transparent',
              minWidth: s(64),
              height: s(44),
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={timeframeHandlers[timeframe as PriceTimeframe]}
          >
            {showLoading && priceLoading && isActive ? (
              <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
            ) : (
              <Text style={{
                color: isActive ? COLORS.WHITE : COLORS.SECONDARY_TEXT,
                fontSize: sf(13),
                fontWeight: '700',
              }}>
                {timeframe}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Calculate chart width accounting for 24px padding on each side
  const chartWidth = width ?? (SCREEN_WIDTH - s(24) * 2);

  // For UNIT, use generated data
  if (assetType === 'UNIT') {
    const unitLastPrice = unitData && unitData.length > 0 ? unitData[unitData.length - 1][1] : 1.00;
    const unitDisplayPrice = scrubbedPrice ?? unitLastPrice;

    return (
      <View style={{ paddingVertical: s(4), paddingHorizontal: s(24), marginTop: s(2) }}>
        <View style={{ position: 'relative' }}>
          <PriceChart
            data={unitData}
            isPositive={true}
            minBoundary={0.5}
            maxBoundary={1.5}
            onScrub={handleScrub}
            onScrubStart={onScrubStart}
            onScrubEnd={onScrubEnd}
            width={chartWidth}
            height={height}
          />
          {renderPriceChip(unitDisplayPrice, true)}
        </View>
        {renderTimeframeButtons(false)}
      </View>
    );
  }

  if (assetType === 'USDC') {
    const usdcLastPrice = usdcData && usdcData.length > 0 ? usdcData[usdcData.length - 1][1] : 1.0;
    const usdcDisplayPrice = scrubbedPrice ?? usdcLastPrice;

    return (
      <View style={{ paddingVertical: s(4), paddingHorizontal: s(24), marginTop: s(2) }}>
        <View style={{ position: 'relative' }}>
          <PriceChart
            data={usdcData}
            isPositive={true}
            minBoundary={0.9975}
            maxBoundary={1.0025}
            onScrub={handleScrub}
            onScrubStart={onScrubStart}
            onScrubEnd={onScrubEnd}
            width={chartWidth}
            height={height}
          />
          {renderPriceChip(usdcDisplayPrice, true)}
        </View>
        {renderTimeframeButtons(false)}
      </View>
    );
  }

  if (assetType !== 'BTC') return null;

  if (!priceData && !priceError && priceLoading) {
    return <AssetChartSkeleton />;
  }

  return (
    <View style={{ paddingVertical: s(4), paddingHorizontal: s(24), marginTop: s(2) }}>
      {priceError ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: s(10) }}>
          <Text style={{ color: COLORS.RED, fontSize: sf(15), fontWeight: '600', marginBottom: s(1.5) }}>
            {priceError.includes('Rate limit') ? 'Rate limit reached' : 'Failed to load price data'}
          </Text>
          <Text style={{ color: COLORS.SECONDARY_TEXT, fontSize: sf(13), marginBottom: s(4), textAlign: 'center' }}>
            {priceError.includes('Rate limit')
              ? 'Please wait a moment before retrying'
              : 'Check your connection and try again'}
          </Text>
          <TouchableOpacity
            style={{
              paddingHorizontal: s(6),
              paddingVertical: s(2.5),
              backgroundColor: COLORS.PRIMARY_BLUE,
              borderRadius: s(10),
            }}
            onPress={onRetry}
          >
            <Text style={{ color: COLORS.WHITE, fontSize: sf(14), fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : priceData ? (
        <>
          <View style={{ position: 'relative' }}>
            <PriceChart
              data={priceData}
              isPositive={isPositive}
              minBoundary={undefined}
              maxBoundary={undefined}
              onScrub={handleScrub}
              onScrubStart={onScrubStart}
              onScrubEnd={onScrubEnd}
              width={chartWidth}
              height={height}
            />
            {(() => {
              const defaultPrice = currentPrice ?? (priceData.length > 0 ? priceData[priceData.length - 1][1] : null);
              const displayPrice = scrubbedPrice ?? defaultPrice;
              return displayPrice ? renderPriceChip(displayPrice, isPositive) : null;
            })()}
          </View>
          {renderTimeframeButtons(true)}
        </>
      ) : null}
    </View>
  );
});
