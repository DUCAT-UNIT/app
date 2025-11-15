/**
 * PriceChart Component
 * Displays a line chart for asset price history
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart, Grid, YAxis } from 'react-native-svg-charts';
import { COLORS } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const yPadding = priceRange * 0.1; // Add 10% padding

  return (
    <View style={styles.container}>
      <View style={styles.chartWrapper}>
        <YAxis
          data={prices}
          contentInset={{ top: 20, bottom: 20 }}
          svg={{
            fill: COLORS.GRAY,
            fontSize: 10,
          }}
          style={styles.yAxis}
          numberOfTicks={5}
          formatLabel={(value) => `$${(value / 1000).toFixed(0)}k`}
          min={minPrice - yPadding}
          max={maxPrice + yPadding}
        />

        <View style={styles.chart}>
          <LineChart
            style={{ flex: 1, height: 200 }}
            data={prices}
            svg={{
              stroke: isPositive ? COLORS.SUCCESS : COLORS.ERROR,
              strokeWidth: 2,
            }}
            contentInset={{ top: 20, bottom: 20, left: 10, right: 10 }}
            yMin={minPrice - yPadding}
            yMax={maxPrice + yPadding}
          >
            <Grid svg={{ stroke: COLORS.CARD_BG }} />
          </LineChart>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    marginBottom: 16,
  },
  chartWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  yAxis: {
    marginRight: 8,
    width: 50,
  },
  chart: {
    flex: 1,
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
  },
  emptyText: {
    color: COLORS.GRAY,
    fontSize: 14,
  },
});