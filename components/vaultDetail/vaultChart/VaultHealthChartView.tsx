/**
 * VaultHealthChartView Component
 * Displays vault health ratio over time with event markers
 * Refactored version using extracted hooks and components
 */

import React, { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, PanResponder, GestureResponderEvent, Animated } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { COLORS } from '../../../theme';
import { VaultChartSkeleton } from '../VaultSkeleton';
import type { VaultHistoryTransaction } from '../../../services/vaultService';
import type { PriceTimeframe, ScrubData } from './types';
import { TIMEFRAMES, INTERVAL_CONFIG, DRAWER_WIDTH } from './types';
import { getHealthColor, getHealthChipBg } from './utils';
import { useBtcPriceHistory } from './useBtcPriceHistory';
import { useChartData } from './useChartData';
import { VaultChartDrawer } from './VaultChartDrawer';
import { chartStyles as styles } from './styles';

interface VaultHealthChartViewProps {
  transactions: VaultHistoryTransaction[];
  onHighlightEvent?: (eventDate: number | null) => void;
  onLockFilter?: (eventDate: number | null) => void;
  onScrollEnable?: (enabled: boolean) => void;
  highlightedEventDate?: number | null;
  totalDebt?: number;
  totalCollateral?: number;
  currentPrice?: number;
  onTransactionPress?: (transaction: VaultHistoryTransaction, previousTransaction: VaultHistoryTransaction | null) => void;
}

