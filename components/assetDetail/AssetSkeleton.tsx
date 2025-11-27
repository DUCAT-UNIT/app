/**
 * AssetSkeleton
 * Skeleton loading components for asset detail screens (BTC and UNIT)
 * Matches exact dimensions to prevent layout jumping
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../ui/SkeletonLoader';
import { COLORS } from '../../theme';

/**
 * Skeleton for the asset info section (balance, icon, etc.)
 */
export const AssetInfoSkeleton = React.memo(function AssetInfoSkeleton() {
  return (
    <View style={styles.assetInfoContainer}>
      {/* Asset Icon */}
      <SkeletonLoader width={60} height={60} borderRadius={30} />

      {/* Asset name */}
      <SkeletonLoader width={60} height={16} borderRadius={4} style={styles.assetNameMargin} />

      {/* Balance amount */}
      <SkeletonLoader width={180} height={31} borderRadius={4} style={styles.balanceMargin} />

      {/* Fiat value */}
      <SkeletonLoader width={120} height={20} borderRadius={4} style={styles.fiatMargin} />

      {/* Price change */}
      <SkeletonLoader width={100} height={16} borderRadius={4} style={styles.priceChangeMargin} />
    </View>
  );
});

/**
 * Skeleton for the price chart section
 */
export const AssetChartSkeleton = React.memo(function AssetChartSkeleton() {
  return (
    <View style={styles.chartContainer}>
      {/* Chart area */}
      <View style={styles.chartWrapper}>
        <SkeletonLoader width="100%" height={120} borderRadius={8} />
        {/* Price chip skeleton */}
        <View style={styles.priceChipSkeleton}>
          <SkeletonLoader width={80} height={24} borderRadius={12} />
        </View>
      </View>

      {/* Timeframe buttons */}
      <View style={styles.timeframeButtons}>
        {['1D', '1W', '1M', '1Y'].map((tf) => (
          <SkeletonLoader key={tf} width={64} height={44} borderRadius={10} />
        ))}
      </View>
    </View>
  );
});

/**
 * Skeleton for a single activity/transaction item
 */
const AssetActivityItemSkeleton = React.memo(function AssetActivityItemSkeleton() {
  return (
    <View style={styles.activityItem}>
      {/* Transaction icon */}
      <SkeletonLoader width={40} height={40} borderRadius={20} />

      {/* Transaction content */}
      <View style={styles.activityContent}>
        <View style={styles.activityTopRow}>
          {/* Type/status */}
          <SkeletonLoader width={80} height={16} borderRadius={4} />
          {/* Amount */}
          <SkeletonLoader width={100} height={16} borderRadius={4} />
        </View>
        <View style={styles.activityBottomRow}>
          {/* Date/address */}
          <SkeletonLoader width={120} height={14} borderRadius={4} />
          {/* Fiat value */}
          <SkeletonLoader width={60} height={14} borderRadius={4} />
        </View>
      </View>
    </View>
  );
});

/**
 * Skeleton for the activity list (shows 5 placeholder items)
 */
export const AssetActivityListSkeleton = React.memo(function AssetActivityListSkeleton() {
  return (
    <View style={styles.activityContainer}>
      <AssetActivityItemSkeleton />
      <AssetActivityItemSkeleton />
      <AssetActivityItemSkeleton />
      <AssetActivityItemSkeleton />
      <AssetActivityItemSkeleton />
    </View>
  );
});

/**
 * Skeleton for tabs section
 */
export const AssetTabsSkeleton = React.memo(function AssetTabsSkeleton() {
  return (
    <View style={styles.tabsContainer}>
      <SkeletonLoader width={80} height={32} borderRadius={8} style={styles.tabItem} />
      <SkeletonLoader width={80} height={32} borderRadius={8} style={styles.tabItem} />
    </View>
  );
});

/**
 * Combined skeleton for the full asset detail page
 */
export const AssetDetailSkeleton = React.memo(function AssetDetailSkeleton() {
  return (
    <View style={styles.fullPageContainer}>
      <AssetInfoSkeleton />
      <AssetChartSkeleton />
      <AssetTabsSkeleton />
      <AssetActivityListSkeleton />
    </View>
  );
});

const styles = StyleSheet.create({
  // Asset info skeleton styles
  assetInfoContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 180, // Fixed height to prevent jumping
  },
  assetNameMargin: {
    marginTop: 8,
  },
  balanceMargin: {
    marginTop: 12,
  },
  fiatMargin: {
    marginTop: 8,
  },
  priceChangeMargin: {
    marginTop: 12,
  },

  // Chart skeleton styles
  chartContainer: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginTop: 2,
    minHeight: 180, // Fixed height to prevent jumping
  },
  chartWrapper: {
    position: 'relative',
    paddingHorizontal: 16,
  },
  priceChipSkeleton: {
    position: 'absolute',
    top: 8,
    right: 24,
  },
  timeframeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    marginTop: 12,
    paddingHorizontal: 5,
  },

  // Activity list skeleton styles
  activityContainer: {
    paddingHorizontal: 16,
    minHeight: 300, // Fixed height to prevent jumping
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activityBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Tabs skeleton styles
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 16,
    minHeight: 56, // Fixed height to prevent jumping
  },
  tabItem: {
    marginHorizontal: 4,
  },

  // Full page container
  fullPageContainer: {
    flex: 1,
  },
});

export default AssetDetailSkeleton;
