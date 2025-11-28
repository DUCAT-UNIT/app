/**
 * VaultSkeleton
 * Skeleton loading component for vault page
 * Matches exact dimensions of VaultHealthGauge and chart to prevent layout jumping
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../ui/SkeletonLoader';
import { COLORS } from '../../theme';

/**
 * Skeleton for the main vault gauge card
 * Matches VaultHealthGauge layout
 */
export const VaultGaugeSkeleton = React.memo(function VaultGaugeSkeleton() {
  return (
    <View style={styles.container}>
      {/* Main card matching VaultHealthGauge */}
      <View style={styles.card}>
        <View style={styles.mainRow}>
          {/* Left Column - Stats skeleton */}
          <View style={styles.leftColumn}>
            {/* Collateral stat */}
            <View style={styles.statContainer}>
              <SkeletonLoader width={60} height={11} borderRadius={4} />
              <View style={styles.statValueRow}>
                <SkeletonLoader width={80} height={14} borderRadius={4} style={styles.statValueMargin} />
              </View>
            </View>

            {/* Separator */}
            <View style={styles.statSeparator} />

            {/* Debt stat */}
            <View style={styles.statContainer}>
              <SkeletonLoader width={60} height={11} borderRadius={4} />
              <View style={styles.statValueRow}>
                <SkeletonLoader width={70} height={14} borderRadius={4} style={styles.statValueMargin} />
              </View>
            </View>

            {/* Separator */}
            <View style={styles.statSeparator} />

            {/* Liquidation stat */}
            <View style={styles.statContainer}>
              <SkeletonLoader width={70} height={11} borderRadius={4} />
              <SkeletonLoader width={60} height={14} borderRadius={4} style={styles.statValueMargin} />
            </View>
          </View>

          {/* Vertical Divider */}
          <View style={styles.verticalDivider} />

          {/* Gauge skeleton - semicircle */}
          <View style={styles.gaugeContainer}>
            <View style={styles.gaugePlaceholder}>
              {/* Semicircular arc skeleton */}
              <SkeletonLoader width={140} height={70} borderRadius={70} style={styles.arcSkeleton} />
              {/* Center text placeholder */}
              <View style={styles.centerText}>
                <SkeletonLoader width={60} height={20} borderRadius={4} />
                <SkeletonLoader width={50} height={28} borderRadius={4} style={styles.centerValueMargin} />
              </View>
            </View>
          </View>
        </View>

        {/* Horizontal Divider */}
        <View style={styles.horizontalDivider} />

        {/* Capacity section skeleton */}
        <View style={styles.capacitySection}>
          <View style={styles.capacityLabelsRow}>
            <View>
              <SkeletonLoader width={40} height={11} borderRadius={4} />
              <SkeletonLoader width={60} height={14} borderRadius={4} style={styles.capacityValueMargin} />
            </View>
            <View style={styles.capacityRightAlign}>
              <SkeletonLoader width={50} height={11} borderRadius={4} />
              <SkeletonLoader width={60} height={14} borderRadius={4} style={styles.capacityValueMargin} />
            </View>
          </View>
          {/* Capacity bar skeleton */}
          <View style={styles.capacityBarContainer}>
            <SkeletonLoader width="100%" height={8} borderRadius={4} />
          </View>
        </View>
      </View>

      {/* Action buttons skeleton */}
      <View style={styles.actionsRow}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.actionButton}>
            <SkeletonLoader width={50} height={50} borderRadius={8} />
            <SkeletonLoader width={40} height={13} borderRadius={4} style={styles.actionLabelMargin} />
          </View>
        ))}
      </View>
    </View>
  );
});

/**
 * Skeleton for the vault health chart
 * Matches VaultHealthChartView layout
 */
export const VaultChartSkeleton = React.memo(function VaultChartSkeleton() {
  return (
    <View style={styles.chartContainer}>
      {/* Chart card */}
      <View style={styles.chartCard}>
        {/* Timeframe buttons skeleton */}
        <View style={styles.timeframeRow}>
          {['1D', '1W', '1M', '1Y'].map((tf) => (
            <SkeletonLoader key={tf} width={40} height={28} borderRadius={6} style={styles.timeframeButton} />
          ))}
        </View>

        {/* Chart area skeleton */}
        <View style={styles.chartArea}>
          {/* Y-axis labels */}
          <View style={styles.yAxisLabels}>
            <SkeletonLoader width={30} height={10} borderRadius={2} />
            <SkeletonLoader width={30} height={10} borderRadius={2} />
            <SkeletonLoader width={30} height={10} borderRadius={2} />
          </View>
          {/* Chart line placeholder */}
          <View style={styles.chartLinePlaceholder}>
            <SkeletonLoader width="100%" height={100} borderRadius={4} />
          </View>
        </View>

        {/* X-axis labels skeleton */}
        <View style={styles.xAxisLabels}>
          <SkeletonLoader width={30} height={10} borderRadius={2} />
          <SkeletonLoader width={30} height={10} borderRadius={2} />
          <SkeletonLoader width={30} height={10} borderRadius={2} />
          <SkeletonLoader width={30} height={10} borderRadius={2} />
        </View>
      </View>
    </View>
  );
});

