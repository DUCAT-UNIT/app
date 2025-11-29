/**
 * FullscreenVaultChart Component
 * Fullscreen modal chart with transaction drawer
 * Opens from VaultHealthGauge chart button
 */

import React, { useMemo, useState, useCallback, useEffect, memo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  Modal,
  Animated,
  ScrollView,
} from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, G, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme';
import { API, API_KEYS } from '../../utils/constants';
import Icon from '../icons';
import type { VaultHistoryTransaction } from '../../services/vaultService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_WIDTH = 280;
const LEFT_MARGIN = 50;
const RIGHT_MARGIN = 0;

// Landscape dimensions (rotated 90°)
const LANDSCAPE_WIDTH = SCREEN_HEIGHT;
const LANDSCAPE_HEIGHT = SCREEN_WIDTH;

type PriceTimeframe = '1D' | '1W' | '1M' | '1Y';
const TIMEFRAMES: PriceTimeframe[] = ['1D', '1W', '1M', '1Y'];

// Cache settings
const CACHE_KEY_PREFIX = 'vault_btc_price_cache_';
const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Types
interface BitcoinData {
  price: string;
  timestamp: number;
}

interface SeriesItem {
  date: number;
  healthValue: number | null;
}

interface ReferenceLine {
  date: number;
  txTimestamp: number;
  prevValue: number;
  newValue: number;
  eventType: string;
}

// Interval configuration
const INTERVAL_CONFIG: Record<PriceTimeframe, { unitLength: number; numberOfUnits: number }> = {
  '1D': { unitLength: 5 * 60, numberOfUnits: 288 },
  '1W': { unitLength: 1 * 60 * 60, numberOfUnits: 168 },
  '1M': { unitLength: 6 * 60 * 60, numberOfUnits: 120 },
  '1Y': { unitLength: 24 * 60 * 60, numberOfUnits: 365 },
};

// Binary search for closest BTC price
function getBitcoinPriceByTimestamp(bitcoinData: BitcoinData[], targetTimestamp: number): number {
  if (bitcoinData.length === 0) return 50000;

  let left = 0;
  let right = bitcoinData.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTimestamp = bitcoinData[mid].timestamp;

    if (midTimestamp === targetTimestamp) {
      return parseFloat(bitcoinData[mid].price);
    }

    if (midTimestamp < targetTimestamp) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  if (left >= bitcoinData.length) return parseFloat(bitcoinData[right].price);
  if (right < 0) return parseFloat(bitcoinData[left].price);

  const leftDiff = Math.abs(bitcoinData[left].timestamp - targetTimestamp);
  const rightDiff = Math.abs(bitcoinData[right].timestamp - targetTimestamp);

  return parseFloat(leftDiff < rightDiff ? bitcoinData[left].price : bitcoinData[right].price);
}

// Get closest transaction before a timestamp
function getClosestTransactionBefore(
  transactions: VaultHistoryTransaction[],
  timestamp: number
): VaultHistoryTransaction | undefined {
  for (const tx of transactions) {
    if (tx.timestamp <= timestamp) return tx;
  }
  return undefined;
}

// Get transactions between timestamps
function getTransactionsBetween(
  transactions: VaultHistoryTransaction[],
  timestampStart: number,
  timestampEnd: number
): VaultHistoryTransaction[] {
  const result: VaultHistoryTransaction[] = [];
  for (const tx of transactions) {
    if (tx.timestamp >= timestampStart && tx.timestamp <= timestampEnd) {
      result.push(tx);
    } else if (tx.timestamp < timestampStart) {
      break;
    }
  }
  return result;
}

// Compute health percentage
function computeHealthPercent(tx: VaultHistoryTransaction, btcPrice: number): number {
  const { vault_amount, amount_borrowed } = tx;
  const value = Math.floor((((vault_amount / 100_000_000) * btcPrice) / (amount_borrowed / 100)) * 100);
  return Math.min(value, 500);
}

