/**
 * FullscreenVaultChart Component
 * Fullscreen modal with chart on top 60% and activity list below
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions, Animated } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../theme';
import Icon from '../../icons';
import { VaultActivityList } from '../VaultActivityList';
import VaultTransactionDetailsSheet from '../VaultTransactionDetailsSheet';
import type { VaultHistoryTransaction } from '../../../services/vaultService';
import type { PriceTimeframe, ScrubData } from '../vaultChart/types';
import { TIMEFRAMES, INTERVAL_CONFIG } from '../vaultChart/types';
import { getHealthColor, getHealthChipBg } from '../vaultChart/utils';
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
  const [scrubData, setScrubData] = useState<ScrubData>({ health: null, x: null, timestamp: null });
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
    getTimestampAtX,
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
    padding: { left: 0, right: 0 },
    referenceLines,
    xScale,
    yScale,
    getHealthAtX,
    getTimestampAtX,
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

  // Filter transactions based on selected timeframe and locked event
  const filteredTransactions = useMemo(() => {
    const { unitLength, numberOfUnits } = INTERVAL_CONFIG[selectedTimeframe];
    const now = Date.now() / 1000;
    const timeframeStart = now - (unitLength * numberOfUnits);

    // First filter by overall timeframe
    let filtered = transactions.filter(tx => tx.timestamp >= timeframeStart);

    // If an event is locked, further filter to only show transactions in that time bucket
    if (lockedEventDate !== null) {
      // lockedEventDate is in milliseconds, convert to seconds for comparison
      const bucketEnd = lockedEventDate / 1000;
      const bucketStart = bucketEnd - unitLength;
      filtered = filtered.filter(tx => tx.timestamp > bucketStart && tx.timestamp <= bucketEnd);
    }

    return filtered;
  }, [transactions, selectedTimeframe, lockedEventDate]);

  // Display values
  const displayHealth = scrubData.health ?? (lineData.length > 0 ? lineData[lineData.length - 1].healthValue : null);
  const healthColor = getHealthColor(displayHealth);
  const healthChipBg = getHealthChipBg(displayHealth);

  // Format timestamp for display
  const formatScrubDate = (timestamp: number | null): string | null => {
    if (timestamp === null) return null;
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Today, ${timeStr}`;
    }
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr}, ${timeStr}`;
  };

  // Active timestamp for display
  const activeScrubTimestamp = scrubData.timestamp;

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setScrubData({ health: null, x: null, timestamp: null });
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

  // Transaction press handler
  const handleTransactionPress = useCallback((
    transaction: VaultHistoryTransaction,
    prevTransaction: VaultHistoryTransaction | null
  ) => {
    setSelectedTransaction(transaction);
    setPreviousTransaction(prevTransaction);
    setShowTransactionDetails(true);
  }, []);

  const handleCloseTransactionDetails = useCallback(() => {
    setShowTransactionDetails(false);
  }, []);

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

              {/* Percentage label following the scrubber (above) */}
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

              {/* Date/time label following the scrubber (at bottom of chart) */}
              <Animated.View
                style={[
                  styles.scrubberDateLabel,
                  {
                    opacity: scrubOpacity,
                    transform: [
                      { translateX: Animated.subtract(scrubXAnim, 45) },
                    ],
                  },
                ]}
              >
                <Text style={styles.scrubberDateText}>
                  {formatScrubDate(scrubData.timestamp) || ''}
                </Text>
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

        {/* Transaction Details Sheet */}
        <VaultTransactionDetailsSheet
          visible={showTransactionDetails}
          onClose={handleCloseTransactionDetails}
          transaction={selectedTransaction}
          previousTransaction={previousTransaction}
        />
      </View>
    </Modal>
  );
});

export default FullscreenVaultChart;
