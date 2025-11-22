/**
 * AssetActivityList Component
 * Displays transaction list with loading, empty states, and pagination
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import TransactionItem from '../transaction/TransactionItem';
import { COLORS } from '../../theme';
import globalStyles from '../../styles';

export function AssetActivityList({ transactions, isLoading, onTransactionPress, advancedMode = false }) {
  const [visibleTransactions, setVisibleTransactions] = useState(20);

  const renderTransaction = useCallback(
    ({ item: tx }) => (
      <TransactionItem
        tx={tx}
        styles={globalStyles}
        onPress={() => onTransactionPress(tx)}
        advancedMode={advancedMode}
      />
    ),
    [onTransactionPress, advancedMode]
  );

  if (isLoading) {
    return (
      <View style={styles.activityContainer}>
        <ActivityIndicator color={COLORS.PRIMARY_BLUE} style={styles.loader} />
      </View>
    );
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

  const displayedTransactions = transactions.slice(0, visibleTransactions);
  const hasMore = visibleTransactions < transactions.length;

  return (
    <View style={styles.activityContainer}>
      {displayedTransactions.map((transaction) => (
        <View key={transaction.txid}>
          {renderTransaction({ item: transaction })}
        </View>
      ))}

      {hasMore && (
        <TouchableOpacity
          style={styles.loadMoreButton}
          onPress={() => setVisibleTransactions(prev => prev + 20)}
        >
          <Text style={styles.loadMoreText}>
            Load More ({transactions.length - visibleTransactions} remaining)
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  activityContainer: {
    paddingHorizontal: 4,
    paddingBottom: 5,
  },
  loader: {
    marginTop: 8,
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
