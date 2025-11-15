/**
 * PriceChart Component
 * Displays a crypto-style gradient chart for asset price history
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { COLORS } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function PriceChart({ data, isPositive, minBoundary, maxBoundary }) {
  // Memoize chart calculations to prevent re-renders
  // IMPORTANT: Hook must be called before any conditional returns
  const chartPaths = useMemo(() => {
    // Return null if no data - will render empty state below
    if (!data || data.length === 0) {
      return null;
    }

    // Extract prices from the data array
    const prices = data.map(item => item[1]);

    // Chart dimensions
    const chartWidth = SCREEN_WIDTH;
    const chartHeight = 143;
    const padding = { top: 13, right: 0, bottom: 0, left: 0 };

    const drawWidth = chartWidth - padding.left - padding.right;
    const drawHeight = chartHeight - padding.top - padding.bottom;

    // Find min and max for scaling
    // If boundaries are provided, use them instead of auto-scaling
    let minPrice, maxPrice;
    if (minBoundary !== undefined && maxBoundary !== undefined) {
      minPrice = minBoundary;
      maxPrice = maxBoundary;
    } else {
      minPrice = Math.min(...prices) * 0.995;
      maxPrice = Math.max(...prices) * 1.005;
    }
    const priceRange = maxPrice - minPrice;

    // Generate smooth curve path using bezier curves
    const generatePath = () => {
      if (prices.length === 0) return '';

      let path = '';
      const points = [];

      // Calculate all points
      prices.forEach((price, index) => {
        const x = padding.left + (index / (prices.length - 1)) * drawWidth;
        const y = padding.top + ((maxPrice - price) / priceRange) * drawHeight;
        points.push({ x, y });
      });

      // Start the path
      path = `M ${points[0].x} ${points[0].y}`;

      // Create smooth bezier curves between points
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1];
        const currentPoint = points[i];

        // Control points for smooth curve
        const cp1x = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.5;
        const cp1y = prevPoint.y;
        const cp2x = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.5;
        const cp2y = currentPoint.y;

        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${currentPoint.x} ${currentPoint.y}`;
      }

      return path;
    };

    // Generate the filled area path
    const generateAreaPath = () => {
      const linePath = generatePath();
      if (!linePath) return '';

      // Start from bottom left
      let areaPath = `M ${padding.left} ${chartHeight}`;

      // Add the line path
      areaPath += ` L ${padding.left} ${padding.top + ((maxPrice - prices[0]) / priceRange) * drawHeight}`;
      areaPath += linePath.substring(1); // Remove the initial M command

      // Close at bottom right
      areaPath += ` L ${chartWidth - padding.right} ${chartHeight}`;
      areaPath += ` L ${padding.left} ${chartHeight}`;
      areaPath += ' Z';

      return areaPath;
    };

    return {
      linePath: generatePath(),
      areaPath: generateAreaPath(),
      chartWidth,
      chartHeight
    };
  }, [data, minBoundary, maxBoundary]);

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
    <View style={styles.container}>
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
          <Path
            d={chartPaths.areaPath}
            fill="url(#chartGradient)"
          />

          {/* Line stroke on top */}
          <Path
            d={chartPaths.linePath}
            stroke={strokeColor}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      </Svg>
    </View>
  );
}

// Custom comparison function for React.memo
const arePropsEqual = (prevProps, nextProps) => {
  // Only re-render if data array reference, isPositive, or boundaries actually change
  return (
    prevProps.data === nextProps.data &&
    prevProps.isPositive === nextProps.isPositive &&
    prevProps.minBoundary === nextProps.minBoundary &&
    prevProps.maxBoundary === nextProps.maxBoundary
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
    color: COLORS.GRAY,
    fontSize: 14,
  },
});