/**
 * Combined skeleton for the full vault info section
 */
export const VaultInfoSkeleton = React.memo(function VaultInfoSkeleton() {
  return (
    <View style={styles.vaultInfoContainer}>
      <VaultGaugeSkeleton />
      <VaultChartSkeleton />
    </View>
  );
});

/**
 * Skeleton for a single vault activity item
 */
const VaultActivityItemSkeleton = React.memo(function VaultActivityItemSkeleton() {
  return (
    <View style={styles.activityItem}>
      {/* Icon placeholder */}
      <SkeletonLoader width={40} height={40} borderRadius={8} />
      {/* Content */}
      <View style={styles.activityContent}>
        <View style={styles.activityTopRow}>
          {/* Action name */}
          <SkeletonLoader width={80} height={16} borderRadius={4} />
          {/* Right side: chip + amount */}
          <View style={styles.activityRightGroup}>
            <SkeletonLoader width={70} height={22} borderRadius={4} />
            <SkeletonLoader width={60} height={14} borderRadius={4} style={styles.activityAmountMargin} />
          </View>
        </View>
        {/* Date */}
        <SkeletonLoader width={100} height={13} borderRadius={4} style={styles.activityDateMargin} />
      </View>
    </View>
  );
});

/**
 * Skeleton for vault activity list
 * Shows 3 placeholder items
 */
export const VaultActivityListSkeleton = React.memo(function VaultActivityListSkeleton() {
  return (
    <View style={styles.activityListContainer}>
      <VaultActivityItemSkeleton />
      <VaultActivityItemSkeleton />
      <VaultActivityItemSkeleton />
    </View>
  );
});

const styles = StyleSheet.create({
  // Main container matching VaultHealthGauge exactly
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  card: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center', // Match VaultHealthGauge
  },
  leftColumn: {
    flex: 2,
    paddingLeft: 16,
    marginVertical: 8,
    alignSelf: 'stretch', // Match VaultHealthGauge
  },
  statContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center', // Match VaultHealthGauge
  },
  statSeparator: {
    height: 1,
    backgroundColor: COLORS.DARK_GRAY,
    marginVertical: 4,
    marginLeft: -16, // Match VaultHealthGauge
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValueMargin: {
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: COLORS.DARK_GRAY,
    alignSelf: 'stretch', // Match VaultHealthGauge
  },
  gaugeContainer: {
    flex: 3,
    aspectRatio: 1.5, // Match VaultHealthGauge exactly
    paddingRight: 4,
    justifyContent: 'center',
  },
  gaugePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arcSkeleton: {
    marginBottom: -20,
  },
  centerText: {
    alignItems: 'center',
    marginTop: 8,
  },
  centerValueMargin: {
    marginTop: 4,
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: COLORS.DARK_GRAY,
    marginHorizontal: 16,
  },
  capacitySection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  capacityLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  capacityRightAlign: {
    alignItems: 'flex-end',
  },
  capacityValueMargin: {
    marginTop: 4,
  },
  capacityBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 13, // Match VaultHealthGauge exactly
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 62,
  },
  actionLabelMargin: {
    marginTop: 2, // Match VaultHealthGauge marginBottom: 2
  },

  // Chart skeleton styles
  chartContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chartCard: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
    borderRadius: 12,
    padding: 16,
    minHeight: 200, // Fixed height to prevent jumping
  },
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  timeframeButton: {
    marginHorizontal: 4,
  },
  chartArea: {
    flexDirection: 'row',
    height: 120,
  },
  yAxisLabels: {
    width: 35,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  chartLinePlaceholder: {
    flex: 1,
    justifyContent: 'center',
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingLeft: 35,
  },

  // Full vault info container
  vaultInfoContainer: {
    paddingVertical: 8,
  },

  // Activity list skeleton styles
  activityListContainer: {
    paddingHorizontal: 16,
    minHeight: 200, // Fixed height to prevent jumping
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
    paddingHorizontal: 8,
  },
  activityContent: {
    flex: 1,
    marginLeft: 10,
  },
  activityTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityAmountMargin: {
    marginLeft: 12,
  },
  activityDateMargin: {
    marginTop: 4,
  },
});

export default VaultInfoSkeleton;
