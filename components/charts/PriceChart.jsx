/**
 * PriceChart Component
 * Displays a line chart for asset price history
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-svg-charts';
import { COLORS } from '../../theme';

export default function PriceChart({ data, isPositive }) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  // Extract prices from the data array
  const prices = data.map(item => item[1]);

  // Calculate min and max for better Y-axis scaling
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const yPadding = priceRange * 0.05; // Add 5% padding for breathing room

  return (
    <View style={styles.container}>
      <LineChart
        style={styles.chart}
        data={prices}
        svg={{
          stroke: isPositive ? COLORS.SUCCESS : COLORS.ERROR,
          strokeWidth: 2.5,
        }}
        contentInset={{ top: 10, bottom: 10, left: 0, right: 0 }}
        yMin={minPrice - yPadding}
        yMax={maxPrice + yPadding}
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