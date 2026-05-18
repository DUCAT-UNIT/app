/**
 * PriceChart Component
 * Displays a crypto-style gradient chart for asset price history
 * Supports interactive scrubbing to show price at any point
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { COLORS } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PriceChartProps {
  data: [number, number][] | null;
  isPositive: boolean;
  minBoundary?: number;
  maxBoundary?: number;
  onScrub?: (price: number | null, timestamp: number | null) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  width?: number;
  height?: number;
}

function PriceChart({
  data,
  isPositive,
  minBoundary,
  maxBoundary,
  onScrub,
  onScrubStart,
  onScrubEnd,
  width,
  height,
}: PriceChartProps) {
  // State for scrubber position
  const [scrubX, setScrubX] = useState<number | null>(null);
  const [scrubY, setScrubY] = useState<number | null>(null);

  // Memoize chart calculations to prevent re-renders
  // IMPORTANT: Hook must be called before any conditional returns
  const chartPaths = useMemo(() => {
    // Return null if no data - will render empty state below
    if (!data || data.length === 0) {
      return null;
    }

    const prices: number[] = [];
    let dataMinPrice = Number.POSITIVE_INFINITY;
    let dataMaxPrice = Number.NEGATIVE_INFINITY;

    data.forEach((item) => {
      const price = item[1];
      prices.push(price);
      dataMinPrice = Math.min(dataMinPrice, price);
      dataMaxPrice = Math.max(dataMaxPrice, price);
    });

    // Chart dimensions - use props or defaults
    const chartWidth = width ?? SCREEN_WIDTH;
    const chartHeight = height ?? 143;
    // top padding: chip is ~28px (8px top + 4px padding + 12px font + 4px padding) + 2px gap
    const padding = { top: 30, right: 0, bottom: 0, left: 0 };

    const drawWidth = chartWidth - padding.left - padding.right;
    const drawHeight = chartHeight - padding.top - padding.bottom;

    // Find min and max for scaling
    // If boundaries are provided, use them instead of auto-scaling
    let minPrice: number;
    let maxPrice: number;
    if (minBoundary !== undefined && maxBoundary !== undefined) {
      minPrice = minBoundary;
      maxPrice = maxBoundary;
    } else {
      minPrice = dataMinPrice;
      maxPrice = dataMaxPrice;
    }
    const priceRange = maxPrice - minPrice || 1;

    const points = prices.map((price, index) => {
      const denominator = Math.max(prices.length - 1, 1);
      const x = padding.left + (index / denominator) * drawWidth;
      const y = padding.top + ((maxPrice - price) / priceRange) * drawHeight;
      return { x, y };
    });

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currentPoint = points[i];
      const cp1x = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.5;
      const cp1y = prevPoint.y;
      const cp2x = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.5;
      const cp2y = currentPoint.y;

      linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${currentPoint.x} ${currentPoint.y}`;
    }

    // Generate the filled area path
    const generateAreaPath = () => {
      if (!linePath) return '';

      // Start from bottom left
      let areaPath = `M ${padding.left} ${chartHeight}`;

      // Add the line path
      areaPath += ` L ${padding.left} ${points[0].y}`;
      areaPath += linePath.substring(1); // Remove the initial M command

      // Close at bottom right
      areaPath += ` L ${chartWidth - padding.right} ${chartHeight}`;
      areaPath += ` L ${padding.left} ${chartHeight}`;
      areaPath += ' Z';

      return areaPath;
    };

    return {
      linePath,
      areaPath: generateAreaPath(),
      chartWidth,
      chartHeight,
      prices,
      padding,
      drawWidth,
      drawHeight,
      minPrice,
      maxPrice,
      priceRange,
    };
  }, [data, minBoundary, maxBoundary, width, height]);

  // Calculate price and Y position from X position
  const getPriceAtX = useCallback(
    (x: number) => {
      if (!chartPaths || !data || data.length === 0)
        return { price: null, y: null, timestamp: null };

      const { padding, drawWidth, prices, maxPrice, priceRange, drawHeight } = chartPaths;

      // Clamp x to chart bounds
      const clampedX = Math.max(padding.left, Math.min(x, padding.left + drawWidth));

      // Calculate which data point we're closest to
      const ratio = (clampedX - padding.left) / drawWidth;
      const index = Math.round(ratio * (prices.length - 1));
      const clampedIndex = Math.max(0, Math.min(index, prices.length - 1));

      const price = prices[clampedIndex];
      const timestamp = data[clampedIndex][0];

      // Calculate Y position for the dot
      const y = padding.top + ((maxPrice - price) / priceRange) * drawHeight;

      return { price, y, timestamp };
    },
    [chartPaths, data]
  );

  // Handle touch/pan events
  const handleScrubStart = useCallback(
    (x: number) => {
      const { price, y, timestamp } = getPriceAtX(x);
      setScrubX(x);
      setScrubY(y);
      if (onScrubStart) onScrubStart();
      if (onScrub) onScrub(price, timestamp);
    },
    [getPriceAtX, onScrub, onScrubStart]
  );

  const handleScrubMove = useCallback(
    (x: number) => {
      const { price, y, timestamp } = getPriceAtX(x);
      setScrubX(x);
      setScrubY(y);
      if (onScrub) onScrub(price, timestamp);
    },
    [getPriceAtX, onScrub]
  );

  const handleScrubEnd = useCallback(() => {
    setScrubX(null);
    setScrubY(null);
    if (onScrubEnd) onScrubEnd();
    if (onScrub) onScrub(null, null);
  }, [onScrub, onScrubEnd]);

  // Create pan responder for gesture handling
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false, // Prevent parent ScrollView from stealing gesture
        onShouldBlockNativeResponder: () => true, // Block native scroll while scrubbing
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          handleScrubStart(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt: GestureResponderEvent) => {
          handleScrubMove(evt.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          handleScrubEnd();
        },
        onPanResponderTerminate: () => {
          handleScrubEnd();
        },
      }),
    [handleScrubStart, handleScrubMove, handleScrubEnd]
  );

  const strokeColor = isPositive ? COLORS.SUCCESS_GREEN : COLORS.RED;

  // Render empty state if no chart data
  if (!chartPaths) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { height: chartPaths.chartHeight, width: chartPaths.chartWidth }]}
      {...panResponder.panHandlers}
    >
      <Svg width={chartPaths.chartWidth} height={chartPaths.chartHeight}>
        <Defs>
          <LinearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <Stop offset="50%" stopColor={strokeColor} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <G>
          {/* Filled area with gradient */}
          <Path d={chartPaths.areaPath} fill="url(#chartGradient)" />

          {/* Line stroke on top */}
          <Path
            d={chartPaths.linePath}
            stroke={strokeColor}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Scrubber line and dot */}
          {scrubX !== null && scrubY !== null && (
            <>
              {/* Vertical line - starts from bottom of ball (scrubY + 6) to chart bottom */}
              <Line
                x1={scrubX}
                y1={scrubY + 6}
                x2={scrubX}
                y2={chartPaths.chartHeight}
                stroke={strokeColor}
                strokeWidth={0.5}
              />
              {/* Dot on the line */}
              <Circle cx={scrubX} cy={scrubY} r={6} fill={strokeColor} />
              <Circle cx={scrubX} cy={scrubY} r={3} fill={COLORS.WHITE} />
            </>
          )}
        </G>
      </Svg>
    </View>
  );
}

// Custom comparison function for React.memo
const arePropsEqual = (prevProps: PriceChartProps, nextProps: PriceChartProps) => {
  // Only re-render if data array reference, isPositive, boundaries, dimensions, or callbacks actually change
  return (
    prevProps.data === nextProps.data &&
    prevProps.isPositive === nextProps.isPositive &&
    prevProps.minBoundary === nextProps.minBoundary &&
    prevProps.maxBoundary === nextProps.maxBoundary &&
    prevProps.onScrub === nextProps.onScrub &&
    prevProps.onScrubStart === nextProps.onScrubStart &&
    prevProps.onScrubEnd === nextProps.onScrubEnd &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(PriceChart, arePropsEqual);

const styles = StyleSheet.create({
  container: {
    height: 143,
    width: '100%',
    marginBottom: 5,
  },
  emptyContainer: {
    height: 143,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
  },
});
