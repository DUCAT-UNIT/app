/**
 * AssetActivityList Component
 * Displays transaction list with loading, empty states, and pagination
 * Uses responsive scaling with s() and sf() functions
 */

import React, { useState, useCallback, memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import TransactionItem, { Transaction } from '../transaction/TransactionItem';
import { COLORS } from '../../theme';
import globalStyles from '../../styles';
import { AssetActivityListSkeleton } from './AssetSkeleton';
import { useResponsive } from '../../hooks/useResponsive';
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
  const { s, sf } = useResponsive();
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
        style={{
          backgroundColor: COLORS.CARD_BG,
          borderRadius: s(10),
          paddingVertical: s(14),
          paddingHorizontal: s(20),
          marginTop: s(12),
          marginBottom: s(8),
          alignItems: 'center',
          borderWidth: 1,
          borderColor: COLORS.BORDER_COLOR,
        }}
        onPress={handleLoadMore}
      >
        <Text style={{
          color: COLORS.WHITE,
          fontSize: sf(14),
          fontWeight: '600',
        }}>
          Load More ({transactions.length - visibleTransactions} remaining)
        </Text>
      </TouchableOpacity>
    );
  }, [hasMore, handleLoadMore, transactions.length, visibleTransactions, s, sf]);

  // Early returns for loading/empty states (after all hooks)
  if (isLoading) {
    return <AssetActivityListSkeleton />;
  }

  if (transactions.length === 0) {
    return (
      <View style={{
        paddingHorizontal: s(24),
        paddingBottom: s(5),
        minHeight: s(200),
      }}>
        <View style={{
          alignItems: 'center',
          paddingVertical: s(12),
        }}>
          <Text style={{
            color: '#DDDDDD',
            fontSize: sf(16),
          }}>No transaction history</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{
      paddingHorizontal: s(24),
      paddingBottom: s(5),
      minHeight: s(200),
    }}>
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
