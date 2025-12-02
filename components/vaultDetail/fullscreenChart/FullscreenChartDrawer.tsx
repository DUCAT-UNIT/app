/**
 * FullscreenChartDrawer Component
 * Transaction drawer for fullscreen chart view
 */

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { COLORS } from '../../../theme';
import Icon from '../../icons';
import type { VaultHistoryTransaction } from '../../../services/vaultService';
import type { ReferenceLine } from '../vaultChart/types';
import { formatAction, formatDate } from '../vaultChart/utils';
import { fullscreenStyles as styles } from './styles';

interface FullscreenChartDrawerProps {
  drawerSide: 'left' | 'right' | null;
  drawerAnim: Animated.Value;
  activeRefLine: ReferenceLine | null;
  transactions: VaultHistoryTransaction[];
  onClose: () => void;
}

// Format BTC - trim trailing zeros
const formatBtc = (sats: number): string => {
  const btc = sats / 100_000_000;
  const formatted = btc.toFixed(8).replace(/\.?0+$/, '');
  return formatted.includes('.') ? formatted : `${formatted}.0`;
};

// Format USD
const formatUnit = (cents: number): string => {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const FullscreenChartDrawer = memo(function FullscreenChartDrawer({
  drawerSide,
  drawerAnim,
  activeRefLine,
  transactions,
  onClose,
}: FullscreenChartDrawerProps) {
  if (drawerSide === null) return null;

  return (
    <Animated.View
      style={[
        styles.drawer,
        drawerSide === 'left' ? styles.drawerLeft : styles.drawerRight,
        { transform: [{ translateX: drawerAnim }] },
      ]}
    >
      {/* Drawer Header */}
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

            return (
              <View key={i} style={styles.drawerTxItem}>
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
                        {isCollateralAction ? formatBtc(tx.vault_amount) : formatUnit(tx.amount_borrowed)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.drawerTxDate}>{formatDate(tx.timestamp)}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Animated.View>
  );
});
