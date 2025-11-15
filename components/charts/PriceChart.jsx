/**
 * PriceChart Component
 * Displays a line chart for asset price history
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-svg-charts';
import { COLORS } from '../../theme';

export default function PriceChart({ data, isPositive }) {
  console.log('PriceChart received:', {
    hasData: !!data,
    dataLength: data?.length,
    isPositive,
    firstItem: data?.[0],
    lastItem: data?.[data.length - 1]
  });

  if (!data || data.length === 0) {
    console.log('PriceChart: No data, showing empty state');
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  // Extract prices from the data array
  const prices = data.map(item => item[1]);
  console.log('PriceChart prices:', {
    count: prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    first: prices[0],
    last: prices[prices.length - 1]
  });

  // Calculate min and max for better Y-axis scaling
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const yPadding = priceRange * 0.05; // Add 5% padding for breathing room

  const strokeColor = isPositive ? COLORS.SUCCESS_GREEN : COLORS.RED;

  console.log('Rendering LineChart with:', {
    containerHeight: 220,
    chartHeight: '100%',
    dataPoints: prices.length,
    strokeColor,
    isPositive
  });

  return (
    <View style={styles.container}>
      <LineChart
        style={{ height: 220, width: '100%' }}
        data={prices}
        svg={{
          stroke: strokeColor,
          strokeWidth: 3,
        }}
        contentInset={{ top: 20, bottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    width: '100%',
    marginBottom: 20,
  },
  chart: {
    flex: 1,
  },
  emptyContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.GRAY,
    fontSize: 14,
  },
});