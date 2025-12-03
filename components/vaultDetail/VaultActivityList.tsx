/**
 * VaultActivityList Component
 * Displays vault transaction history with FlatList and pagination
 */

import React, { memo, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { VaultActivityListSkeleton } from './VaultSkeleton';
import type { VaultHistoryTransaction } from '../../services/vaultService';
import { formatUnitAmount, formatBalance } from '../../utils/formatters';
import { useResponsive } from '../../hooks/useResponsive';

const INITIAL_LOAD_COUNT = 10;
const LOAD_MORE_COUNT = 10;

interface VaultActivityListProps {
  transactions: VaultHistoryTransaction[];
  isLoading: boolean;
  highlightedEventDate?: number | null;
  onTransactionPress?: (transaction: VaultHistoryTransaction, previousTransaction: VaultHistoryTransaction | null) => void;
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatAction = (action: string): string => {
  const actionMap: Record<string, string> = {
    'open': 'Open Vault',
    'borrow': 'Borrow',
    'repay': 'Repay',
    'deposit': 'Deposit',
    'withdraw': 'Withdraw',
    'liquidate': 'Liquidation',
  };
  return actionMap[action.toLowerCase()] || action;
};

const getActionColor = (action: string): string => {
  const colorMap: Record<string, string> = {
    'open': COLORS.SUCCESS_GREEN,
    'borrow': COLORS.SUCCESS_GREEN,
    'repay': COLORS.PRIMARY_BLUE,
    'deposit': COLORS.SUCCESS_GREEN,
    'withdraw': COLORS.RED,
    'liquidate': COLORS.RED,
  };
  return colorMap[action.toLowerCase()] || COLORS.WHITE;
};

const VaultTransactionItem = memo(function VaultTransactionItem({
  transaction,
  isHighlighted,
  onPress,
}: {
  transaction: VaultHistoryTransaction;
  isHighlighted?: boolean;
  onPress?: () => void;
}) {
  const { s, sf } = useResponsive();
  const actionLower = transaction.action.toLowerCase();

  // Determine UNIT color based on action
  const getUnitColor = () => {
    if (actionLower === 'borrow' || actionLower === 'open') return COLORS.GREEN;
    return COLORS.RED;
  };

  // Determine BTC color based on action
  const getBtcColor = () => {
    if (actionLower === 'deposit') return COLORS.GREEN;
    // For open, withdraw, liquidate - BTC is being used/locked
    return COLORS.RED;
  };

  const unitColor = getUnitColor();
  const btcColor = getBtcColor();

  return (
    <TouchableOpacity
      style={[
        styles.transactionItem,
        { paddingTop: s(8), paddingBottom: s(16), paddingLeft: s(12) },
        isHighlighted && styles.transactionItemHighlighted
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Vault Icon */}
      <View style={{ marginRight: s(14), alignSelf: 'center' }}>
        <Icon name="vault_logo" size={s(28)} color="#DDDDDD" />
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Top Row: Action | Confirmed | Amounts */}
        <View style={[styles.topRow, { marginBottom: s(4) }]}>
          {/* Column 1: Action label */}
          <View style={styles.column1}>
            <Text style={[styles.transactionAction, { fontSize: sf(14) }]}>
              {formatAction(transaction.action)}
            </Text>
          </View>
          {/* Right group: Confirmed chip + Amounts */}
          <View style={styles.rightGroup}>
            {/* Column 2: Confirmed chip */}
            <View style={styles.column2}>
              <View style={[styles.confirmedChip, { paddingHorizontal: s(6), paddingVertical: s(4), borderRadius: s(4), marginLeft: s(4) }]}>
                <Text style={[styles.confirmedChipText, { fontSize: sf(10) }]}>Confirmed</Text>
              </View>
            </View>
            {/* Column 3: Amounts */}
            <View style={[styles.column3, isHighlighted && { marginRight: 8 }]}>
              {transaction.unit_amt !== 0 && (
                <View style={styles.amountRow}>
                  <Icon name="unit_symbol" size={s(10)} color={unitColor} style={[styles.amountIcon, { marginRight: s(3) }]} />
                  <Text style={[styles.transactionAmount, { color: unitColor, fontSize: sf(12) }]}>
                    {formatUnitAmount(Math.abs(transaction.unit_amt))}
                  </Text>
                </View>
              )}
              {transaction.btc_amt !== 0 && (
                <View style={styles.amountRow}>
                  <Icon name="btc_symbol" size={s(10)} color={btcColor} style={[styles.amountIcon, { marginRight: s(3) }]} />
                  <Text style={[styles.transactionAmount, { color: btcColor, fontSize: sf(12) }]}>
                    {formatBalance(Math.abs(transaction.btc_amt) / 100_000_000)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bottom Row: Date */}
        <Text style={[styles.transactionDate, { fontSize: sf(11) }]}>
          {formatDate(transaction.timestamp)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// Check if a transaction matches the highlighted event date (same day in UTC)
const isTransactionHighlighted = (txTimestamp: number, highlightedDate: number | null | undefined): boolean => {
  if (!highlightedDate) return false;
  // Convert tx timestamp (seconds) to ms
  const txMs = txTimestamp * 1000;

  // Get start and end of the highlighted day in UTC
  const highlightedDay = new Date(highlightedDate);
  const startOfDayUTC = Date.UTC(
    highlightedDay.getUTCFullYear(),
    highlightedDay.getUTCMonth(),
    highlightedDay.getUTCDate(),
    0, 0, 0, 0
  );
  const endOfDayUTC = startOfDayUTC + 24 * 60 * 60 * 1000 - 1; // End of day (23:59:59.999)

  return txMs >= startOfDayUTC && txMs <= endOfDayUTC;
};

export const VaultActivityList = memo(function VaultActivityList({
  transactions,
  isLoading,
  highlightedEventDate,
  onTransactionPress,
}: VaultActivityListProps) {
  const { s, sf } = useResponsive();
  const [displayCount, setDisplayCount] = useState(INITIAL_LOAD_COUNT);

  // Pre-compute a map of transaction timestamps to indices for O(1) lookup
  // This fixes the O(n²) issue of calling findIndex inside renderItem
  const transactionIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    transactions.forEach((tx, idx) => {
      map.set(tx.timestamp, idx);
    });
    return map;
  }, [transactions]);

  // When filter is active, only show the matching transaction(s)
  const filteredTransactions = useMemo(() => {
    if (highlightedEventDate) {
      return transactions.filter(tx => isTransactionHighlighted(tx.timestamp, highlightedEventDate));
    }
    return transactions;
  }, [transactions, highlightedEventDate]);

  // Paginated data
  const displayTransactions = useMemo(() => {
    return filteredTransactions.slice(0, displayCount);
  }, [filteredTransactions, displayCount]);

  const hasMore = displayCount < filteredTransactions.length;

  const handleLoadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount(prev => prev + LOAD_MORE_COUNT);
    }
  }, [hasMore]);

  const renderItem = useCallback(({ item, index }: { item: VaultHistoryTransaction; index: number }) => {
    // Find previous transaction using pre-computed map (O(1) instead of O(n))
    const originalIndex = transactionIndexMap.get(item.timestamp) ?? index;
    const previousTransaction = originalIndex < transactions.length - 1 ? transactions[originalIndex + 1] : null;

    return (
      <VaultTransactionItem
        transaction={item}
        isHighlighted={isTransactionHighlighted(item.timestamp, highlightedEventDate)}
        onPress={onTransactionPress ? () => onTransactionPress(item, previousTransaction) : undefined}
      />
    );
  }, [highlightedEventDate, onTransactionPress, transactions, transactionIndexMap]);

  const keyExtractor = useCallback((item: VaultHistoryTransaction, index: number) =>
    `${item.timestamp}-${index}`, []);

  const renderFooter = useCallback(() => {
    if (!hasMore) return null;
    return (
      <TouchableOpacity
        style={[styles.loadMoreButton, {
          borderRadius: s(10),
          paddingVertical: s(14),
          paddingHorizontal: s(20),
          marginTop: s(12),
          marginBottom: s(8)
        }]}
        onPress={handleLoadMore}
      >
        <Text style={[styles.loadMoreText, { fontSize: sf(14) }]}>
          Load More ({filteredTransactions.length - displayCount} remaining)
        </Text>
      </TouchableOpacity>
    );
  }, [hasMore, handleLoadMore, filteredTransactions.length, displayCount, s, sf]);

  if (isLoading) {
    return <VaultActivityListSkeleton />;
  }

  if (transactions.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingVertical: s(40) }]}>
        <Text style={[styles.emptyText, { fontSize: sf(16), marginBottom: s(8) }]}>No vault activity yet</Text>
        <Text style={[styles.emptySubtext, { fontSize: sf(14) }]}>
          Your vault transactions will appear here
        </Text>
      </View>
    );
  }

  // If filter is active but no matches found, show empty state
  if (highlightedEventDate && filteredTransactions.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingVertical: s(40) }]}>
        <Text style={[styles.emptyText, { fontSize: sf(16), marginBottom: s(8) }]}>No matching activity</Text>
        <Text style={[styles.emptySubtext, { fontSize: sf(14) }]}>
          Clear the filter to see all transactions
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={displayTransactions}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={[styles.container, { paddingHorizontal: s(16) }]}
      scrollEnabled={false}
      ListFooterComponent={renderFooter}
    />
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    minHeight: 200, // Fixed height to prevent layout jumping
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
    borderRadius: 8,
  },
  transactionItemHighlighted: {
    borderWidth: 1.5,
    borderColor: '#1858E4',
    borderBottomColor: '#1858E4',
    marginVertical: 4,
  },
  iconContainer: {
    marginRight: 10,
  },
  contentContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  column1: {
    flex: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 3,
    justifyContent: 'space-between',
  },
  column2: {},
  column3: {
    alignItems: 'flex-end',
  },
  transactionAction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DDDDDD',
  },
  confirmedChip: {
    backgroundColor: 'rgba(89, 170, 138, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  confirmedChipText: {
    color: COLORS.GREEN,
    fontSize: 12,
    fontWeight: '600',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountIcon: {
    marginRight: 4,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
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