export const VaultHealthChartView = memo(function VaultHealthChartView({
  transactions,
  onHighlightEvent,
  onLockFilter,
  onScrollEnable,
  highlightedEventDate,
  onTransactionPress,
}: VaultHealthChartViewProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<PriceTimeframe>('1D');
  const [scrubData, setScrubData] = useState<ScrubData>({ health: null, x: null, timestamp: null });
  const [hoveredRefLineIndex, setHoveredRefLineIndex] = useState<number | null>(null);
  const [lockedRefLineIndex, setLockedRefLineIndex] = useState<number | null>(null);
  const [lockedScrubData, setLockedScrubData] = useState<ScrubData>({ health: null, x: null, timestamp: null });

  // Drawer animation
  const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const [drawerSide, setDrawerSide] = useState<'left' | 'right' | null>(null);

  // Fetch BTC price data
  const { btcPrices, loading } = useBtcPriceHistory(selectedTimeframe, transactions.length > 0);

  // Compute chart data
  const {
    series,
    referenceLines,
    lineData,
    lineSegments,
    areaPath,
    yDomain,
    dimensions,
    xScale,
    yScale,
  } = useChartData(transactions, btcPrices, selectedTimeframe);

  const { chartWidth, chartHeight, padding } = dimensions;

  // Clear locked state when parent clears highlight
  useEffect(() => {
    if (highlightedEventDate === null && lockedRefLineIndex !== null) {
      setLockedRefLineIndex(null);
      setLockedScrubData({ health: null, x: null, timestamp: null });
    }
  }, [highlightedEventDate, lockedRefLineIndex]);

  // Get timestamp at X position
  const getTimestampAtX = useCallback((x: number): number | null => {
    if (!series.length) return null;

    const clampedX = Math.max(padding.left, Math.min(x, padding.left + dimensions.drawWidth));
    const ratio = (clampedX - padding.left) / dimensions.drawWidth;

    const minTime = series[0].date;
    const maxTime = series[series.length - 1].date;
    return minTime + ratio * (maxTime - minTime);
  }, [series, padding.left, dimensions.drawWidth]);

  // Get health at X position - interpolate based on line path
  const getHealthAtX = useCallback((x: number): number | null => {
    if (!lineData.length || !series.length) return null;

    const clampedX = Math.max(padding.left, Math.min(x, padding.left + dimensions.drawWidth));
    const ratio = (clampedX - padding.left) / dimensions.drawWidth;

    const minTime = series[0].date;
    const maxTime = series[series.length - 1].date;
    const targetTime = minTime + ratio * (maxTime - minTime);

    // Find series point at this time
    let seriesIdx = 0;
    for (let i = 0; i < series.length - 1; i++) {
      if (series[i].date <= targetTime && series[i + 1].date >= targetTime) {
        seriesIdx = i;
        break;
      }
    }

    if (series[seriesIdx].healthValue === null) return null;

    // Interpolate using lineData
    if (lineData.length === 1) return lineData[0].healthValue;

    let beforeIdx = 0;
    let afterIdx = lineData.length - 1;

    for (let i = 0; i < lineData.length - 1; i++) {
      if (lineData[i].date <= targetTime && lineData[i + 1].date >= targetTime) {
        beforeIdx = i;
        afterIdx = i + 1;
        break;
      }
    }

    if (targetTime <= lineData[0].date) return lineData[0].healthValue;
    if (targetTime >= lineData[lineData.length - 1].date) return lineData[lineData.length - 1].healthValue;

    const beforePoint = lineData[beforeIdx];
    const afterPoint = lineData[afterIdx];
    const timeFraction = (targetTime - beforePoint.date) / (afterPoint.date - beforePoint.date || 1);
    return beforePoint.healthValue + timeFraction * (afterPoint.healthValue - beforePoint.healthValue);
  }, [lineData, series, padding.left, dimensions.drawWidth]);

  // Find reference line at X position
  const findNearbyRefLine = useCallback((x: number): number | null => {
    if (!referenceLines.length) return null;
    const tolerance = 5;
    for (let i = 0; i < referenceLines.length; i++) {
      if (Math.abs(x - xScale(referenceLines[i].date)) <= tolerance) return i;
    }
    return null;
  }, [referenceLines, xScale]);

  // Pan responder for scrubbing
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false, // Prevent parent ScrollView from stealing gesture
    onShouldBlockNativeResponder: () => true, // Block native scroll while scrubbing
    onPanResponderGrant: (evt: GestureResponderEvent) => {
      onScrollEnable?.(false);
      setLockedRefLineIndex(null);
      setLockedScrubData({ health: null, x: null, timestamp: null });

      const x = evt.nativeEvent.locationX;
      setScrubData({ health: getHealthAtX(x), x, timestamp: getTimestampAtX(x) });
      const refLineIdx = findNearbyRefLine(x);
      setHoveredRefLineIndex(refLineIdx);
      onHighlightEvent?.(refLineIdx !== null && referenceLines[refLineIdx] ? referenceLines[refLineIdx].date : null);
    },
    onPanResponderMove: (evt: GestureResponderEvent) => {
      const x = evt.nativeEvent.locationX;
      setScrubData({ health: getHealthAtX(x), x, timestamp: getTimestampAtX(x) });
      const refLineIdx = findNearbyRefLine(x);
      setHoveredRefLineIndex(refLineIdx);
      onHighlightEvent?.(refLineIdx !== null && referenceLines[refLineIdx] ? referenceLines[refLineIdx].date : null);
    },
    onPanResponderRelease: () => {
      onScrollEnable?.(true);
      if (hoveredRefLineIndex !== null && referenceLines[hoveredRefLineIndex]) {
        const refLine = referenceLines[hoveredRefLineIndex];
        const exactX = xScale(refLine.date);
        setLockedRefLineIndex(hoveredRefLineIndex);
        setLockedScrubData({ health: refLine.newValue, x: exactX, timestamp: refLine.date });
        onHighlightEvent?.(refLine.date);
        onLockFilter?.(refLine.txTimestamp);
      }
      setScrubData({ health: null, x: null, timestamp: null });
      setHoveredRefLineIndex(null);
    },
    onPanResponderTerminate: () => {
      onScrollEnable?.(true);
      if (hoveredRefLineIndex !== null && referenceLines[hoveredRefLineIndex]) {
        const refLine = referenceLines[hoveredRefLineIndex];
        setLockedRefLineIndex(hoveredRefLineIndex);
        setLockedScrubData({ health: refLine.newValue, x: xScale(refLine.date), timestamp: refLine.date });
        onHighlightEvent?.(refLine.date);
        onLockFilter?.(refLine.txTimestamp);
      }
      setScrubData({ health: null, x: null, timestamp: null });
      setHoveredRefLineIndex(null);
    },
  }), [getHealthAtX, getTimestampAtX, findNearbyRefLine, referenceLines, onHighlightEvent, onLockFilter, onScrollEnable, hoveredRefLineIndex, xScale]);

  // Active reference line
  const activeRefLineIndex = hoveredRefLineIndex ?? lockedRefLineIndex;
  const activeRefLine = activeRefLineIndex !== null ? referenceLines[activeRefLineIndex] : null;

  // Display health
  const displayHealth = scrubData.health ?? lockedScrubData.health ?? (lineData.length > 0 ? lineData[lineData.length - 1].healthValue : null);
  const healthColor = getHealthColor(displayHealth);
  const healthChipBg = getHealthChipBg(displayHealth);

  // Active scrub position
  const activeScrubX = scrubData.x ?? lockedScrubData.x;
  const activeScrubHealth = scrubData.health ?? lockedScrubData.health;
  const activeScrubTimestamp = scrubData.timestamp ?? lockedScrubData.timestamp;

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

  // Drawer animation
  useEffect(() => {
    if (lockedRefLineIndex !== null && referenceLines[lockedRefLineIndex]) {
      const evtX = xScale(referenceLines[lockedRefLineIndex].date);
      const isLeft = evtX > chartWidth / 2;
      const hiddenValue = isLeft ? -DRAWER_WIDTH : DRAWER_WIDTH;

      drawerAnim.setValue(hiddenValue);
      setDrawerSide(isLeft ? 'left' : 'right');

      Animated.spring(drawerAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else if (drawerSide !== null) {
      const hiddenValue = drawerSide === 'left' ? -DRAWER_WIDTH : DRAWER_WIDTH;
      Animated.spring(drawerAnim, {
        toValue: hiddenValue,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(() => setDrawerSide(null));
    }
  }, [lockedRefLineIndex, referenceLines, xScale, chartWidth, drawerAnim, drawerSide]);

  // Locked event transactions
  const lockedEventTransactions = useMemo(() => {
    if (lockedRefLineIndex === null || !referenceLines[lockedRefLineIndex]) return [];
    const refLine = referenceLines[lockedRefLineIndex];
    const { unitLength } = INTERVAL_CONFIG[selectedTimeframe];
    const bucketEnd = refLine.date / 1000;
    const bucketStart = bucketEnd - unitLength + 1;
    return transactions.filter(tx => tx.timestamp >= bucketStart && tx.timestamp <= bucketEnd);
  }, [lockedRefLineIndex, referenceLines, transactions, selectedTimeframe]);

  // Close drawer
  const closeDrawer = useCallback(() => {
    setLockedRefLineIndex(null);
    setLockedScrubData({ health: null, x: null, timestamp: null });
    onHighlightEvent?.(null);
    onLockFilter?.(null);
  }, [onHighlightEvent, onLockFilter]);

  // Loading state
  if (loading) return <VaultChartSkeleton />;

  // Empty state
  if (!lineData.length) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No health history available</Text>
        </View>
        <View style={styles.timeframeButtons}>
          {TIMEFRAMES.map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[styles.timeframeButton, selectedTimeframe === tf && styles.timeframeButtonActive]}
              onPress={() => setSelectedTimeframe(tf)}
            >
              <Text style={[styles.timeframeText, selectedTimeframe === tf && styles.timeframeTextActive]}>{tf}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Health chip */}
      <View style={[styles.healthChip, { backgroundColor: healthChipBg, borderColor: healthColor }]}>
        <Text style={[styles.healthChipText, { color: healthColor }]}>
          {activeRefLine
            ? `${activeRefLine.prevValue.toFixed(0)}% → ${activeRefLine.newValue.toFixed(0)}%`
            : displayHealth ? `${displayHealth.toFixed(0)}%` : 'N/A'}
        </Text>
      </View>

      {/* Chart */}
      <View style={styles.chartWrapper} {...panResponder.panHandlers}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="areaGradient" x1="0" y1={yScale(yDomain[1])} x2="0" y2={yScale(yDomain[0])} gradientUnits="userSpaceOnUse">
              <Stop offset={Math.max(0, (yDomain[1] - 200) / (yDomain[1] - yDomain[0]))} stopColor="#59AA8A" stopOpacity="0.15" />
              <Stop offset={Math.max(0, (yDomain[1] - 160) / (yDomain[1] - yDomain[0]))} stopColor="#FDE37B" stopOpacity="0.1" />
              <Stop offset="1" stopColor="#D04C68" stopOpacity="0.05" />
            </LinearGradient>
            <LinearGradient id="eventGradient" x1="0" y1={yScale(yDomain[1])} x2="0" y2={yScale(yDomain[0])} gradientUnits="userSpaceOnUse">
              <Stop offset={Math.max(0, (yDomain[1] - 200) / (yDomain[1] - yDomain[0]))} stopColor="#59AA8A" stopOpacity="1" />
              <Stop offset={Math.max(0, (yDomain[1] - 160) / (yDomain[1] - yDomain[0]))} stopColor="#FDE37B" stopOpacity="1" />
              <Stop offset="1" stopColor="#D04C68" stopOpacity="1" />
            </LinearGradient>
          </Defs>

          <Path d={areaPath} fill="url(#areaGradient)" />
          {lineSegments.map((segment, i) => (
            <Path key={i} d={segment} stroke="url(#eventGradient)" strokeWidth={2} fill="none" />
          ))}

          {/* Reference lines */}
          {referenceLines.map((line, i) => (
            <Line
              key={i}
              x1={xScale(line.date)} x2={xScale(line.date)}
              y1={yScale(line.prevValue)} y2={yScale(line.newValue)}
              stroke="url(#eventGradient)"
              strokeWidth={(hoveredRefLineIndex === i || lockedRefLineIndex === i) ? 3 : 2}
              strokeLinecap="round"
            />
          ))}

          {/* Scrubber */}
          {activeScrubX !== null && activeScrubHealth !== null && (() => {
            // Clamp scrubber position to chart bounds, accounting for circle radius (6px)
            const circleRadius = 6;
            const minX = padding.left + circleRadius;
            const maxX = chartWidth - padding.right - circleRadius;
            const clampedX = Math.max(minX, Math.min(activeScrubX, maxX));
            const scrubberY = yScale(activeScrubHealth);
            const minY = padding.top + circleRadius;
            const maxY = chartHeight - padding.bottom - circleRadius;
            const clampedY = Math.max(minY, Math.min(scrubberY, maxY));
            return (
              <G>
                <Line x1={clampedX} x2={clampedX} y1={clampedY + circleRadius} y2={chartHeight - padding.bottom} stroke={healthColor} strokeWidth={1} />
                <Circle cx={clampedX} cy={clampedY} r={circleRadius} fill={healthColor} />
                <Circle cx={clampedX} cy={clampedY} r={3} fill="#fff" />
              </G>
            );
          })()}
        </Svg>
      </View>

      {/* Date/time display when scrubbing */}
      {activeScrubTimestamp !== null && (
        <View style={styles.scrubDateContainer}>
          <Text style={styles.scrubDateText}>{formatScrubDate(activeScrubTimestamp)}</Text>
        </View>
      )}

      {/* Timeframe buttons */}
      <View style={styles.timeframeButtons}>
        {TIMEFRAMES.map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[styles.timeframeButton, selectedTimeframe === tf && styles.timeframeButtonActive]}
            onPress={() => {
              setSelectedTimeframe(tf);
              setLockedRefLineIndex(null);
              setLockedScrubData({ health: null, x: null, timestamp: null });
              onHighlightEvent?.(null);
              onLockFilter?.(null);
            }}
          >
            <Text style={[styles.timeframeText, selectedTimeframe === tf && styles.timeframeTextActive]}>{tf}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Drawer */}
      <VaultChartDrawer
        drawerSide={drawerSide}
        drawerAnim={drawerAnim}
        activeRefLine={activeRefLine}
        transactions={lockedEventTransactions}
        allTransactions={transactions}
        onClose={closeDrawer}
        onTransactionPress={onTransactionPress}
      />
    </View>
  );
});

export default VaultHealthChartView;
