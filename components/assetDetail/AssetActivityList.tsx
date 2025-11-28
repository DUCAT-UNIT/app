/**
 * AssetActivityList Component
 * Displays transaction list with loading, empty states, and pagination
 */

import React, { useState, useCallback, memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import TransactionItem, { Transaction } from '../transaction/TransactionItem';
import { COLORS } from '../../theme';
import globalStyles from '../../styles';
import { AssetActivityListSkeleton } from './AssetSkeleton';
import type { ProcessedTransaction } from '../../hooks/useAssetTransactions';

// Accept either the strict Transaction type or the more flexible ProcessedTransaction
type ActivityTransaction = Transaction | ProcessedTransaction;

export interface AssetActivityListProps {
  transactions: ActivityTransaction[];
  isLoading: boolean;
  onTransactionPress: (tx: ActivityTransaction) => void;
  advancedMode?: boolean;
  testID?: string;
}

// Re-export Transaction type for consumers
export type { Transaction, ActivityTransaction };

// Estimated height for each transaction item (used for getItemLayout optimization)
const TRANSACTION_ITEM_HEIGHT = 72;

export const AssetActivityList = memo(function AssetActivityList({
  transactions,
  isLoading,
  onTransactionPress,
  advancedMode = false
}: AssetActivityListProps) {
  const [visibleTransactions, setVisibleTransactions] = useState(20);

  // Memoize displayed transactions slice (must be before early returns)
  const displayedTransactions = useMemo(
    () => transactions.slice(0, visibleTransactions),
    [transactions, visibleTransactions]
  );

  // Memoize load more handler (must be before early returns)
  const handleLoadMore = useCallback(() => {
    setVisibleTransactions(prev => prev + 20);
  }, []);

  // Memoized renderItem for FlatList - avoids recreation on each render
  const renderItem = useCallback(
    ({ item }: { item: ActivityTransaction }) => (
      <TransactionItem
        tx={item as Transaction}
        styles={globalStyles}
        onPress={() => onTransactionPress(item)}
        advancedMode={advancedMode}
      />
    ),
    [onTransactionPress, advancedMode]
  );

  // Memoized keyExtractor for FlatList
  const keyExtractor = useCallback((item: ActivityTransaction) => item.txid, []);

  // getItemLayout for better scroll performance (avoids measuring each item)
  const getItemLayout = useCallback(
    (_data: ArrayLike<ActivityTransaction> | null | undefined, index: number) => ({
      length: TRANSACTION_ITEM_HEIGHT,
      offset: TRANSACTION_ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const hasMore = visibleTransactions < transactions.length;

  // Memoized footer component
  const ListFooterComponent = useMemo(() => {
    if (!hasMore) return null;
    return (
      <TouchableOpacity
        style={styles.loadMoreButton}
        onPress={handleLoadMore}
      >
        <Text style={styles.loadMoreText}>
          Load More ({transactions.length - visibleTransactions} remaining)
        </Text>
      </TouchableOpacity>
    );
  }, [hasMore, handleLoadMore, transactions.length, visibleTransactions]);

  // Early returns for loading/empty states (after all hooks)
  if (isLoading) {
    return <AssetActivityListSkeleton />;
  }

  if (transactions.length === 0) {
    return (
      <View style={styles.activityContainer}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No transaction history</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.activityContainer}>
      <FlatList
        data={displayedTransactions}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        scrollEnabled={false}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={10}
        removeClippedSubviews={true}
        ListFooterComponent={ListFooterComponent}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  activityContainer: {
    paddingHorizontal: 4,
    paddingBottom: 5,
    minHeight: 200, // Fixed height to prevent layout jumping
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptyText: {
    color: '#DDDDDD',
    fontSize: 16,
  },
  loadMoreButton: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  loadMoreText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
});
