/**
 * Vault Info Page Stories
 * Clean layout with semicircular gauge dial and organized stats
 * Design System Reference: /DESIGN_SYSTEM.md
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Dimensions, PanResponder, Animated } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, TSpan, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import type { Meta, StoryObj } from '@storybook/react';
import Icon from '../../../../components/icons';
import type { VaultHistoryTransaction } from '../../../../services/vaultService';
import {
  colors,
  spacing,
  fonts,
  fontSizes,
  fontWeights,
  phoneFrame,
  mutinynetBanner,
  DEVICE_CONFIGS,
  type ScreenSize,
} from '../../design-tokens';

// =============================================================================
// SCALED MUTINYNET BANNER
// =============================================================================

const BANNER_SIZES = {
  XS: { fontSize: 12, paddingV: 6 },
  S: { fontSize: 13, paddingV: 7 },
  M: { fontSize: 14, paddingV: 8 },
  L: { fontSize: 14, paddingV: 8 },
  XL: { fontSize: 15, paddingV: 10 },
};

const ScaledMutinynetBanner = ({ size = 'L' }: { size?: ScreenSize }) => {
  const config = BANNER_SIZES[size];
  return (
    <View style={[styles.mutinynetBanner, { paddingVertical: config.paddingV }]}>
      <Text style={[styles.mutinynetBannerText, { fontSize: config.fontSize }]}>
        Mutinynet Edition
      </Text>
    </View>
  );
};

// =============================================================================
// TYPES
// =============================================================================

type HealthState = 'healthy' | 'warning' | 'danger';
type TabType = 'activity' | 'about';

// =============================================================================
// GAUGE CONSTANTS & HELPERS
// =============================================================================

const SVG_SIZE = 298;

const pathSettings = {
  red: { title: 'Risky', color: '#d04c68' },
  yellow: { title: 'Moderate', color: '#fde37b' },
  green: { title: 'Healthy', color: '#59aa8a' },
};

const mapValueToRange = (value: number): number => {
  const inputMin = 125;
  const inputMax = 300;
  const outputMin = 11;
  const outputMax = 95;

  if (value >= 135 && value <= 160) {
    const specialMin = 135;
    const specialMax = 160;
    const specialOutputMin = 6;
    const specialOutputMax = 23.7;
    const t = (value - specialMin) / (specialMax - specialMin);
    const easedT = t * (1 + 0.2 * (1 - t));
    return specialOutputMin + (specialOutputMax - specialOutputMin) * easedT;
  }

  const clampedValue = Math.min(Math.max(value, inputMin), inputMax);
  return ((clampedValue - inputMin) * (outputMax - outputMin)) / (inputMax - inputMin) + outputMin;
};

const calculateDynamicRadius = (mappedValue: number): number => {
  if (mappedValue < 10) return 142;
  if (mappedValue < 17) return 140;
  if (mappedValue >= 17 && mappedValue < 19) return 138;
  if (mappedValue >= 19 && mappedValue <= 24.7) return 138;
  if (mappedValue <= 70) return 135;
  return 135 + ((mappedValue - 65) / 25) * 7;
};

const getActivePath = (healthValue: number): 'red' | 'yellow' | 'green' | '' => {
  if (Number.isNaN(healthValue) || healthValue < 135 || !Number.isFinite(healthValue)) return '';
  if (healthValue <= 160) return 'red';
  if (healthValue <= 200) return 'yellow';
  return 'green';
};

// =============================================================================
// HEALTH CONFIG
// =============================================================================

const getHealthConfig = (healthState: HealthState) => {
  switch (healthState) {
    case 'healthy':
      return { percentage: 245, color: colors.semantic.success, label: 'Healthy' };
    case 'warning':
      return { percentage: 175, color: colors.semantic.warning, label: 'Moderate' };
    case 'danger':
      return { percentage: 145, color: colors.semantic.error, label: 'Risky' };
  }
};

// =============================================================================
// MOCK VAULT TRANSACTIONS GENERATOR
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Generate mock transactions based on event count
// First transaction at the very start of the week, rest spread evenly
const generateMockTransactions = (eventCount: number): VaultHistoryTransaction[] => {
  const now = Math.floor(Date.now() / 1000);
  const weekInSeconds = 7 * 24 * 60 * 60;
  const transactions: VaultHistoryTransaction[] = [];

  // Base values - start with vault open
  let vaultAmount = 5000000; // 0.05 BTC in sats
  let amountBorrowed = 200000; // 2000 UNIT in cents
  const oraclePrice = 102000;

  const actions = ['open', 'deposit', 'borrow', 'repay', 'withdraw', 'deposit', 'borrow'];

  for (let i = 0; i < eventCount; i++) {
    const action = i === 0 ? 'open' : actions[i % actions.length];

    // First transaction at start of week, rest spread evenly across remaining time
    let timestamp: number;
    if (i === 0) {
      // Open vault at the very beginning of the week
      timestamp = now - weekInSeconds + 60; // 1 minute after week start
    } else {
      // Spread remaining events evenly
      const eventSpacing = (weekInSeconds - 3600) / eventCount; // Leave 1 hour buffer
      timestamp = now - weekInSeconds + 3600 + i * eventSpacing;
    }

    // Modify values based on action to create visible jumps
    switch (action) {
      case 'open':
        // Initial vault state
        break;
      case 'deposit':
        vaultAmount += 2000000 + Math.floor(Math.random() * 1000000);
        break;
      case 'withdraw':
        vaultAmount = Math.max(2000000, vaultAmount - 1500000 - Math.floor(Math.random() * 500000));
        break;
      case 'borrow':
        amountBorrowed += 100000 + Math.floor(Math.random() * 50000);
        break;
      case 'repay':
        amountBorrowed = Math.max(100000, amountBorrowed - 80000 - Math.floor(Math.random() * 40000));
        break;
    }

    transactions.push({
      amount_borrowed: Math.floor(amountBorrowed),
      vault_amount: Math.floor(vaultAmount),
      btc_amt: Math.floor(vaultAmount),
      unit_amt: Math.floor(amountBorrowed),
      oracle_price: oraclePrice + (Math.random() - 0.5) * 2000,
      timestamp: Math.floor(timestamp),
      action,
    });
  }

  return transactions;
};

// =============================================================================
// STORYBOOK VAULT HEALTH CHART (Exact match to VaultHealthChartView)
// Uses mock BTC data 100k-105k instead of API calls
// =============================================================================

interface StoryChartProps {
  transactions: VaultHistoryTransaction[];
  width?: number;
  height?: number;
  rotated?: boolean; // When true, transform touch coordinates for 90° rotation
}

interface ReferenceLine {
  date: number;
  prevValue: number;
  newValue: number;
  eventType: string;
}

interface SeriesItem {
  date: number;
  healthValue: number | null;
}

const DRAWER_WIDTH = 280;

const StoryVaultHealthChart = ({ transactions, width, height, rotated = false }: StoryChartProps) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '1W' | '1M' | '1Y'>('1W');
  const [scrubData, setScrubData] = useState<{ health: number | null; x: number | null }>({ health: null, x: null });
  const [hoveredRefLineIndex, setHoveredRefLineIndex] = useState<number | null>(null);
  const [lockedRefLineIndex, setLockedRefLineIndex] = useState<number | null>(null);
  const [lockedScrubData, setLockedScrubData] = useState<{ health: number | null; x: number | null }>({ health: null, x: null });

  // Drawer animation and side tracking
  const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const [drawerSide, setDrawerSide] = useState<'left' | 'right' | null>(null);

  // Chart dimensions
  const chartWidth = width ?? SCREEN_WIDTH;
  const chartHeight = height ?? 140;
  const padding = { top: 25, right: 0, bottom: 15, left: 0 };
  const drawWidth = chartWidth - padding.left - padding.right;
  const drawHeight = chartHeight - padding.top - padding.bottom;

  // Generate mock BTC prices and create series data (matching VaultHealthChartView logic)
  const { series, referenceLines, lineData } = useMemo(() => {
    const intervalConfig = {
      '1D': { unitLength: 5 * 60, numberOfUnits: 288 },
      '1W': { unitLength: 1 * 60 * 60, numberOfUnits: 168 },
      '1M': { unitLength: 6 * 60 * 60, numberOfUnits: 120 },
      '1Y': { unitLength: 24 * 60 * 60, numberOfUnits: 365 },
    };

    const { unitLength, numberOfUnits } = intervalConfig[selectedTimeframe];
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - unitLength * numberOfUnits;

    // Sort transactions descending (latest first)
    const sortedTxsDesc = [...transactions].sort((a, b) => b.timestamp - a.timestamp);

    const seriesData: SeriesItem[] = [];
    const refLines: ReferenceLine[] = [];

    // Generate mock BTC price function (100k-105k range)
    const getMockBtcPrice = (timestamp: number) => {
      const ratio = (timestamp - startTimestamp) / (endTimestamp - startTimestamp);
      return 102500 + Math.sin(ratio * Math.PI * 4) * 2000 + Math.sin(ratio * Math.PI * 7) * 500;
    };

    // Get closest transaction before a timestamp
    const getClosestTxBefore = (timestamp: number) => {
      for (const tx of sortedTxsDesc) {
        if (tx.timestamp <= timestamp) return tx;
      }
      return undefined;
    };

    // Get transactions between timestamps
    const getTxsBetween = (start: number, end: number) => {
      return sortedTxsDesc.filter(tx => tx.timestamp >= start && tx.timestamp <= end);
    };

    // Compute health percent
    const computeHealth = (tx: VaultHistoryTransaction, btcPrice: number) => {
      const value = Math.floor((((tx.vault_amount / 100_000_000) * btcPrice) / (tx.amount_borrowed / 100)) * 100);
      return Math.min(value, 500);
    };

    for (let i = 0; i < numberOfUnits; i++) {
      const bucketStart = startTimestamp + i * unitLength;
      const bucketEnd = bucketStart + unitLength - 1;

      const btcPrice = getMockBtcPrice(bucketEnd);
      const txBefore = getClosestTxBefore(bucketStart);
      const txsBetween = getTxsBetween(bucketStart, bucketEnd);

      const healthBefore = txBefore ? computeHealth(txBefore, btcPrice) : null;
      const healthAfter = txsBetween.length > 0
        ? computeHealth(txsBetween[txsBetween.length - 1], btcPrice)
        : healthBefore;

      // Add reference line if there's an event
      if (txsBetween.length > 0 && healthBefore !== null && healthAfter !== null) {
        refLines.push({
          date: bucketEnd * 1000,
          prevValue: Math.max(healthBefore, 125),
          newValue: Math.max(healthAfter, 125),
          eventType: txsBetween[0].action.toLowerCase(),
        });
      }

      seriesData.push({
        date: bucketEnd * 1000,
        healthValue: healthAfter,
      });
    }

    const filteredLineData = seriesData.filter(s => s.healthValue !== null) as Array<SeriesItem & { healthValue: number }>;

    return { series: seriesData, referenceLines: refLines, lineData: filteredLineData };
  }, [transactions, selectedTimeframe]);

  // Y domain - always include 135 (liquidation line)
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

  // Generate segmented line paths (breaks at events) - extends edge to edge
  // Uses actual data points for continuity, events create vertical jumps
  const lineSegments = useMemo(() => {
    if (lineData.length === 0) return [];

    const leftEdge = 0;
    const rightEdge = chartWidth;

    // Build set of event dates for quick lookup
    const eventDates = new Set(referenceLines.map(rl => rl.date));

    if (lineData.length === 1) {
      const y = yScale(lineData[0].healthValue);
      return [`M ${leftEdge} ${y} L ${rightEdge} ${y}`];
    }

    const segments: string[] = [];

    // Start from left edge at first point's height
    const firstY = yScale(lineData[0].healthValue);
    let currentSegment = `M ${leftEdge} ${firstY}`;
    let lastY = firstY;

    for (let i = 0; i < lineData.length; i++) {
      const x = xScale(lineData[i].date);
      const y = yScale(lineData[i].healthValue);
      const hasEvent = eventDates.has(lineData[i].date);

      if (hasEvent && i > 0) {
        // Draw horizontal to this x at current height, then break segment
        currentSegment += ` L ${x} ${lastY}`;
        segments.push(currentSegment);
        // Start new segment at this point's actual Y (post-event)
        currentSegment = `M ${x} ${y}`;
        lastY = y;
      } else {
        // Continue line to this point
        currentSegment += ` L ${x} ${y}`;
        lastY = y;
      }
    }

    // Extend to right edge at last height
    currentSegment += ` L ${rightEdge} ${lastY}`;
    if (currentSegment !== '') segments.push(currentSegment);

    return segments;
  }, [lineData, xScale, yScale, referenceLines, chartWidth]);

  // Generate area path - extends to full width (edge to edge)
  // Uses actual data points for smooth fill, events create vertical jumps
  const areaPath = useMemo(() => {
    if (lineData.length === 0) return '';
    const bottomY = padding.top + drawHeight;
    const leftEdge = 0;
    const rightEdge = chartWidth;

    // Build set of event dates for quick lookup
    const eventDates = new Set(referenceLines.map(rl => rl.date));

    if (lineData.length === 1) {
      const y = yScale(lineData[0].healthValue);
      return `M ${leftEdge} ${bottomY} L ${leftEdge} ${y} L ${rightEdge} ${y} L ${rightEdge} ${bottomY} Z`;
    }

    // Start from bottom-left
    const firstY = yScale(lineData[0].healthValue);
    let path = `M ${leftEdge} ${bottomY}`;
    path += ` L ${leftEdge} ${firstY}`;

    let lastY = firstY;

    // Draw through all data points
    for (let i = 0; i < lineData.length; i++) {
      const x = xScale(lineData[i].date);
      const y = yScale(lineData[i].healthValue);
      const hasEvent = eventDates.has(lineData[i].date);

      if (hasEvent && i > 0) {
        // Draw horizontal to this x at current height, then vertical jump
        path += ` L ${x} ${lastY}`;
        path += ` L ${x} ${y}`;
        lastY = y;
      } else {
        path += ` L ${x} ${y}`;
        lastY = y;
      }
    }

    // Extend to right edge, then close
    path += ` L ${rightEdge} ${lastY}`;
    path += ` L ${rightEdge} ${bottomY} Z`;
    return path;
  }, [lineData, xScale, yScale, padding, drawHeight, chartWidth, referenceLines]);

  // Get health at X position - handles full chart width (edge to edge)
  const getHealthAtX = useCallback((x: number): number | null => {
    if (!lineData.length || !series.length) return null;

    // Clamp to full chart width
    const clampedX = Math.max(0, Math.min(x, chartWidth));
    const ratio = clampedX / chartWidth;
    const minTime = series[0].date;
    const maxTime = series[series.length - 1].date;
    const targetTime = minTime + ratio * (maxTime - minTime);

    if (lineData.length === 1) return lineData[0].healthValue;

    // At edges, return first/last health value
    if (targetTime <= lineData[0].date) return lineData[0].healthValue;
    if (targetTime >= lineData[lineData.length - 1].date) return lineData[lineData.length - 1].healthValue;

    // Find the two data points to interpolate between
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

  // Find nearby reference line - with wider tolerance for better touch detection
  const findNearbyRefLine = useCallback((x: number): number | null => {
    const tolerance = 25; // Wider tolerance for easier touch detection
    let closestIndex: number | null = null;
    let closestDistance = tolerance;

    // Find the closest reference line within tolerance
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

  // Get X coordinate from touch event (transform if rotated 90°)
  const getTouchX = useCallback((evt: any) => {
    if (rotated) {
      // When rotated 90° clockwise, user's horizontal swipe is locationY
      // and we need to invert it since the chart is flipped
      return chartWidth - evt.nativeEvent.locationY;
    }
    return evt.nativeEvent.locationX;
  }, [rotated, chartWidth]);

  // Pan responder - smooth scrubbing with reference line snapping
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setLockedRefLineIndex(null);
      setLockedScrubData({ health: null, x: null });
      const rawX = getTouchX(evt);
      const nearbyRefIndex = findNearbyRefLine(rawX);

      // Snap to reference line if nearby
      if (nearbyRefIndex !== null && referenceLines[nearbyRefIndex]) {
        const refLine = referenceLines[nearbyRefIndex];
        const snapX = xScale(refLine.date);
        setScrubData({ health: refLine.newValue, x: snapX });
      } else {
        setScrubData({ health: getHealthAtX(rawX), x: rawX });
      }
      setHoveredRefLineIndex(nearbyRefIndex);
    },
    onPanResponderMove: (evt) => {
      const rawX = getTouchX(evt);
      const nearbyRefIndex = findNearbyRefLine(rawX);

      // Snap to reference line if nearby
      if (nearbyRefIndex !== null && referenceLines[nearbyRefIndex]) {
        const refLine = referenceLines[nearbyRefIndex];
        const snapX = xScale(refLine.date);
        setScrubData({ health: refLine.newValue, x: snapX });
      } else {
        setScrubData({ health: getHealthAtX(rawX), x: rawX });
      }
      setHoveredRefLineIndex(nearbyRefIndex);
    },
    onPanResponderRelease: () => {
      if (hoveredRefLineIndex !== null && referenceLines[hoveredRefLineIndex]) {
        const refLine = referenceLines[hoveredRefLineIndex];
        const exactX = xScale(refLine.date);
        setLockedRefLineIndex(hoveredRefLineIndex);
        setLockedScrubData({ health: refLine.newValue, x: exactX });
      }
      setScrubData({ health: null, x: null });
      setHoveredRefLineIndex(null);
    },
  }), [getTouchX, getHealthAtX, findNearbyRefLine, referenceLines, hoveredRefLineIndex, xScale]);

  // Active reference line
  const activeRefLineIndex = hoveredRefLineIndex ?? lockedRefLineIndex;
  const activeRefLine = activeRefLineIndex !== null ? referenceLines[activeRefLineIndex] : null;

  // Display values
  const displayHealth = scrubData.health ?? lockedScrubData.health ?? (lineData.length > 0 ? lineData[lineData.length - 1].healthValue : null);
  const activeScrubX = scrubData.x ?? lockedScrubData.x;
  const activeScrubHealth = scrubData.health ?? lockedScrubData.health;

  const healthColor = useMemo(() => {
    if (!displayHealth) return colors.text.secondary;
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

  // Animate drawer when lock state changes
  useEffect(() => {
    if (lockedRefLineIndex !== null) {
      // Determine side based on event position
      const evtX = xScale(referenceLines[lockedRefLineIndex].date);
      const isLeft = evtX > chartWidth / 2;
      const hiddenValue = isLeft ? -DRAWER_WIDTH : DRAWER_WIDTH;

      // Set position and side synchronously, then animate
      drawerAnim.setValue(hiddenValue);
      setDrawerSide(isLeft ? 'left' : 'right');

      Animated.spring(drawerAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else if (drawerSide !== null) {
      // Closing: animate to hidden position based on current side
      const hiddenValue = drawerSide === 'left' ? -DRAWER_WIDTH : DRAWER_WIDTH;
      Animated.spring(drawerAnim, {
        toValue: hiddenValue,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(() => setDrawerSide(null));
    }
  }, [lockedRefLineIndex]);

  // Find transaction(s) for locked event
  const lockedEventTransactions = useMemo(() => {
    if (lockedRefLineIndex === null || !referenceLines[lockedRefLineIndex]) return [];

    const refLine = referenceLines[lockedRefLineIndex];
    const refTimestamp = refLine.date / 1000; // Convert to seconds

    // Find interval config for current timeframe
    const intervalConfig = {
      '1D': { unitLength: 5 * 60 },
      '1W': { unitLength: 1 * 60 * 60 },
      '1M': { unitLength: 6 * 60 * 60 },
      '1Y': { unitLength: 24 * 60 * 60 },
    };
    const { unitLength } = intervalConfig[selectedTimeframe];

    // Find transactions within this bucket
    const bucketEnd = refTimestamp;
    const bucketStart = bucketEnd - unitLength + 1;

    return transactions.filter(tx =>
      tx.timestamp >= bucketStart && tx.timestamp <= bucketEnd
    );
  }, [lockedRefLineIndex, referenceLines, transactions, selectedTimeframe]);

  // Format helpers
  const formatAction = (action: string) => {
    return action.charAt(0).toUpperCase() + action.slice(1);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBtc = (sats: number) => {
    return (sats / 100_000_000).toFixed(8);
  };

  const formatUnit = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  // Close drawer handler
  const closeDrawer = useCallback(() => {
    setLockedRefLineIndex(null);
    setLockedScrubData({ health: null, x: null });
  }, []);

  // Calculate chip position - at locked event X when drawer is open, otherwise top-right
  const lockedEventX = lockedRefLineIndex !== null && referenceLines[lockedRefLineIndex]
    ? xScale(referenceLines[lockedRefLineIndex].date)
    : null;

  return (
    <View style={[storyChartStyles.container, { width: chartWidth, minHeight: chartHeight + 60 }]}>
      {/* Health chip - only show when NOT locked (drawer closed) */}
      {lockedEventX === null && (
        <View
          style={[
            storyChartStyles.healthChip,
            { backgroundColor: healthChipBg, borderColor: healthColor },
          ]}
        >
          <Text style={[storyChartStyles.healthChipText, { color: healthColor }]}>
            {displayHealth ? `${displayHealth.toFixed(0)}%` : 'N/A'}
          </Text>
        </View>
      )}

      {/* Chart */}
      <View style={storyChartStyles.chartWrapper} {...panResponder.panHandlers}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            {/* Area gradient - matches health colors */}
            <LinearGradient
              id="storyAreaGradient"
              x1="0"
              y1={yScale(yDomain[1])}
              x2="0"
              y2={yScale(yDomain[0])}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset={Math.max(0, (yDomain[1] - 200) / (yDomain[1] - yDomain[0]))} stopColor="#59AA8A" stopOpacity="0.15" />
              <Stop offset={Math.max(0, (yDomain[1] - 160) / (yDomain[1] - yDomain[0]))} stopColor="#FDE37B" stopOpacity="0.1" />
              <Stop offset="1" stopColor="#D04C68" stopOpacity="0.05" />
            </LinearGradient>
            {/* Line gradient */}
            <LinearGradient
              id="storyLineGradient"
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
          <Path d={areaPath} fill="url(#storyAreaGradient)" />

          {/* Line segments */}
          {lineSegments.map((segment, i) => (
            <Path key={i} d={segment} stroke="url(#storyLineGradient)" strokeWidth={2} fill="none" />
          ))}

          {/* Reference lines (vertical event jumps) - computed from actual lineData */}
          {referenceLines.map((line, i) => {
            const isActive = hoveredRefLineIndex === i || lockedRefLineIndex === i;
            // Find the lineData index for this event
            const dataIndex = lineData.findIndex(d => d.date === line.date);
            if (dataIndex < 1) return null; // Need previous point for reference line

            const prevHealth = lineData[dataIndex - 1].healthValue;
            const newHealth = lineData[dataIndex].healthValue;

            return (
              <Line
                key={i}
                x1={xScale(line.date)}
                x2={xScale(line.date)}
                y1={yScale(prevHealth)}
                y2={yScale(newHealth)}
                stroke="url(#storyLineGradient)"
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
                y2={chartHeight - padding.bottom}
                stroke={healthColor}
                strokeWidth={1}
              />
              <Circle cx={lockedScrubData.x} cy={yScale(lockedScrubData.health || 0)} r={6} fill={healthColor} />
              <Circle cx={lockedScrubData.x} cy={yScale(lockedScrubData.health || 0)} r={3} fill="#fff" />
            </G>
          )}

          {/* Active Scrubber */}
          {scrubData.x !== null && (
            <G>
              <Line
                x1={scrubData.x}
                x2={scrubData.x}
                y1={yScale(scrubData.health || 0) + 6}
                y2={chartHeight - padding.bottom}
                stroke={healthColor}
                strokeWidth={1}
              />
              <Circle cx={scrubData.x} cy={yScale(scrubData.health || 0)} r={6} fill={healthColor} />
              <Circle cx={scrubData.x} cy={yScale(scrubData.health || 0)} r={3} fill="#fff" />
            </G>
          )}
        </Svg>
      </View>

      {/* Timeframe buttons */}
      <View style={storyChartStyles.timeframeButtons}>
        {(['1D', '1W', '1M', '1Y'] as const).map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[storyChartStyles.timeframeButton, selectedTimeframe === tf && storyChartStyles.timeframeButtonActive]}
            onPress={() => {
              setSelectedTimeframe(tf);
              setLockedRefLineIndex(null);
              setLockedScrubData({ health: null, x: null });
            }}
          >
            <Text style={[storyChartStyles.timeframeText, selectedTimeframe === tf && storyChartStyles.timeframeTextActive]}>
              {tf}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transaction Drawer - slides in from opposite side of event */}
      {drawerSide !== null && (
      <Animated.View
        style={[
          storyChartStyles.drawer,
          drawerSide === 'left' ? storyChartStyles.drawerLeft : storyChartStyles.drawerRight,
          {
            transform: [{ translateX: drawerAnim }],
          },
        ]}
      >
        {/* Drawer Header with Health Chip */}
        <View style={storyChartStyles.drawerHeader}>
          <View style={storyChartStyles.drawerHeaderLeft}>
            <Text style={storyChartStyles.drawerTitle}>Event Details</Text>
            {activeRefLine && (() => {
              // Dynamic chip color based on health change
              const newVal = activeRefLine.newValue;
              const chipColor = newVal <= 160 ? '#d04c68' : newVal <= 200 ? '#fde37b' : '#59aa8a';
              const chipBg = newVal <= 160 ? 'rgba(208, 76, 104, 0.15)' : newVal <= 200 ? 'rgba(253, 227, 123, 0.15)' : 'rgba(89, 170, 138, 0.15)';
              return (
                <View style={[storyChartStyles.drawerHealthChip, { backgroundColor: chipBg, borderColor: chipColor }]}>
                  <Text style={[storyChartStyles.drawerHealthChipText, { color: chipColor }]}>
                    {activeRefLine.prevValue.toFixed(0)}% → {activeRefLine.newValue.toFixed(0)}%
                  </Text>
                </View>
              );
            })()}
          </View>
          <TouchableOpacity onPress={closeDrawer} style={storyChartStyles.drawerCloseBtn}>
            <Icon name="close" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Transactions List */}
        <ScrollView style={storyChartStyles.drawerTransactions} showsVerticalScrollIndicator={false}>
          {lockedEventTransactions.length === 0 ? (
            <Text style={storyChartStyles.drawerEmptyText}>No transactions found</Text>
          ) : (
            lockedEventTransactions.map((tx, i) => {
              // Determine if this action affects collateral or debt
              const isCollateralAction = tx.action === 'deposit' || tx.action === 'withdraw' || tx.action === 'open';
              const isPositive = tx.action === 'deposit' || tx.action === 'borrow' || tx.action === 'open';
              const amountColor = isPositive ? colors.semantic.success : colors.semantic.error;

              return (
                <View key={i} style={storyChartStyles.drawerTxItem}>
                  {/* Icon */}
                  <View style={storyChartStyles.drawerTxIcon}>
                    <Icon name="vault_logo" size={36} color={colors.text.primary} />
                  </View>

                  {/* Content */}
                  <View style={storyChartStyles.drawerTxContent}>
                    <View style={storyChartStyles.drawerTxTopRow}>
                      <Text style={storyChartStyles.drawerTxAction}>{formatAction(tx.action)}</Text>
                      <View style={storyChartStyles.drawerTxAmountRow}>
                        <Icon
                          name={isCollateralAction ? 'btc_symbol' : 'unit_symbol'}
                          size={12}
                          color={amountColor}
                        />
                        <Text style={[storyChartStyles.drawerTxAmount, { color: amountColor }]}>
                          {isCollateralAction
                            ? formatBtc(tx.vault_amount)
                            : formatUnit(tx.amount_borrowed)
                          }
                        </Text>
                      </View>
                    </View>
                    <Text style={storyChartStyles.drawerTxDate}>{formatDate(tx.timestamp)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
      )}
    </View>
  );
};

const storyChartStyles = StyleSheet.create({
  container: {
    marginTop: 8,
    overflow: 'hidden', // Hide drawer when off-screen
  },
  healthChip: {
    position: 'absolute',
    top: 2,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    zIndex: 20,
  },
  healthChipText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
  chartWrapper: {
    width: '100%',
  },
  timeframeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'transparent',
    minWidth: 60,
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: colors.bg.tertiary,
  },
  timeframeText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
  timeframeTextActive: {
    color: colors.text.primary,
  },
  // Drawer styles
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.bg.secondary,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  drawerRight: {
    right: 0,
    borderLeftWidth: 1,
    borderLeftColor: colors.border.default,
    shadowOffset: { width: -2, height: 0 },
  },
  drawerLeft: {
    left: 0,
    borderRightWidth: 1,
    borderRightColor: colors.border.default,
    shadowOffset: { width: 2, height: 0 },
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  drawerHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  drawerTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  drawerHealthChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(24, 88, 228, 0.15)',
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  drawerHealthChipText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.medium,
    color: colors.brand.primary,
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerTransactions: {
    flex: 1,
  },
  drawerEmptyText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  drawerTxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
  },
  drawerTxIcon: {
    marginRight: spacing.sm,
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
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  drawerTxAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  drawerTxAmount: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
  },
  drawerTxDate: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
});

// =============================================================================
// FULLSCREEN CHART MODAL
// =============================================================================

interface FullscreenChartProps {
  visible: boolean;
  onClose: () => void;
  transactions: VaultHistoryTransaction[];
}

const FullscreenChart = ({ visible, onClose, transactions }: FullscreenChartProps) => {
  // Compact chart - 320px height
  const chartWidth = SCREEN_WIDTH;
  const chartHeight = 320;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.fullscreenChartContainer}>
        {/* Close button */}
        <TouchableOpacity style={styles.chartCloseButton} onPress={onClose} activeOpacity={0.7}>
          <Icon name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>

        {/* Chart - compact 320px height */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <StoryVaultHealthChart
            transactions={transactions}
            width={chartWidth}
            height={chartHeight}
            rotated={false}
          />
        </View>
      </View>
    </Modal>
  );
};

// =============================================================================
// VAULT GAUGE COMPONENT (SVG only)
// =============================================================================

interface VaultGaugeProps {
  healthPercentage: number;
  onChartPress?: () => void;
}

const VaultGauge = ({ healthPercentage, onChartPress }: VaultGaugeProps) => {
  const healthValue = healthPercentage;
  const isLiquidated = healthValue < 135 && healthValue > 0;
  const activePath = getActivePath(healthValue);
  const isHealthFinite = Number.isFinite(healthValue);
  const displayHealthValue = healthValue > 500 ? '500+' : healthValue.toFixed(0);

  const currentTitle = useMemo(() => {
    if (isLiquidated) return 'Liquidating';
    if (activePath && pathSettings[activePath]) return pathSettings[activePath].title;
    return 'N/A';
  }, [isLiquidated, activePath]);

  const titleColor = useMemo(() => {
    if (activePath && pathSettings[activePath]) return pathSettings[activePath].color;
    return '#ddd';
  }, [activePath]);

  const markerColor = useMemo(() => {
    if (isLiquidated) return pathSettings.red.color;
    if (activePath) return pathSettings[activePath].color;
    return '#59aa8a';
  }, [isLiquidated, activePath]);

  const { markerX, markerY } = useMemo(() => {
    const centerX = SVG_SIZE / 2;
    const centerY = SVG_SIZE / 2;
    const mappedValue = mapValueToRange(healthValue);
    const radius = calculateDynamicRadius(mappedValue);
    const angle = isLiquidated ? 156 : (mappedValue / 100) * 260 - 220;
    const x = centerX + radius * Math.cos((angle * Math.PI) / 180) + (isLiquidated ? -4 : 0);
    const y = centerY + radius * Math.sin((angle * Math.PI) / 180);
    return { markerX: x, markerY: y };
  }, [healthValue, isLiquidated]);

  return (
    <View style={styles.gaugeContainer}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`-10 -10 ${SVG_SIZE + 20} ${(SVG_SIZE + 20) * 0.75}`}
      >
        {/* Red path (135% - 160%) */}
        <Path
          d="M21.7939 218.748C18.2888 220.422 14.0739 218.943 12.5684 215.362C4.08736 195.191 0.173205 173.361 1.14536 151.442C2.11751 129.524 7.94899 108.126 18.1826 88.7844C19.9991 85.3511 24.3284 84.2514 27.6716 86.229V86.229C31.0147 88.2066 32.1039 92.5122 30.3045 95.9545C21.2365 113.302 16.0676 132.453 15.1977 152.065C14.3279 171.677 17.7809 191.212 25.2775 209.294C26.7651 212.882 25.299 217.074 21.7939 218.748V218.748Z"
          fill={activePath === 'red' ? pathSettings.red.color : '#8e8d90'}
        />
        {/* Yellow path (161% - 200%) */}
        <Path
          d="M30.0049 82.4233C26.7261 80.3408 25.7425 75.9837 27.9784 72.8075C40.574 54.9144 56.9993 40.0117 76.0925 29.2037C95.1857 18.3956 116.417 11.9823 138.24 10.3916C142.114 10.1092 145.344 13.195 145.442 17.078V17.078C145.54 20.961 142.469 24.1691 138.596 24.4708C119.081 25.9912 100.106 31.7739 83.0218 41.4447C65.9377 51.1154 51.2139 64.4087 39.8667 80.3586C37.615 83.5236 33.2838 84.5058 30.0049 82.4233V82.4233Z"
          fill={activePath === 'yellow' ? pathSettings.yellow.color : '#8e8d90'}
        />
        {/* Green path (201% - 300%+) */}
        <Path
          d="M149.5 15.5331C149.5 11.6488 152.651 8.48256 156.531 8.66706C179.269 9.74835 201.486 16.0631 221.436 27.1585C243.437 39.395 261.954 57.0417 275.234 78.4294C288.514 99.8171 296.119 124.239 297.329 149.385C298.426 172.186 294.233 194.9 285.118 215.759C283.563 219.319 279.328 220.738 275.847 219.016V219.016C272.365 217.293 270.958 213.081 272.495 209.514C280.559 190.805 284.261 170.472 283.279 150.061C282.184 127.305 275.302 105.204 263.284 85.8493C251.266 66.4943 234.509 50.5249 214.599 39.4513C196.741 29.5191 176.875 23.82 156.53 22.7508C152.651 22.5469 149.5 19.4174 149.5 15.5331V15.5331Z"
          fill={activePath === 'green' ? pathSettings.green.color : '#8e8d90'}
        />

        {/* Marker */}
        {isHealthFinite && (
          <Circle
            cx={Number.isNaN(markerX) ? 108.16 : markerX}
            cy={Number.isNaN(markerY) ? 13 : markerY}
            r={10.9}
            fill="#111015"
            stroke={markerColor}
            strokeWidth={10.2}
          />
        )}

        {/* Center Title */}
        <SvgText
          x={SVG_SIZE / 2}
          y={SVG_SIZE / 2 - 20}
          textAnchor="middle"
          fill={titleColor}
          fontSize={24}
          fontWeight="500"
          fontFamily="CabinetGrotesk-Medium"
        >
          <TSpan>{currentTitle}</TSpan>
        </SvgText>

        {/* Health Percentage */}
        <SvgText
          x={SVG_SIZE / 2}
          y={SVG_SIZE / 2 + 15}
          textAnchor="middle"
          fill={titleColor}
          fontSize={32}
          fontWeight="600"
          fontFamily="CabinetGrotesk-Bold"
        >
          <TSpan>{isHealthFinite ? `${displayHealthValue}%` : 'N/A'}</TSpan>
        </SvgText>

        {/* Labels */}
        <SvgText x={56} y={212} textAnchor="middle" fill="#ddd" fillOpacity={0.5} fontSize={12}>
          <TSpan>135%</TSpan>
        </SvgText>
        <SvgText x={56} y={98} textAnchor="middle" fill="#ddd" fillOpacity={0.5} fontSize={12}>
          <TSpan>160%</TSpan>
        </SvgText>
        <SvgText x={149} y={40} textAnchor="middle" fill="#ddd" fillOpacity={0.5} fontSize={12}>
          <TSpan>200%</TSpan>
        </SvgText>
        <SvgText x={248} y={212} textAnchor="middle" fill="#ddd" fillOpacity={0.5} fontSize={12}>
          <TSpan>300%</TSpan>
        </SvgText>
      </Svg>

      {/* Chart button - bottom right */}
      {onChartPress && (
        <TouchableOpacity style={styles.chartButton} onPress={onChartPress} activeOpacity={0.7}>
          <Icon name="transaction_history" size={20} color={colors.text.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// =============================================================================
// MOCK COMPONENTS
// =============================================================================

const MockHeader = () => (
  <View style={styles.header}>
    <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
      <Icon name="back" size={24} color={colors.text.primary} />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>Vault</Text>
    <View style={styles.headerSpacer} />
  </View>
);

interface VaultInfoSectionProps {
  healthState: HealthState;
  onChartPress?: () => void;
}

const MockVaultInfoSection = ({ healthState, onChartPress }: VaultInfoSectionProps) => {
  const health = getHealthConfig(healthState);

  return (
    <View style={styles.vaultInfoSection}>
      {/* Gauge with chart button */}
      <VaultGauge healthPercentage={health.percentage} onChartPress={onChartPress} />

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Debt</Text>
          <View style={styles.statValueRow}>
            <Icon name="unit_symbol" size={16} color={colors.text.primary} />
            <Text style={styles.statValue}>2,500.00</Text>
          </View>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Collateral</Text>
          <View style={styles.statValueRow}>
            <Icon name="btc_symbol" size={16} color={colors.text.primary} />
            <Text style={styles.statValue}>0.0542</Text>
          </View>
        </View>
      </View>

      {/* Liquidation Price */}
      <View style={styles.liquidationRow}>
        <Text style={styles.liquidationLabel}>Liquidation Price</Text>
        <Text style={[styles.liquidationValue, { color: health.color }]}>$42,500</Text>
      </View>
    </View>
  );
};

interface ActionButtonsProps {
  scale: number;
  width: number;
}

const MockActionButtons = ({ scale, width }: ActionButtonsProps) => (
  <View style={{ marginHorizontal: spacing.lg, height: 70 * scale, marginBottom: spacing.lg, alignItems: 'center' }}>
    <View style={{
      transform: [{ scale }],
      transformOrigin: 'top center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    }}>
      <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
        <View style={styles.actionButtonIcon}>
          <Text style={styles.actionButtonSymbol}>+</Text>
        </View>
        <Text style={styles.actionButtonLabel}>Deposit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
        <View style={styles.actionButtonIcon}>
          <Icon name="send" size={19} color={colors.bg.primary} />
        </View>
        <Text style={styles.actionButtonLabel}>Borrow</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
        <View style={styles.actionButtonIcon}>
          <Icon name="receive" size={19} color={colors.bg.primary} />
        </View>
        <Text style={styles.actionButtonLabel}>Repay</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
        <View style={styles.actionButtonIcon}>
          <Text style={styles.actionButtonSymbol}>−</Text>
        </View>
        <Text style={styles.actionButtonLabel}>Withdraw</Text>
      </TouchableOpacity>
    </View>
  </View>
);

interface TabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const MockTabs = ({ activeTab, onTabChange }: TabsProps) => (
  <View style={styles.tabsContainer}>
    <TouchableOpacity
      style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
      onPress={() => onTabChange('activity')}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabText, activeTab === 'activity' && styles.tabTextActive]}>
        Activity
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.tab, activeTab === 'about' && styles.tabActive]}
      onPress={() => onTabChange('about')}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabText, activeTab === 'about' && styles.tabTextActive]}>
        About
      </Text>
    </TouchableOpacity>
  </View>
);

const MockActivityList = () => (
  <View style={styles.activityList}>
    <View style={styles.transactionItem}>
      <View style={styles.txIconContainer}>
        <Icon name="vault_logo" size={40} color={colors.text.primary} />
      </View>
      <View style={styles.txContent}>
        <View style={styles.txTopRow}>
          <Text style={styles.txAction}>Borrow</Text>
          <View style={styles.txAmountRow}>
            <Icon name="unit_symbol" size={12} color={colors.semantic.success} />
            <Text style={[styles.txAmount, { color: colors.semantic.success }]}>500.00</Text>
          </View>
        </View>
        <Text style={styles.txDate}>Nov 28, 2024</Text>
      </View>
    </View>

    <View style={styles.transactionItem}>
      <View style={styles.txIconContainer}>
        <Icon name="vault_logo" size={40} color={colors.text.primary} />
      </View>
      <View style={styles.txContent}>
        <View style={styles.txTopRow}>
          <Text style={styles.txAction}>Deposit</Text>
          <View style={styles.txAmountRow}>
            <Icon name="btc_symbol" size={12} color={colors.semantic.success} />
            <Text style={[styles.txAmount, { color: colors.semantic.success }]}>0.01000000</Text>
          </View>
        </View>
        <Text style={styles.txDate}>Nov 26, 2024</Text>
      </View>
    </View>

    <View style={styles.transactionItem}>
      <View style={styles.txIconContainer}>
        <Icon name="vault_logo" size={40} color={colors.text.primary} />
      </View>
      <View style={styles.txContent}>
        <View style={styles.txTopRow}>
          <Text style={styles.txAction}>Open Vault</Text>
          <View style={styles.txAmountRow}>
            <Icon name="unit_symbol" size={12} color={colors.semantic.success} />
            <Text style={[styles.txAmount, { color: colors.semantic.success }]}>2,000.00</Text>
          </View>
        </View>
        <Text style={styles.txDate}>Nov 24, 2024</Text>
      </View>
    </View>
  </View>
);

const MockAboutSection = () => (
  <View style={styles.aboutSection}>
    <Text style={styles.aboutTitle}>What is a Vault?</Text>
    <Text style={styles.aboutText}>
      A vault allows you to deposit BTC as collateral and borrow UNIT stablecoins against it.
      This lets you access liquidity without selling your Bitcoin.
    </Text>
    <Text style={styles.aboutTitle}>Collateral Ratio</Text>
    <Text style={styles.aboutText}>
      Your collateral ratio is the value of your BTC divided by your UNIT debt.
      A higher ratio means your vault is healthier and further from liquidation.
    </Text>
  </View>
);

// =============================================================================
// SCREEN MOCK
// =============================================================================

interface VaultDetailMockProps {
  size?: ScreenSize;
  scale?: number;
  width?: number;
  healthState: HealthState;
  eventCount?: number;
}

const VaultDetailMock = ({
  size = 'L',
  scale = 1,
  width = 393,
  healthState,
  eventCount = 5,
}: VaultDetailMockProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [chartVisible, setChartVisible] = useState(false);
  const health = getHealthConfig(healthState);

  // Generate mock transactions based on event count
  const mockTransactions = useMemo(() => generateMockTransactions(eventCount), [eventCount]);

  // Mock vault values
  const totalDebt = 2500;
  const totalCollateral = 0.0542;
  const currentPrice = 95000;

  return (
    <View style={styles.screenContainer}>
      <ScaledMutinynetBanner size={size} />
      <MockHeader />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <MockVaultInfoSection healthState={healthState} onChartPress={() => setChartVisible(true)} />
        <MockActionButtons scale={scale} width={width} />
        <MockTabs activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === 'activity' ? <MockActivityList /> : <MockAboutSection />}
      </ScrollView>

      {/* Fullscreen chart modal */}
      <FullscreenChart
        visible={chartVisible}
        onClose={() => setChartVisible(false)}
        transactions={mockTransactions}
      />
    </View>
  );
};

// =============================================================================
// STORY WRAPPER
// =============================================================================

interface StoryProps {
  screenSize: ScreenSize;
  healthState: HealthState;
  eventCount: number;
}

const VaultDetailStory = ({ screenSize, healthState, eventCount }: StoryProps) => {
  const config = DEVICE_CONFIGS.find(d => d.size === screenSize) || DEVICE_CONFIGS[3];

  return (
    <View style={styles.storyContainer}>
      {/* Landscape phone frame */}
      <View style={[styles.phoneFrame, styles.phoneFrameLandscape, { width: phoneFrame.height, height: config.width }]}>
        {/* Rotate content -90° so it displays correctly in landscape */}
        <View style={[styles.landscapeContent, { width: config.width, height: phoneFrame.height }]}>
          <VaultDetailMock
            size={config.size}
            scale={config.scale}
            width={config.width}
            healthState={healthState}
            eventCount={eventCount}
          />
        </View>
      </View>
    </View>
  );
};

// =============================================================================
// OVERVIEW COMPONENT
// =============================================================================

interface OverviewProps {
  healthState: HealthState;
  eventCount: number;
}

const VaultDetailOverview = ({ healthState, eventCount }: OverviewProps) => (
  <ScrollView style={styles.overviewContainer} contentContainerStyle={styles.overviewContent}>
    {DEVICE_CONFIGS.map((config) => (
      <View key={config.size} style={styles.deviceRow}>
        <View style={styles.deviceLabel}>
          <Text style={styles.deviceSize}>{config.size}</Text>
          <Text style={styles.deviceName}>{config.label}</Text>
          <Text style={styles.deviceWidth}>{config.width}px</Text>
        </View>
        <View style={[styles.phoneFrame, { width: config.width }]}>
          <VaultDetailMock
            size={config.size}
            scale={config.scale}
            width={config.width}
            healthState={healthState}
            eventCount={eventCount}
          />
        </View>
      </View>
    ))}
  </ScrollView>
);

// =============================================================================
// STORYBOOK META
// =============================================================================

const meta: Meta = {
  title: 'Screens/VaultInfo Page',
  parameters: {
    notes: 'Vault detail screen with semicircular gauge and organized stats.',
  },
};

export default meta;
// =============================================================================
// STORIES
// =============================================================================

export const Interactive: StoryObj<StoryProps> = {
  render: (args) => <VaultDetailStory {...args} />,
  args: {
    screenSize: 'L',
    healthState: 'healthy',
    eventCount: 5,
  },
  argTypes: {
    screenSize: {
      control: { type: 'select' },
      options: ['XS', 'S', 'M', 'L', 'XL'],
      description: 'Device screen size',
    },
    healthState: {
      control: { type: 'select' },
      options: ['healthy', 'warning', 'danger'],
      description: 'Vault health status',
    },
    eventCount: {
      control: { type: 'range', min: 1, max: 15, step: 1 },
      description: 'Number of vault events (transactions)',
    },
  },
};

export const Overview: StoryObj<OverviewProps> = {
  render: (args) => <VaultDetailOverview {...args} />,
  args: {
    healthState: 'healthy',
    eventCount: 5,
  },
  argTypes: {
    healthState: {
      control: { type: 'select' },
      options: ['healthy', 'warning', 'danger'],
      description: 'Vault health status',
    },
    eventCount: {
      control: { type: 'range', min: 1, max: 15, step: 1 },
      description: 'Number of vault events (transactions)',
    },
  },
};

// =============================================================================
// STYLES (24px margins)
// =============================================================================

const styles = StyleSheet.create({
  // Story Container
  storyContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Phone Frame
  phoneFrame: {
    backgroundColor: colors.bg.primary,
    borderRadius: phoneFrame.borderRadius,
    borderWidth: phoneFrame.borderWidth,
    borderColor: phoneFrame.borderColor,
    overflow: phoneFrame.overflow,
    height: phoneFrame.height,
  },
  phoneFrameLandscape: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  landscapeContent: {
    transform: [{ rotate: '-90deg' }],
  },

  // Mutinynet Banner
  mutinynetBanner: {
    backgroundColor: mutinynetBanner.backgroundColor,
    alignItems: 'center',
    width: '100%',
  },
  mutinynetBannerText: {
    color: mutinynetBanner.text.color,
    fontWeight: mutinynetBanner.text.fontWeight,
    fontFamily: fonts.medium,
  },

  // Screen Container
  screenContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.bg.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },

  // Vault Info Section
  vaultInfoSection: {
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  // Gauge Container
  gaugeContainer: {
    width: '100%',
    aspectRatio: 1.5,
    marginBottom: spacing.md,
    position: 'relative',
  },

  // Chart Button (top right of gauge)
  chartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Fullscreen Chart Modal
  fullscreenChartContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  chartCloseButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  chartLandscapeWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  chartHealthChip: {
    position: 'absolute',
    top: -10,
    right: 24,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 10,
  },
  chartHealthChipText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
  chartTimeframeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  chartTimeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'transparent',
    minWidth: 60,
    alignItems: 'center',
  },
  chartTimeframeButtonActive: {
    backgroundColor: colors.bg.tertiary,
  },
  chartTimeframeText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
  chartTimeframeTextActive: {
    color: colors.text.primary,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  statLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.default,
  },

  // Liquidation Row
  liquidationRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  liquidationLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  liquidationValue: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
  },

  // Action Buttons
  actionButton: {
    alignItems: 'center',
  },
  actionButtonIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.text.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionButtonLabel: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  actionButtonSymbol: {
    fontSize: 24,
    fontWeight: fontWeights.medium,
    color: colors.bg.primary,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.brand.primary,
  },
  tabText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: fontWeights.semibold,
  },

  // Activity List
  activityList: {
    marginHorizontal: spacing.lg,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  txIconContainer: {
    marginRight: spacing.sm,
  },
  txContent: {
    flex: 1,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  txAction: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  txAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txAmount: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
  },
  txDate: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },

  // About Section
  aboutSection: {
    marginHorizontal: spacing.lg,
  },
  aboutTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  aboutText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  // Overview Container
  overviewContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  overviewContent: {
    padding: spacing.lg,
    gap: spacing.xxl,
    alignItems: 'center',
  },

  // Device Row
  deviceRow: {
    alignItems: 'center',
  },

  // Device Label
  deviceLabel: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  deviceSize: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  deviceName: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  deviceWidth: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
