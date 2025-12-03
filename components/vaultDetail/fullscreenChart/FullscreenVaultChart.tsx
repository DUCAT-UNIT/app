/**
 * FullscreenVaultChart Component
 * Fullscreen modal with chart on top half and activity list below
 */

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Dimensions } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../theme';
import Icon from '../../icons';
import type { VaultHistoryTransaction } from '../../../services/vaultService';
import type { PriceTimeframe, ScrubData } from '../vaultChart/types';
import { TIMEFRAMES, INTERVAL_CONFIG } from '../vaultChart/types';
import { getHealthColor, getHealthChipBg } from '../vaultChart/utils';
import { LEFT_MARGIN, RIGHT_MARGIN, PORTRAIT_WIDTH } from './constants';
import { fullscreenStyles as styles } from './styles';
import { useFullscreenChartData } from './useFullscreenChartData';
import { useScrubAnimation } from './useScrubAnimation';
import { formatUnitAmount, formatBalance } from '../../../utils/formatters';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHART_HEIGHT = SCREEN_HEIGHT * 0.4; // 40% for chart area

interface FullscreenVaultChartProps {
  visible: boolean;
  onClose: () => void;
  transactions: VaultHistoryTransaction[];
}

// Transaction item component
const TransactionItem = memo(function TransactionItem({
  transaction,
  onPress,
}: {
  transaction: VaultHistoryTransaction;
  onPress?: () => void;
}) {
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

  const actionColor = getActionColor(transaction.action);
  const hasBtcChange = transaction.btc_amt !== 0;
  const hasUnitChange = transaction.unit_amt !== 0;

  return (
    <TouchableOpacity
      style={styles.txItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.txIconContainer, { backgroundColor: `${actionColor}20` }]}>
        <Icon
          name={transaction.action === 'withdraw' || transaction.action === 'repay' ? 'arrow-up' : 'arrow-down'}
          size={16}
          color={actionColor}
        />
      </View>
      <View style={styles.txContent}>
        <View style={styles.txTopRow}>
          <Text style={[styles.txAction, { color: actionColor }]}>
            {formatAction(transaction.action)}
          </Text>
          <Text style={styles.txDate}>{formatDate(transaction.timestamp)}</Text>
        </View>
        <View style={styles.txAmounts}>
          {hasBtcChange && (
            <Text style={[styles.txAmount, { color: transaction.btc_amt > 0 ? COLORS.SUCCESS_GREEN : COLORS.RED }]}>
              {transaction.btc_amt > 0 ? '+' : ''}{formatBalance(transaction.btc_amt, 8)} BTC
            </Text>
          )}
          {hasUnitChange && (
            <Text style={[styles.txAmount, { color: transaction.unit_amt > 0 ? COLORS.SUCCESS_GREEN : COLORS.RED }]}>
              {transaction.unit_amt > 0 ? '+' : ''}{formatUnitAmount(transaction.unit_amt)} UNIT
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const FullscreenVaultChart = memo(function FullscreenVaultChart({
  visible,
  onClose,
  transactions,
}: FullscreenVaultChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<PriceTimeframe>('1W');
  const [scrubData, setScrubData] = useState<ScrubData>({ health: null, x: null });
  const [hoveredRefLineIndex, setHoveredRefLineIndex] = useState<number | null>(null);

  // Safe area insets (portrait mode)
  const insets = useSafeAreaInsets();
  const safeAreaTop = insets.top;
  const safeAreaBottom = insets.bottom;

  // Chart data - use smaller height for half-screen chart
  const {
    loading,
    referenceLines,
    lineData,
    lineSegments,
    areaPath,
    yDomain,
    chartWidth,
    xScale,
    yScale,
    getHealthAtX,
    findNearbyRefLine,
  } = useFullscreenChartData(visible, selectedTimeframe, transactions, CHART_HEIGHT);

  // Scrub animation (simplified - no locking)
  const {
    scrubXAnim,
    scrubYAnim,
    scrubOpacity,
    scrubColorAnim,
    panResponder,
  } = useScrubAnimation({
    chartWidth,
    referenceLines,
    xScale,
    yScale,
    getHealthAtX,
    findNearbyRefLine,
    onScrubDataChange: setScrubData,
    onHoveredRefLineChange: setHoveredRefLineIndex,
    onLockRefLine: () => {}, // No-op, no drawer
  });

  // Filter transactions based on selected timeframe
  const filteredTransactions = useMemo(() => {
    const { unitLength, numberOfUnits } = INTERVAL_CONFIG[selectedTimeframe];
    const now = Date.now() / 1000;
    const timeframeStart = now - (unitLength * numberOfUnits);

    return transactions.filter(tx => tx.timestamp >= timeframeStart);
  }, [transactions, selectedTimeframe]);

  // Display values
  const displayHealth = scrubData.health ?? (lineData.length > 0 ? lineData[lineData.length - 1].healthValue : null);
  const healthColor = getHealthColor(displayHealth);
  const healthChipBg = getHealthChipBg(displayHealth);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setScrubData({ health: null, x: null });
    }
  }, [visible]);

  const renderTransaction = useCallback(({ item }: { item: VaultHistoryTransaction }) => (
    <TransactionItem transaction={item} />
  ), []);

  const keyExtractor = useCallback((item: VaultHistoryTransaction) =>
    `${item.transaction_id ?? item.timestamp}-${item.timestamp}`, []);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: safeAreaTop, paddingBottom: safeAreaBottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.healthChip, { backgroundColor: healthChipBg, borderColor: healthColor }]}>
            <Text style={[styles.healthChipText, { color: healthColor }]}>
              {displayHealth ? `${displayHealth.toFixed(0)}%` : 'N/A'}
            </Text>
          </View>
          <Text style={styles.headerTitle}>Vault Health</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <Icon name="close" size={24} color={COLORS.WHITE} />
          </TouchableOpacity>
        </View>

        {/* Chart area - top half */}
        <View style={[styles.chartSection, { paddingLeft: LEFT_MARGIN, paddingRight: RIGHT_MARGIN }]}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading chart...</Text>
            </View>
          ) : lineData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No health history available</Text>
            </View>
          ) : (
            <View style={styles.chartWrapper} {...panResponder.panHandlers}>
              <Svg width={chartWidth} height={CHART_HEIGHT - 60}>
                <Defs>
                  <LinearGradient
                    id="fsAreaGradient"
                    x1="0"
                    y1={yScale(yDomain[1])}
                    x2="0"
                    y2={CHART_HEIGHT - 60}
                    gradientUnits="userSpaceOnUse"
                  >
                    <Stop offset="0" stopColor="#59AA8A" stopOpacity="0.15" />
                    <Stop offset={Math.max(0, (yScale(200) - yScale(yDomain[1])) / (CHART_HEIGHT - 60 - yScale(yDomain[1])))} stopColor="#59AA8A" stopOpacity="0.15" />
                    <Stop offset={Math.max(0, (yScale(160) - yScale(yDomain[1])) / (CHART_HEIGHT - 60 - yScale(yDomain[1])))} stopColor="#FDE37B" stopOpacity="0.1" />
                    <Stop offset="1" stopColor="#D04C68" stopOpacity="0.05" />
                  </LinearGradient>
                  <LinearGradient
                    id="fsLineGradient"
                    x1="0"
                    y1={yScale(yDomain[1])}
                    x2="0"
                    y2={yScale(yDomain[0])}
                    gradientUnits="userSpaceOnUse"
                  >
                    <Stop offset={Math.max(0, (yDomain[1] - 200) / (yDomain[1] - yDomain[0]))} stopColor="#59AA8A" stopOpacity="1" />
                    <Stop offset={Math.max(0, (yDomain[1] - 160) / (yDomain[1] - yDomain[0]))} stopColor="#FDE37B" stopOpacity="1" />
                    <Stop offset="1" stopColor="#D04C68" stopOpacity="1" />
                  </LinearGradient>
                </Defs>

                {/* Area fill */}
                <Path d={areaPath} fill="url(#fsAreaGradient)" />

                {/* Line segments */}
                {lineSegments.map((segment, i) => (
                  <Path key={i} d={segment} stroke="url(#fsLineGradient)" strokeWidth={2} fill="none" />
                ))}

                {/* Reference lines */}
                {referenceLines.map((line, i) => {
                  const isActive = hoveredRefLineIndex === i;
                  const dataIndex = lineData.findIndex(d => d.date === line.date);
                  if (dataIndex < 1) return null;

                  const prevHealth = lineData[dataIndex - 1].healthValue;
                  const newHealth = lineData[dataIndex].healthValue;

                  return (
                    <Line
                      key={i}
                      x1={xScale(line.date)}
                      x2={xScale(line.date)}
                      y1={yScale(prevHealth)}
                      y2={yScale(newHealth)}
                      stroke="url(#fsLineGradient)"
                      strokeWidth={isActive ? 3 : 2}
                      strokeLinecap="round"
                    />
                  );
                })}
              </Svg>
            </View>
          )}

          {/* Timeframe buttons */}
          <View style={styles.timeframeButtons}>
            {TIMEFRAMES.map((tf) => (
              <TouchableOpacity
                key={tf}
                style={[styles.timeframeButton, selectedTimeframe === tf && styles.timeframeButtonActive]}
                onPress={() => setSelectedTimeframe(tf)}
              >
                <Text style={[styles.timeframeText, selectedTimeframe === tf && styles.timeframeTextActive]}>
                  {tf}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Activity section - bottom half */}
        <View style={styles.activitySection}>
          <Text style={styles.activityTitle}>Activity</Text>
          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyActivityText}>No activity in this timeframe</Text>
            </View>
          ) : (
            <FlatList
              data={filteredTransactions}
              renderItem={renderTransaction}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.activityList}
            />
          )}
        </View>
      </View>
    </Modal>
  );
});

export default FullscreenVaultChart;