// Create series data
function createEventSeries(
  bitcoinData: BitcoinData[],
  interval: PriceTimeframe,
  transactions: VaultHistoryTransaction[]
): { series: SeriesItem[]; referenceLines: ReferenceLine[] } {
  if (!bitcoinData.length || !transactions.length) {
    return { series: [], referenceLines: [] };
  }

  const { unitLength, numberOfUnits } = INTERVAL_CONFIG[interval];
  const referenceLines: ReferenceLine[] = [];

  const sortedTxsDesc = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
  const sortedBtcData = [...bitcoinData].sort((a, b) => a.timestamp - b.timestamp);

  const endTimestamp = Math.floor(Date.now() / 1000);
  const startTimestamp = endTimestamp - unitLength * numberOfUnits;

  const series: SeriesItem[] = [];

  for (let i = 0; i < numberOfUnits; i++) {
    const timeDelta = i * unitLength;
    const bucketStart = startTimestamp + timeDelta;
    const bucketEnd = bucketStart + unitLength - 1;

    const btcPrice = getBitcoinPriceByTimestamp(sortedBtcData, bucketEnd);
    const txBefore = getClosestTransactionBefore(sortedTxsDesc, bucketStart);
    const txsBetween = getTransactionsBetween(sortedTxsDesc, bucketStart, bucketEnd);

    const healthBefore = txBefore ? computeHealthPercent(txBefore, btcPrice) : null;
    const healthAfter = txsBetween.length > 0
      ? computeHealthPercent(txsBetween[txsBetween.length - 1], btcPrice)
      : healthBefore;

    if (txsBetween.length > 0) {
      const eventTx = txsBetween[txsBetween.length - 1];
      referenceLines.push({
        date: bucketEnd * 1000,
        txTimestamp: eventTx.timestamp * 1000,
        prevValue: Math.max(healthBefore || 125, 125),
        newValue: Math.max(healthAfter || 125, 125),
        eventType: eventTx.action.toLowerCase() === 'open' ? 'create' : eventTx.action.toLowerCase(),
      });
    }

    series.push({
      date: bucketEnd * 1000,
      healthValue: healthAfter,
    });
  }

  return { series, referenceLines };
}

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
  const [selectedTimeframe, setSelectedTimeframe] = useState<PriceTimeframe>('1W');
  const [btcPrices, setBtcPrices] = useState<BitcoinData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrubData, setScrubData] = useState<{ health: number | null; x: number | null }>({ health: null, x: null });
  const [hoveredRefLineIndex, setHoveredRefLineIndex] = useState<number | null>(null);
  const [lockedRefLineIndex, setLockedRefLineIndex] = useState<number | null>(null);
  const [lockedScrubData, setLockedScrubData] = useState<{ health: number | null; x: number | null }>({ health: null, x: null });

  // Drawer animation
  const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const [drawerSide, setDrawerSide] = useState<'left' | 'right' | null>(null);

  // Animated values for ultra-smooth scrubbing (native-driven)
  const scrubXAnim = useRef(new Animated.Value(0)).current;
  const scrubYAnim = useRef(new Animated.Value(0)).current;
  const scrubOpacity = useRef(new Animated.Value(0)).current;
  const scrubColorAnim = useRef(new Animated.Value(0)).current; // 0=red, 0.5=yellow, 1=green

  // Throttle ref for pan performance
  const lastUpdateRef = useRef<number>(0);
  const pendingUpdateRef = useRef<number | null>(null);

  // Safe area insets - in rotated view, left inset becomes top padding
  const insets = useSafeAreaInsets();
  // In landscape (rotated 90°), the left side of screen is now top
  const safeAreaTop = insets.left;
  const safeAreaBottom = insets.right;

  // Chart dimensions - landscape (rotated 90°) with margins
  const chartWidth = LANDSCAPE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
  // SVG fills full height so gradient extends to bottom edge
  const chartHeight = LANDSCAPE_HEIGHT;
  // Line drawing area stops above timeframe buttons (50px from bottom)
  const padding = { top: 70, right: 0, bottom: 70, left: 0 };
  const drawWidth = chartWidth - padding.left - padding.right;
  const drawHeight = chartHeight - padding.top - padding.bottom;

  // Fetch BTC prices
  useEffect(() => {
    if (!visible || !transactions.length) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchPrices = async () => {
      const days = selectedTimeframe === '1D' ? 1 :
                   selectedTimeframe === '1W' ? 7 :
                   selectedTimeframe === '1M' ? 30 : 365;

      const cacheKey = `${CACHE_KEY_PREFIX}${selectedTimeframe}`;

      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && !cancelled) {
          const { prices, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
            const bitcoinData: BitcoinData[] = prices.map((p: [number, number]) => ({
              timestamp: Math.floor(p[0] / 1000),
              price: String(p[1]),
            }));
            setBtcPrices(bitcoinData);
            setLoading(false);
            return;
          }
        }
      } catch {}

      try {
        const response = await fetch(
          `${API.COINGECKO}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
          {
            headers: {
              'accept': 'application/json',
              'x-cg-demo-api-key': API_KEYS.COINGECKO
            }
          }
        );

        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          if (data.prices?.length) {
            const sampled = data.prices.length > 150
              ? data.prices.filter((_: [number, number], i: number) =>
                  i % Math.ceil(data.prices.length / 150) === 0)
              : data.prices;

            const bitcoinData: BitcoinData[] = sampled.map((p: [number, number]) => ({
              timestamp: Math.floor(p[0] / 1000),
              price: String(p[1]),
            }));

            setBtcPrices(bitcoinData);

            AsyncStorage.setItem(cacheKey, JSON.stringify({
              prices: sampled,
              timestamp: Date.now()
            })).catch(() => {});
          }
        }
      } catch {}

      if (!cancelled) setLoading(false);
    };

    setLoading(true);
    fetchPrices();

    return () => { cancelled = true; };
  }, [visible, selectedTimeframe, transactions.length]);

  // Generate chart data
  const { series, referenceLines } = useMemo(() => {
    if (!btcPrices || !transactions.length) {
      return { series: [], referenceLines: [] };
    }
    return createEventSeries(btcPrices, selectedTimeframe, transactions);
  }, [btcPrices, selectedTimeframe, transactions]);

  const lineData = useMemo(() => {
    return series.filter(s => s.healthValue !== null) as Array<SeriesItem & { healthValue: number }>;
  }, [series]);

  // Y domain
  const yDomain = useMemo(() => {
    if (!lineData.length) return [125, 350];
    const values = lineData.map(d => d.healthValue);
    const dataMax = Math.max(...values);
    const min = 125;
    const headroom = (dataMax - min) * 0.1;
    const max = Math.max(dataMax + headroom, 250);
    return [min, max];
  }, [lineData]);

  // Scale functions
  const xScale = useCallback((timestamp: number) => {
    if (!series.length) return padding.left;
    const minX = series[0].date;
    const maxX = series[series.length - 1].date;
    const range = maxX - minX || 1;
    return padding.left + ((timestamp - minX) / range) * drawWidth;
  }, [series, drawWidth, padding.left]);

  const yScale = useCallback((value: number) => {
    const [minY, maxY] = yDomain;
    const range = maxY - minY || 1;
    return padding.top + drawHeight - ((value - minY) / range) * drawHeight;
  }, [yDomain, drawHeight, padding.top]);

  // Generate line segments - edge to edge
  const lineSegments = useMemo(() => {
    if (lineData.length === 0) return [];

    const leftEdge = 0;
    const rightEdge = chartWidth;
    const eventDates = new Set(referenceLines.map(rl => rl.date));

    if (lineData.length === 1) {
      const y = yScale(lineData[0].healthValue);
      return [`M ${leftEdge} ${y} L ${rightEdge} ${y}`];
    }

    const segments: string[] = [];
    const firstY = yScale(lineData[0].healthValue);
    let currentSegment = `M ${leftEdge} ${firstY}`;
    let lastY = firstY;

    for (let i = 0; i < lineData.length; i++) {
      const x = xScale(lineData[i].date);
      const y = yScale(lineData[i].healthValue);
      const hasEvent = eventDates.has(lineData[i].date);

      if (hasEvent && i > 0) {
        currentSegment += ` L ${x} ${lastY}`;
        segments.push(currentSegment);
        currentSegment = `M ${x} ${y}`;
        lastY = y;
      } else {
        currentSegment += ` L ${x} ${y}`;
        lastY = y;
      }
    }

    currentSegment += ` L ${rightEdge} ${lastY}`;
    if (currentSegment !== '') segments.push(currentSegment);

    return segments;
  }, [lineData, xScale, yScale, referenceLines, chartWidth]);

  // Generate area path - edge to edge, extending to bottom of chart
  const areaPath = useMemo(() => {
    if (lineData.length === 0) return '';
    const bottomY = chartHeight; // Extend gradient to bottom of screen
    const leftEdge = 0;
    const rightEdge = chartWidth;
    const eventDates = new Set(referenceLines.map(rl => rl.date));

    if (lineData.length === 1) {
      const y = yScale(lineData[0].healthValue);
      return `M ${leftEdge} ${bottomY} L ${leftEdge} ${y} L ${rightEdge} ${y} L ${rightEdge} ${bottomY} Z`;
    }

    const firstY = yScale(lineData[0].healthValue);
    let path = `M ${leftEdge} ${bottomY}`;
    path += ` L ${leftEdge} ${firstY}`;

    let lastY = firstY;

    for (let i = 0; i < lineData.length; i++) {
      const x = xScale(lineData[i].date);
      const y = yScale(lineData[i].healthValue);
      const hasEvent = eventDates.has(lineData[i].date);

      if (hasEvent && i > 0) {
        path += ` L ${x} ${lastY}`;
        path += ` L ${x} ${y}`;
        lastY = y;
      } else {
        path += ` L ${x} ${y}`;
        lastY = y;
      }
    }

    path += ` L ${rightEdge} ${lastY}`;
    path += ` L ${rightEdge} ${bottomY} Z`;
    return path;
  }, [lineData, xScale, yScale, padding, drawHeight, chartWidth, referenceLines]);

  // Get health at X position
  const getHealthAtX = useCallback((x: number): number | null => {
    if (!lineData.length || !series.length) return null;

    const clampedX = Math.max(0, Math.min(x, chartWidth));
    const ratio = clampedX / chartWidth;
    const minTime = series[0].date;
    const maxTime = series[series.length - 1].date;
    const targetTime = minTime + ratio * (maxTime - minTime);

    if (lineData.length === 1) return lineData[0].healthValue;
    if (targetTime <= lineData[0].date) return lineData[0].healthValue;
    if (targetTime >= lineData[lineData.length - 1].date) return lineData[lineData.length - 1].healthValue;

    let beforeIdx = 0;
    let afterIdx = lineData.length - 1;
    for (let i = 0; i < lineData.length - 1; i++) {
      if (lineData[i].date <= targetTime && lineData[i + 1].date >= targetTime) {
        beforeIdx = i;
        afterIdx = i + 1;
        break;
      }
    }

    const beforePoint = lineData[beforeIdx];
    const afterPoint = lineData[afterIdx];
    const timeFraction = (targetTime - beforePoint.date) / (afterPoint.date - beforePoint.date || 1);
    return beforePoint.healthValue + timeFraction * (afterPoint.healthValue - beforePoint.healthValue);
  }, [lineData, series, chartWidth]);

  // Find nearby reference line with snapping
  const findNearbyRefLine = useCallback((x: number): number | null => {
    const tolerance = 25;
    let closestIndex: number | null = null;
    let closestDistance = tolerance;

    for (let i = 0; i < referenceLines.length; i++) {
      const refLineX = xScale(referenceLines[i].date);
      const distance = Math.abs(x - refLineX);
      if (distance <= closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }
    return closestIndex;
  }, [referenceLines, xScale]);

  // Pan responder
  // Refs for scrub data to avoid state updates during pan
  const scrubDataRef = useRef<{ health: number | null; x: number | null }>({ health: null, x: null });
  const hoveredRefLineRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);

  // Update animated scrubber position (no state, pure animation)
  const updateAnimatedScrub = useCallback((x: number) => {
    const nearbyRefIndex = findNearbyRefLine(x);
    hoveredRefLineRef.current = nearbyRefIndex;

    let finalX = x;
    let health: number | null = null;

    if (nearbyRefIndex !== null && referenceLines[nearbyRefIndex]) {
      const refLine = referenceLines[nearbyRefIndex];
      finalX = xScale(refLine.date);
      health = refLine.newValue;
    } else {
      health = getHealthAtX(x);
    }

    scrubDataRef.current = { health, x: finalX };

    // Update animated values directly (no state, native-driven smooth)
    scrubXAnim.setValue(finalX);
    if (health !== null) {
      scrubYAnim.setValue(yScale(health));
      // Set color value: 0=red (<=160), 0.5=yellow (<=200), 1=green (>200)
      const colorVal = health <= 160 ? 0 : health <= 200 ? 0.5 : 1;
      scrubColorAnim.setValue(colorVal);
    }
  }, [findNearbyRefLine, referenceLines, xScale, getHealthAtX, scrubXAnim, scrubYAnim, scrubColorAnim, yScale]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      isPanningRef.current = true;
      // Cancel any pending updates
      if (pendingUpdateRef.current) {
        cancelAnimationFrame(pendingUpdateRef.current);
      }
      setLockedRefLineIndex(null);
      setLockedScrubData({ health: null, x: null });

      // Show scrubber immediately
      scrubOpacity.setValue(1);
      updateAnimatedScrub(evt.nativeEvent.locationX);

      // Update health display less frequently
      setScrubData({ ...scrubDataRef.current });
      setHoveredRefLineIndex(hoveredRefLineRef.current);
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;

      // Update animated position immediately (no render needed)
      updateAnimatedScrub(x);

      // Throttle state updates for health chip to ~20fps
      const now = Date.now();
      if (now - lastUpdateRef.current < 50) {
        if (!pendingUpdateRef.current) {
          pendingUpdateRef.current = requestAnimationFrame(() => {
            if (isPanningRef.current) {
              setScrubData({ ...scrubDataRef.current });
              setHoveredRefLineIndex(hoveredRefLineRef.current);
            }
            pendingUpdateRef.current = null;
          });
        }
        return;
      }
      lastUpdateRef.current = now;
      setScrubData({ ...scrubDataRef.current });
      setHoveredRefLineIndex(hoveredRefLineRef.current);
    },
    onPanResponderRelease: () => {
      isPanningRef.current = false;
      // Cancel any pending updates
      if (pendingUpdateRef.current) {
        cancelAnimationFrame(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }

      // Hide animated scrubber
      scrubOpacity.setValue(0);

      const nearbyRefIndex = hoveredRefLineRef.current;
      if (nearbyRefIndex !== null && referenceLines[nearbyRefIndex]) {
        const refLine = referenceLines[nearbyRefIndex];
        const exactX = xScale(refLine.date);
        setLockedRefLineIndex(nearbyRefIndex);
        setLockedScrubData({ health: refLine.newValue, x: exactX });
      }
      setScrubData({ health: null, x: null });
      setHoveredRefLineIndex(null);
      scrubDataRef.current = { health: null, x: null };
      hoveredRefLineRef.current = null;
    },
  }), [updateAnimatedScrub, referenceLines, xScale, scrubOpacity]);

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
  }, [lockedRefLineIndex]);

  // Find transactions for locked event
  const lockedEventTransactions = useMemo(() => {
    if (lockedRefLineIndex === null || !referenceLines[lockedRefLineIndex]) return [];

    const refLine = referenceLines[lockedRefLineIndex];
    const { unitLength } = INTERVAL_CONFIG[selectedTimeframe];
    const bucketEnd = refLine.date / 1000;
    const bucketStart = bucketEnd - unitLength + 1;

    return transactions.filter(tx =>
      tx.timestamp >= bucketStart && tx.timestamp <= bucketEnd
    );
  }, [lockedRefLineIndex, referenceLines, transactions, selectedTimeframe]);

  // Active reference line
  const activeRefLineIndex = hoveredRefLineIndex ?? lockedRefLineIndex;
  const activeRefLine = activeRefLineIndex !== null ? referenceLines[activeRefLineIndex] : null;

  // Display values
  const displayHealth = scrubData.health ?? lockedScrubData.health ?? (lineData.length > 0 ? lineData[lineData.length - 1].healthValue : null);

  const healthColor = useMemo(() => {
    if (!displayHealth) return COLORS.SECONDARY_TEXT;
    if (displayHealth <= 160) return '#d04c68';
    if (displayHealth <= 200) return '#fde37b';
    return '#59aa8a';
  }, [displayHealth]);

  const healthChipBg = useMemo(() => {
    if (!displayHealth) return 'rgba(128, 128, 128, 0.1)';
    if (displayHealth <= 160) return 'rgba(208, 76, 104, 0.1)';
    if (displayHealth <= 200) return 'rgba(253, 227, 123, 0.1)';
    return 'rgba(89, 170, 138, 0.1)';
  }, [displayHealth]);

  // Format helpers
  const formatAction = (action: string) => action.charAt(0).toUpperCase() + action.slice(1);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBtc = (sats: number) => (sats / 100_000_000).toFixed(8);
  const formatUnit = (cents: number) => (cents / 100).toFixed(2);

  // Close drawer
  const closeDrawer = useCallback(() => {
    setLockedRefLineIndex(null);
    setLockedScrubData({ health: null, x: null });
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setLockedRefLineIndex(null);
      setLockedScrubData({ health: null, x: null });
      setScrubData({ health: null, x: null });
      setDrawerSide(null);
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Rotated landscape container */}
        <View style={[styles.rotatedContainer, { paddingTop: safeAreaTop, paddingBottom: safeAreaBottom }]}>
          {/* Top right controls - health chip and close button */}
          {/* Top right controls - hidden when drawer is open */}
          {drawerSide === null && (
            <View style={[styles.topRightControls, { top: safeAreaTop + 16 }]}>
              <View style={[styles.healthChip, { backgroundColor: healthChipBg, borderColor: healthColor }]}>
                <Text style={[styles.healthChipText, { color: healthColor }]}>
                  {displayHealth ? `${displayHealth.toFixed(0)}%` : 'N/A'}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                <Icon name="close" size={24} color={COLORS.WHITE} />
              </TouchableOpacity>
            </View>
          )}

          {/* Chart area */}
          <View style={[styles.chartContainer, { paddingLeft: LEFT_MARGIN, paddingRight: RIGHT_MARGIN }]}>

          {/* Chart */}
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
              <Svg width={chartWidth} height={chartHeight}>
                <Defs>
                  <LinearGradient
                    id="fsAreaGradient"
                    x1="0"
                    y1={yScale(yDomain[1])}
                    x2="0"
                    y2={chartHeight}
                    gradientUnits="userSpaceOnUse"
                  >
                    <Stop offset="0" stopColor="#59AA8A" stopOpacity="0.15" />
                    <Stop offset={Math.max(0, (yScale(200) - yScale(yDomain[1])) / (chartHeight - yScale(yDomain[1])))} stopColor="#59AA8A" stopOpacity="0.15" />
                    <Stop offset={Math.max(0, (yScale(160) - yScale(yDomain[1])) / (chartHeight - yScale(yDomain[1])))} stopColor="#FDE37B" stopOpacity="0.1" />
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
                  const isActive = hoveredRefLineIndex === i || lockedRefLineIndex === i;
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

                {/* Locked Scrubber */}
                {lockedScrubData.x !== null && scrubData.x === null && (
                  <G>
                    <Line
                      x1={lockedScrubData.x}
                      x2={lockedScrubData.x}
                      y1={yScale(lockedScrubData.health || 0) + 6}
                      y2={chartHeight}
                      stroke={healthColor}
                      strokeWidth={1}
                    />
                    <Circle cx={lockedScrubData.x} cy={yScale(lockedScrubData.health || 0)} r={6} fill={healthColor} />
                    <Circle cx={lockedScrubData.x} cy={yScale(lockedScrubData.health || 0)} r={3} fill="#fff" />
                  </G>
                )}

              </Svg>

              {/* Native Animated Scrubber Overlay - for ultra-smooth 60fps scrubbing */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.animatedScrubberContainer,
                  {
                    opacity: scrubOpacity,
                    transform: [{ translateX: scrubXAnim }],
                  },
                ]}
              >
                {/* Scrubber Line */}
                <Animated.View
                  style={[
                    styles.animatedScrubberLine,
                    {
                      top: scrubYAnim,
                      height: Animated.subtract(chartHeight, scrubYAnim),
                      backgroundColor: scrubColorAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: ['#d04c68', '#fde37b', '#59aa8a'],
                      }),
                    },
                  ]}
                />
                {/* Scrubber Dot */}
                <Animated.View
                  style={[
                    styles.animatedScrubberDotOuter,
                    {
                      top: Animated.subtract(scrubYAnim, 6),
                      backgroundColor: scrubColorAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: ['#d04c68', '#fde37b', '#59aa8a'],
                      }),
                    },
                  ]}
                >
                  <View style={styles.animatedScrubberDotInner} />
                </Animated.View>
              </Animated.View>
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
                  setLockedScrubData({ health: null, x: null });
                }}
              >
                <Text style={[styles.timeframeText, selectedTimeframe === tf && styles.timeframeTextActive]}>
                  {tf}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Transaction Drawer */}
          {drawerSide !== null && (
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
                <TouchableOpacity onPress={closeDrawer} style={styles.drawerCloseBtn}>
                  <Icon name="close" size={20} color={COLORS.WHITE} />
                </TouchableOpacity>
              </View>

              {/* Transactions List */}
              <ScrollView style={styles.drawerTransactions} showsVerticalScrollIndicator={false}>
                {lockedEventTransactions.length === 0 ? (
                  <Text style={styles.drawerEmptyText}>No transactions found</Text>
                ) : (
                  lockedEventTransactions.map((tx, i) => {
                    const isCollateralAction = tx.action === 'deposit' || tx.action === 'withdraw' || tx.action === 'open';
                    const isPositive = tx.action === 'deposit' || tx.action === 'borrow' || tx.action === 'open';
                    const amountColor = isPositive ? COLORS.SUCCESS_GREEN : COLORS.RED;

                    return (
                      <View key={i} style={styles.drawerTxItem}>
                        <View style={styles.drawerTxIcon}>
                          <Icon name="vault_logo" size={36} color={COLORS.WHITE} />
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
          )}
        </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotatedContainer: {
    width: LANDSCAPE_WIDTH,
    height: LANDSCAPE_HEIGHT,
    transform: [{ rotate: '90deg' }],
    backgroundColor: COLORS.DARK_BG,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  topRightControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.VERY_DARK_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  healthChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  healthChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
  },
  chartWrapper: {
    width: '100%',
    position: 'relative',
  },
  // Native animated scrubber styles for ultra-smooth 60fps performance
  animatedScrubberContainer: {
    position: 'absolute',
    top: 0,
    left: -0.5, // Center the 1px line on the X coordinate
    width: 1,
    height: '100%',
  },
  animatedScrubberLine: {
    position: 'absolute',
    left: 0,
    width: 1,
  },
  animatedScrubberDotOuter: {
    position: 'absolute',
    left: -5.5, // Center the 12px dot on the 1px line: (12 - 1) / 2 = 5.5
    width: 12,
    height: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedScrubberDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  timeframeButtons: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingLeft: LEFT_MARGIN,
    paddingRight: RIGHT_MARGIN,
  },
  timeframeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
    minWidth: 70,
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  timeframeText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  timeframeTextActive: {
    color: COLORS.WHITE,
  },
  // Drawer styles - adjusted for landscape
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: COLORS.VERY_DARK_GRAY,
    paddingTop: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 50,
  },
  drawerRight: {
    right: 0,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.DARK_GRAY,
    shadowOffset: { width: -2, height: 0 },
  },
  drawerLeft: {
    left: LEFT_MARGIN,
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

export default FullscreenVaultChart;
