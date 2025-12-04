/**
 * FullscreenVaultChart Component
 * Fullscreen modal with chart on top 60% and activity list below
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions, Animated, TouchableWithoutFeedback, PanResponder as RNPanResponder, StyleSheet } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../theme';
import Icon from '../../icons';
import { VaultActivityList } from '../VaultActivityList';
import type { VaultHistoryTransaction } from '../../../services/vaultService';
import { formatBalance, formatUnitAmount, formatFiat } from '../../../utils/formatters';
import type { PriceTimeframe, ScrubData } from '../vaultChart/types';
import { TIMEFRAMES, INTERVAL_CONFIG } from '../vaultChart/types';
import { getHealthColor, getHealthChipBg } from '../vaultChart/utils';
import { LEFT_MARGIN, RIGHT_MARGIN } from './constants';
import { fullscreenStyles as styles } from './styles';
import { useFullscreenChartData } from './useFullscreenChartData';
import { useScrubAnimation } from './useScrubAnimation';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHART_HEIGHT = SCREEN_HEIGHT * 0.6; // 60% for chart area

interface FullscreenVaultChartProps {
  visible: boolean;
  onClose: () => void;
  transactions: VaultHistoryTransaction[];
}

export const FullscreenVaultChart = memo(function FullscreenVaultChart({
  visible,
  onClose,
  transactions,
}: FullscreenVaultChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<PriceTimeframe>('1Y');
  const [scrubData, setScrubData] = useState<ScrubData>({ health: null, x: null });
  const [hoveredRefLineIndex, setHoveredRefLineIndex] = useState<number | null>(null);
  const [lockedEventDate, setLockedEventDate] = useState<number | null>(null);
  const [lockedRefLineIndex, setLockedRefLineIndex] = useState<number | null>(null);
  // Transaction details sheet state
  const [selectedTransaction, setSelectedTransaction] = useState<VaultHistoryTransaction | null>(null);
  const [previousTransaction, setPreviousTransaction] = useState<VaultHistoryTransaction | null>(null);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);

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

  // Scrub animation with locking to filter activity
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
    onLockRefLine: (index, data) => {
      if (index !== null && referenceLines[index]) {
        // Lock to this event
        setLockedEventDate(referenceLines[index].date);
        setLockedRefLineIndex(index);
        // Keep scrubber visible
        scrubOpacity.setValue(1);
      } else {
        setLockedEventDate(null);
        setLockedRefLineIndex(null);
      }
    },
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
      setLockedEventDate(null);
      setLockedRefLineIndex(null);
      scrubOpacity.setValue(0);
    }
  }, [visible, scrubOpacity]);

  // Reset locked event when timeframe changes
  useEffect(() => {
    setLockedEventDate(null);
    setLockedRefLineIndex(null);
    scrubOpacity.setValue(0);
  }, [selectedTimeframe, scrubOpacity]);

  // Bottom sheet animation
  const sheetTranslateY = useRef(new Animated.Value(500)).current;

  // Transaction press handler
  const handleTransactionPress = useCallback((
    transaction: VaultHistoryTransaction,
    prevTransaction: VaultHistoryTransaction | null
  ) => {
    setSelectedTransaction(transaction);
    setPreviousTransaction(prevTransaction);
    setShowTransactionDetails(true);
    // Animate sheet in
    sheetTranslateY.setValue(500);
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [sheetTranslateY]);

  const handleCloseTransactionDetails = useCallback(() => {
    Animated.timing(sheetTranslateY, {
      toValue: 500,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowTransactionDetails(false);
    });
  }, [sheetTranslateY]);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: safeAreaTop, paddingBottom: safeAreaBottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 44 }} />
          <Text style={styles.headerTitle}>Vault Health</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <Icon name="close" size={24} color={COLORS.WHITE} />
          </TouchableOpacity>
        </View>

        {/* Chart area - top 60% */}
        <View style={styles.chartSection}>
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
              <Svg width={chartWidth} height={CHART_HEIGHT - 100}>
                <Defs>
                  <LinearGradient
                    id="fsAreaGradient"
                    x1="0"
                    y1={yScale(yDomain[1])}
                    x2="0"
                    y2={CHART_HEIGHT - 100}
                    gradientUnits="userSpaceOnUse"
                  >
                    <Stop offset="0" stopColor="#59AA8A" stopOpacity="0.15" />
                    <Stop offset={Math.max(0, (yScale(200) - yScale(yDomain[1])) / (CHART_HEIGHT - 100 - yScale(yDomain[1])))} stopColor="#59AA8A" stopOpacity="0.15" />
                    <Stop offset={Math.max(0, (yScale(160) - yScale(yDomain[1])) / (CHART_HEIGHT - 100 - yScale(yDomain[1])))} stopColor="#FDE37B" stopOpacity="0.1" />
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

              {/* Animated Scrubber Line - from Y position to bottom */}
              <Animated.View
                style={[
                  styles.scrubberLine,
                  {
                    opacity: scrubOpacity,
                    transform: [
                      { translateX: scrubXAnim },
                      { translateY: scrubYAnim },
                    ],
                    height: Animated.subtract(CHART_HEIGHT - 100, scrubYAnim),
                    backgroundColor: scrubColorAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: ['#D04C68', '#FDE37B', '#59AA8A'],
                    }),
                  },
                ]}
              />

              {/* Animated Scrubber Dot */}
              <Animated.View
                style={[
                  styles.scrubberDot,
                  {
                    opacity: scrubOpacity,
                    transform: [
                      { translateX: Animated.subtract(scrubXAnim, 6) },
                      { translateY: Animated.subtract(scrubYAnim, 6) },
                    ],
                    backgroundColor: scrubColorAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: ['#D04C68', '#FDE37B', '#59AA8A'],
                    }),
                  },
                ]}
              >
                <View style={styles.scrubberDotInner} />
              </Animated.View>

              {/* Percentage label following the scrubber */}
              <Animated.View
                style={[
                  styles.scrubberLabel,
                  {
                    opacity: scrubOpacity,
                    transform: [
                      { translateX: Animated.subtract(scrubXAnim, 20) },
                      { translateY: Animated.subtract(scrubYAnim, 28) },
                    ],
                  },
                ]}
              >
                <Animated.Text
                  style={[
                    styles.scrubberLabelText,
                    {
                      color: scrubColorAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: ['#D04C68', '#FDE37B', '#59AA8A'],
                      }),
                    },
                  ]}
                >
                  {hoveredRefLineIndex !== null && referenceLines[hoveredRefLineIndex]
                    ? (() => {
                        const refLine = referenceLines[hoveredRefLineIndex];
                        return `${refLine.prevValue.toFixed(0)}% → ${refLine.newValue.toFixed(0)}%`;
                      })()
                    : lockedRefLineIndex !== null && referenceLines[lockedRefLineIndex]
                      ? (() => {
                          const refLine = referenceLines[lockedRefLineIndex];
                          return `${refLine.prevValue.toFixed(0)}% → ${refLine.newValue.toFixed(0)}%`;
                        })()
                      : scrubData.health
                        ? `${scrubData.health.toFixed(0)}%`
                        : ''
                  }
                </Animated.Text>
              </Animated.View>
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

        {/* Activity section - bottom 40% */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle}>Activity</Text>
            {lockedEventDate && (
              <TouchableOpacity
                style={styles.clearFilterButton}
                onPress={() => {
                  setLockedEventDate(null);
                  setLockedRefLineIndex(null);
                  scrubOpacity.setValue(0);
                }}
              >
                <Icon name="close" size={12} color={COLORS.PRIMARY_BLUE} />
                <Text style={styles.clearFilterText}>
                  {new Date(lockedEventDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <VaultActivityList
              transactions={filteredTransactions}
              isLoading={loading}
              highlightedEventDate={lockedEventDate}
              onTransactionPress={handleTransactionPress}
            />
          </ScrollView>
        </View>

        {/* Inline Bottom Sheet for Transaction Details */}
        {showTransactionDetails && selectedTransaction && (
          <>
            {/* Backdrop */}
            <TouchableWithoutFeedback onPress={handleCloseTransactionDetails}>
              <View style={inlineSheetStyles.backdrop} />
            </TouchableWithoutFeedback>

            {/* Sheet */}
            <Animated.View
              style={[
                inlineSheetStyles.sheet,
                { transform: [{ translateY: sheetTranslateY }] },
              ]}
            >
              {/* Handle */}
              <View style={inlineSheetStyles.handleContainer}>
                <View style={inlineSheetStyles.handle} />
              </View>

              {/* Header */}
              <View style={inlineSheetStyles.header}>
                <View style={inlineSheetStyles.headerContent}>
                  <Icon name="vault_logo" size={24} color="#DDDDDD" />
                  <View style={inlineSheetStyles.headerText}>
                    <Text style={inlineSheetStyles.title}>
                      {selectedTransaction.action === 'open' ? 'Open Vault' :
                       selectedTransaction.action === 'borrow' ? 'Borrow UNIT' :
                       selectedTransaction.action === 'repay' ? 'Repay UNIT' :
                       selectedTransaction.action === 'deposit' ? 'Deposit BTC' :
                       selectedTransaction.action === 'withdraw' ? 'Withdraw BTC' :
                       selectedTransaction.action}
                    </Text>
                    <Text style={inlineSheetStyles.subtitle}>
                      {new Date(selectedTransaction.timestamp * 1000).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleCloseTransactionDetails} style={inlineSheetStyles.closeButton}>
                  <Icon name="close" size={24} color={COLORS.WHITE} />
                </TouchableOpacity>
              </View>

              {/* Summary */}
              <View style={inlineSheetStyles.summarySection}>
                <View style={[inlineSheetStyles.summaryCard, {
                  borderColor: selectedTransaction.action === 'deposit' || selectedTransaction.action === 'repay'
                    ? COLORS.GREEN : COLORS.RED
                }]}>
                  <Text style={inlineSheetStyles.summaryText}>
                    {selectedTransaction.action === 'open' ? `Opened vault with ${formatBalance(selectedTransaction.btc_amt / 100_000_000)} BTC` :
                     selectedTransaction.action === 'borrow' ? `Borrowed ${formatUnitAmount(Math.abs(previousTransaction ? selectedTransaction.amount_borrowed - previousTransaction.amount_borrowed : selectedTransaction.amount_borrowed))} UNIT` :
                     selectedTransaction.action === 'repay' ? `Repaid ${formatUnitAmount(Math.abs(previousTransaction ? previousTransaction.amount_borrowed - selectedTransaction.amount_borrowed : selectedTransaction.unit_amt))} UNIT` :
                     selectedTransaction.action === 'deposit' ? `Deposited ${formatBalance(selectedTransaction.btc_amt / 100_000_000)} BTC` :
                     selectedTransaction.action === 'withdraw' ? `Withdrew ${formatBalance(Math.abs(selectedTransaction.btc_amt) / 100_000_000)} BTC` :
                     selectedTransaction.action}
                  </Text>
                  <Text style={inlineSheetStyles.oraclePriceText}>
                    Oracle Price: ${formatFiat(selectedTransaction.oracle_price, 2)}
                  </Text>
                </View>
              </View>

              {/* Changes */}
              <View style={inlineSheetStyles.changesSection}>
                <Text style={inlineSheetStyles.sectionTitle}>Vault Changes</Text>

                {/* Collateral */}
                <View style={inlineSheetStyles.changeRow}>
                  <Text style={inlineSheetStyles.changeLabel}>Collateral</Text>
                  <View style={inlineSheetStyles.changeValues}>
                    <View style={inlineSheetStyles.valueContainer}>
                      <Icon name="btc_symbol" size={12} color={COLORS.SECONDARY_TEXT} />
                      <Text style={inlineSheetStyles.beforeValue}>
                        {formatBalance(previousTransaction ? previousTransaction.vault_amount / 100_000_000 : 0)}
                      </Text>
                    </View>
                    <Text style={inlineSheetStyles.arrow}>→</Text>
                    <View style={inlineSheetStyles.valueContainer}>
                      <Icon name="btc_symbol" size={12} color={COLORS.WHITE} />
                      <Text style={inlineSheetStyles.afterValue}>
                        {formatBalance(selectedTransaction.vault_amount / 100_000_000)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Debt */}
                <View style={inlineSheetStyles.changeRow}>
                  <Text style={inlineSheetStyles.changeLabel}>Total Debt</Text>
                  <View style={inlineSheetStyles.changeValues}>
                    <View style={inlineSheetStyles.valueContainer}>
                      <Icon name="unit_symbol" size={12} color={COLORS.SECONDARY_TEXT} />
                      <Text style={inlineSheetStyles.beforeValue}>
                        {formatUnitAmount(previousTransaction ? previousTransaction.amount_borrowed : 0)}
                      </Text>
                    </View>
                    <Text style={inlineSheetStyles.arrow}>→</Text>
                    <View style={inlineSheetStyles.valueContainer}>
                      <Icon name="unit_symbol" size={12} color={COLORS.WHITE} />
                      <Text style={inlineSheetStyles.afterValue}>
                        {formatUnitAmount(selectedTransaction.amount_borrowed)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>
          </>
        )}
      </View>
    </Modal>
  );
});

// Inline sheet styles (to avoid nested Modal issues)
const inlineSheetStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.DARK_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: COLORS.MEDIUM_GRAY,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_COLOR,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  summarySection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  summaryCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  oraclePriceText: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  changesSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    color: COLORS.SECONDARY_TEXT,
    marginBottom: 16,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.VERY_DARK_GRAY,
  },
  changeLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    flex: 1,
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  beforeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.SECONDARY_TEXT,
  },
  arrow: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    marginHorizontal: 8,
  },
  afterValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});

export default FullscreenVaultChart;
