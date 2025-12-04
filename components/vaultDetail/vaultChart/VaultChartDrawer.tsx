/**
 * VaultChartDrawer Component
 * Sliding drawer that shows transaction details for a selected chart event
 */

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../../../theme';
import Icon from '../../icons';
import type { VaultHistoryTransaction } from '../../../services/vaultService';
import type { ReferenceLine } from './types';
import { DRAWER_WIDTH } from './types';
import { formatAction, formatDate, formatBtc, formatUnit } from './utils';

interface VaultChartDrawerProps {
  drawerSide: 'left' | 'right' | null;
  drawerAnim: Animated.Value;
  activeRefLine: ReferenceLine | null;
  transactions: VaultHistoryTransaction[];
  allTransactions: VaultHistoryTransaction[];
  onClose: () => void;
  onTransactionPress?: (transaction: VaultHistoryTransaction, previousTransaction: VaultHistoryTransaction | null) => void;
}

export const VaultChartDrawer = memo(function VaultChartDrawer({
  drawerSide,
  drawerAnim,
  activeRefLine,
  transactions,
  allTransactions,
  onClose,
  onTransactionPress,
}: VaultChartDrawerProps) {
  // Find previous transaction for a given transaction
  const getPreviousTransaction = (tx: VaultHistoryTransaction): VaultHistoryTransaction | null => {
    const index = allTransactions.findIndex(t => t.timestamp === tx.timestamp);
    return index < allTransactions.length - 1 ? allTransactions[index + 1] : null;
  };
  if (drawerSide === null) return null;

  return (
    <Animated.View
      style={[
        styles.drawer,
        drawerSide === 'left' ? styles.drawerLeft : styles.drawerRight,
        { transform: [{ translateX: drawerAnim }] },
      ]}
    >
      {/* Drawer Header with Health Chip */}
      <View style={styles.drawerHeader}>
        <View style={styles.drawerHeaderLeft}>
          <Text style={styles.drawerTitle}>Event Details</Text>
          {activeRefLine && (() => {
            const newVal = activeRefLine.newValue;
            const chipColor = newVal <= 160 ? '#d04c68' : newVal <= 200 ? '#fde37b' : '#59aa8a';
            const chipBg = newVal <= 160 ? 'rgba(208, 76, 104, 0.15)' : newVal <= 200 ? 'rgba(253, 227, 123, 0.15)' : 'rgba(89, 170, 138, 0.15)';
            return (
              <View style={[styles.drawerHealthChip, { backgroundColor: chipBg, borderColor: chipColor }]}>
                <Text style={[styles.drawerHealthChipText, { color: chipColor }]}>
                  {activeRefLine.prevValue.toFixed(0)}% → {activeRefLine.newValue.toFixed(0)}%
                </Text>
              </View>
            );
          })()}
        </View>
        <TouchableOpacity onPress={onClose} style={styles.drawerCloseBtn}>
          <Icon name="close" size={20} color={COLORS.WHITE} />
        </TouchableOpacity>
      </View>

      {/* Transactions List */}
      <ScrollView style={styles.drawerTransactions} showsVerticalScrollIndicator={false}>
        {transactions.length === 0 ? (
          <Text style={styles.drawerEmptyText}>No transactions found</Text>
        ) : (
          transactions.map((tx, i) => {
            const isCollateralAction = tx.action === 'deposit' || tx.action === 'withdraw' || tx.action === 'open';
            const isPositive = tx.action === 'deposit' || tx.action === 'borrow' || tx.action === 'open';
            const amountColor = isPositive ? COLORS.SUCCESS_GREEN : COLORS.RED;
            const previousTx = getPreviousTransaction(tx);

            return (
              <TouchableOpacity
                key={i}
                style={styles.drawerTxItem}
                activeOpacity={0.7}
                onPress={() => onTransactionPress?.(tx, previousTx)}
              >
                <View style={styles.drawerTxIcon}>
                  <Icon name="vault_logo" size={28} color={COLORS.WHITE} />
                </View>
                <View style={styles.drawerTxContent}>
                  <View style={styles.drawerTxTopRow}>
                    <Text style={styles.drawerTxAction}>{formatAction(tx.action)}</Text>
                    <View style={styles.drawerTxAmountRow}>
                      <Icon
                        name={isCollateralAction ? 'btc_symbol' : 'unit_symbol'}
                        size={12}
                        color={amountColor}
                      />
                      <Text style={[styles.drawerTxAmount, { color: amountColor }]}>
                        {isCollateralAction
                          ? formatBtc(tx.vault_amount)
                          : formatUnit(tx.amount_borrowed)
                        }
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.drawerTxDate}>{formatDate(tx.timestamp)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: COLORS.VERY_DARK_GRAY,
    paddingTop: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  drawerRight: {
    right: 0,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.DARK_GRAY,
    shadowOffset: { width: -2, height: 0 },
  },
  drawerLeft: {
    left: 0,
    borderRightWidth: 1,
    borderRightColor: COLORS.DARK_GRAY,
    shadowOffset: { width: 2, height: 0 },
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.DARK_GRAY,
  },
  drawerHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  drawerHealthChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  drawerHealthChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.DARK_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerTransactions: {
    flex: 1,
  },
  drawerEmptyText: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    marginTop: 32,
  },
  drawerTxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY_BLUE,
  },
  drawerTxIcon: {
    marginRight: 8,
  },
  drawerTxContent: {
    flex: 1,
  },
  drawerTxTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  drawerTxAction: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  drawerTxAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  drawerTxAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  drawerTxDate: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
  },
});
