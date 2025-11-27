/**
 * AssetActivityList Component
 * Displays transaction list with loading, empty states, and pagination
 */

import React, { useState, useCallback, memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

export const AssetActivityList = memo(function AssetActivityList({
  transactions,
  isLoading,
  onTransactionPress,
  advancedMode = false
}: AssetActivityListProps) {
  const [visibleTransactions, setVisibleTransactions] = useState(20);

  // Memoize the transaction press handler factory
  const createPressHandler = useCallback(
    (tx: ActivityTransaction) => () => onTransactionPress(tx),
    [onTransactionPress]
  );

  // Memoize displayed transactions slice (must be before early returns)
  const displayedTransactions = useMemo(
    () => transactions.slice(0, visibleTransactions),
    [transactions, visibleTransactions]
  );

  // Memoize load more handler (must be before early returns)
  const handleLoadMore = useCallback(() => {
    setVisibleTransactions(prev => prev + 20);
  }, []);

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

  const hasMore = visibleTransactions < transactions.length;

  return (
    <View style={styles.activityContainer}>
      {displayedTransactions.map((transaction) => (
        <TransactionItem
          key={transaction.txid}
          tx={transaction as Transaction}
          styles={globalStyles}
          onPress={createPressHandler(transaction)}
          advancedMode={advancedMode}
        />
      ))}

      {hasMore && (
        <TouchableOpacity
          style={styles.loadMoreButton}
          onPress={handleLoadMore}
        >
          <Text style={styles.loadMoreText}>
            Load More ({transactions.length - visibleTransactions} remaining)
          </Text>
        </TouchableOpacity>
      )}
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
