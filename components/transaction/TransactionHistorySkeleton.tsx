/**
 * TransactionHistorySkeleton
 * Skeleton loading component for transaction history screen
 * Matches transaction item layout to prevent layout jumping
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonLoader from '../ui/SkeletonLoader';
import { COLORS } from '../../theme';

/**
 * Skeleton for a single transaction item
 */
const TransactionItemSkeleton = React.memo(function TransactionItemSkeleton() {
  return (
    <View style={styles.transactionItem}>
      {/* Transaction icon */}
      <SkeletonLoader width={40} height={40} borderRadius={20} />

      {/* Transaction content */}
      <View style={styles.transactionContent}>
        <View style={styles.topRow}>
          {/* Type/status */}
          <SkeletonLoader width={80} height={16} borderRadius={4} />
          {/* Amount */}
          <SkeletonLoader width={100} height={16} borderRadius={4} />
        </View>
        <View style={styles.bottomRow}>
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
 * Skeleton for transaction history list (shows 8 placeholder items for bottom sheet)
 */
export const TransactionHistorySkeleton = React.memo(function TransactionHistorySkeleton() {
  return (
    <View style={styles.container}>
      <TransactionItemSkeleton />
      <TransactionItemSkeleton />
      <TransactionItemSkeleton />
      <TransactionItemSkeleton />
      <TransactionItemSkeleton />
      <TransactionItemSkeleton />
      <TransactionItemSkeleton />
      <TransactionItemSkeleton />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    flex: 1,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
  },
  transactionContent: {
    flex: 1,
    marginLeft: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default TransactionHistorySkeleton;
