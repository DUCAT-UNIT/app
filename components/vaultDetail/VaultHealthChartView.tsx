/**
 * VaultHealthChartView Component
 * Replicates frontend vault-chart implementation for React Native
 * Shows vault health ratio over time with event markers
 */

import React, { useMemo, useState, useCallback, useEffect, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, PanResponder, GestureResponderEvent } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../theme';
import { API, API_KEYS } from '../../utils/constants';
import { VaultChartSkeleton } from './VaultSkeleton';
import type { VaultHistoryTransaction } from '../../services/vaultService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

interface VaultEvent {
  amount: number;       // UNIT borrowed (converted)
  type: string;
  date: string;         // ISO string
  btcWallet: number;    // BTC in vault (converted)
  oraclePrice: number;
}

interface SeriesItem {
  date: number;
  healthValue: number | null;
  eventType?: string;
  isEventPoint?: boolean;
  prevValue?: number | null;
}

interface ReferenceLine {
  date: number;
  txTimestamp: number; // Actual transaction timestamp for filtering
  prevValue: number;
  newValue: number;
  eventType: string;
  btcWallet?: number;
  amount?: number;
}

// Transform transactions to events
function transformToEvents(transactions: VaultHistoryTransaction[]): VaultEvent[] {
  const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

  return sorted.map(tx => ({
    amount: tx.amount_borrowed / 100,
    type: tx.action.toLowerCase() === 'open' ? 'create' : tx.action.toLowerCase(),
    date: new Date(tx.timestamp * 1000).toISOString(),
    btcWallet: tx.vault_amount / 100_000_000,
    oraclePrice: tx.oracle_price,
  }));
}

// Interval configuration matching frontend
const INTERVAL_CONFIG: Record<PriceTimeframe, { unitLength: number; numberOfUnits: number }> = {
  '1D': { unitLength: 5 * 60, numberOfUnits: 288 },        // 5 min buckets, 288 total
  '1W': { unitLength: 1 * 60 * 60, numberOfUnits: 168 },   // 1 hour buckets, 168 total
  '1M': { unitLength: 6 * 60 * 60, numberOfUnits: 120 },   // 6 hour buckets, 120 total
  '1Y': { unitLength: 24 * 60 * 60, numberOfUnits: 365 },  // 1 day buckets, 365 total
};

// Binary search for closest BTC price by timestamp (in seconds)
function getBitcoinPriceByTimestamp(bitcoinData: BitcoinData[], targetTimestamp: number): number {
  if (bitcoinData.length === 0) return 50000; // fallback

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

  // Find closest between left and right
  if (left >= bitcoinData.length) {
    return parseFloat(bitcoinData[right].price);
  }
  if (right < 0) {
    return parseFloat(bitcoinData[left].price);
  }

  const leftDiff = Math.abs(bitcoinData[left].timestamp - targetTimestamp);
  const rightDiff = Math.abs(bitcoinData[right].timestamp - targetTimestamp);

  return parseFloat(leftDiff < rightDiff ? bitcoinData[left].price : bitcoinData[right].price);
}

// Get closest transaction before a timestamp (transactions sorted descending by timestamp)
function getClosestTransactionBefore(
  transactions: VaultHistoryTransaction[],
  timestamp: number
): VaultHistoryTransaction | undefined {
  for (const tx of transactions) {
    if (tx.timestamp <= timestamp) {
      return tx;
    }
  }
  return undefined;
}

// Get transactions between two timestamps (transactions sorted descending by timestamp)
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
      break; // Since sorted descending, we can stop early
    }
  }

  return result;
}

// Compute health percentage from transaction
function computeHealthPercent(tx: VaultHistoryTransaction, btcPrice: number): number {
  const { vault_amount, amount_borrowed } = tx;
  const value = Math.floor((((vault_amount / 100_000_000) * btcPrice) / (amount_borrowed / 100)) * 100);
  return Math.min(value, 500);
}

// Create series data following frontend time-bucketed approach
function createEventSeries(
  bitcoinData: BitcoinData[],
  _events: VaultEvent[],
  interval: PriceTimeframe,
  transactions: VaultHistoryTransaction[]
): { series: SeriesItem[]; referenceLines: ReferenceLine[] } {
  if (!bitcoinData.length || !transactions.length) {
    return { series: [], referenceLines: [] };
  }

  const { unitLength, numberOfUnits } = INTERVAL_CONFIG[interval];
  const referenceLines: ReferenceLine[] = [];

  // Sort transactions descending (latest first) as expected by helper functions
  const sortedTxsDesc = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
  // Sort bitcoin data ascending for binary search
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

    // Calculate health values
    const healthBefore = txBefore ? computeHealthPercent(txBefore, btcPrice) : null;
    // If there are transactions in this bucket, use the oldest one (last in the array since sorted desc)
    const healthAfter = txsBetween.length > 0
      ? computeHealthPercent(txsBetween[txsBetween.length - 1], btcPrice)
      : healthBefore;

    // Add reference line if there's an event in this bucket
    if (txsBetween.length > 0) {
      const eventTx = txsBetween[txsBetween.length - 1]; // oldest tx in bucket
      referenceLines.push({
        date: bucketEnd * 1000, // For chart positioning
        txTimestamp: eventTx.timestamp * 1000, // Actual tx timestamp for filtering
        prevValue: Math.max(healthBefore || 125, 125),
        newValue: Math.max(healthAfter || 125, 125),
        eventType: eventTx.action.toLowerCase() === 'open' ? 'create' : eventTx.action.toLowerCase(),
        btcWallet: eventTx.vault_amount / 100_000_000,
        amount: eventTx.amount_borrowed / 100,
      });
    }

    series.push({
      date: bucketEnd * 1000,
      healthValue: healthAfter,
      eventType: txsBetween.length > 0
        ? (txsBetween[0].action.toLowerCase() === 'open' ? 'create' : txsBetween[0].action.toLowerCase())
        : undefined,
      isEventPoint: txsBetween.length > 0,
    });
  }

  return { series, referenceLines };
}

// Chart component
interface VaultHealthChartViewProps {
  transactions: VaultHistoryTransaction[];
  onHighlightEvent?: (eventDate: number | null) => void;
  onLockFilter?: (eventDate: number | null) => void;
  onScrollEnable?: (enabled: boolean) => void;
  highlightedEventDate?: number | null;
  totalDebt?: number;
  totalCollateral?: number;
  currentPrice?: number;
}

export const VaultHealthChartView = memo(function VaultHealthChartView({
  transactions,
  onHighlightEvent,
  onLockFilter,
  onScrollEnable,
  highlightedEventDate,
  totalDebt = 0,
  totalCollateral = 0,
  currentPrice = 0,
}: VaultHealthChartViewProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<PriceTimeframe>('1D');
  const [btcPrices, setBtcPrices] = useState<BitcoinData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrubData, setScrubData] = useState<{ health: number | null; x: number | null }>({ health: null, x: null });
  const [hoveredRefLineIndex, setHoveredRefLineIndex] = useState<number | null>(null);
  const [lockedRefLineIndex, setLockedRefLineIndex] = useState<number | null>(null);
  const [lockedScrubData, setLockedScrubData] = useState<{ health: number | null; x: number | null }>({ health: null, x: null });

  // Clear locked state when parent clears the highlight (e.g., from VaultTabs clear button)
  useEffect(() => {
    if (highlightedEventDate === null && lockedRefLineIndex !== null) {
      setLockedRefLineIndex(null);
      setLockedScrubData({ health: null, x: null });
    }
  }, [highlightedEventDate, lockedRefLineIndex]);

  // Convert transactions to events
  const vaultEvents = useMemo(() => {
    if (!transactions.length) return [];
    return transformToEvents(transactions);
  }, [transactions]);

  // Fetch BTC price history
  useEffect(() => {
    if (!transactions.length) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchPrices = async () => {
      const days = selectedTimeframe === '1D' ? 1 :
                   selectedTimeframe === '1W' ? 7 :
                   selectedTimeframe === '1M' ? 30 : 365;

      const cacheKey = `${CACHE_KEY_PREFIX}${selectedTimeframe}`;

      // Check cache
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

      // Fetch from API
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
            // Sample for performance
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
  }, [selectedTimeframe, transactions.length]);

  // Background preload other timeframes after initial load
  useEffect(() => {
    if (!transactions.length || loading) return;

    const preloadTimeframes = async () => {
      const allTimeframes: PriceTimeframe[] = ['1W', '1M', '1Y'];
      const timeframesToPreload = allTimeframes.filter(tf => tf !== selectedTimeframe);

      for (const tf of timeframesToPreload) {
        const days = tf === '1W' ? 7 : tf === '1M' ? 30 : 365;
        const cacheKey = `${CACHE_KEY_PREFIX}${tf}`;

        // Check if already cached
        try {
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            const { timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
              continue; // Already cached and valid
            }
          }
        } catch {}

        // Fetch and cache in background
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

          if (response.ok) {
            const data = await response.json();
            if (data.prices?.length) {
              const sampled = data.prices.length > 150
                ? data.prices.filter((_: [number, number], i: number) =>
                    i % Math.ceil(data.prices.length / 150) === 0)
                : data.prices;

              await AsyncStorage.setItem(cacheKey, JSON.stringify({
                prices: sampled,
                timestamp: Date.now()
              }));
            }
          }
        } catch {}

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };

    // Delay preloading to not interfere with initial render
    const timeoutId = setTimeout(preloadTimeframes, 2000);
    return () => clearTimeout(timeoutId);
  }, [transactions.length, loading, selectedTimeframe]);

  // Generate chart data
  const { series, referenceLines } = useMemo(() => {
    if (!btcPrices || !transactions.length) {
      return { series: [], referenceLines: [] };
    }
    return createEventSeries(btcPrices, vaultEvents, selectedTimeframe, transactions);
  }, [btcPrices, vaultEvents, selectedTimeframe, transactions]);

  // Filter series to only include points with health values for drawing the line
  const lineData = useMemo(() => {
    return series.filter(s => s.healthValue !== null) as Array<SeriesItem & { healthValue: number }>;
  }, [series]);

  // Chart dimensions - full width, reduced height, minimal padding
  const chartWidth = SCREEN_WIDTH;
  const chartHeight = 140;
  const padding = { top: 25, right: 0, bottom: 15, left: 0 };
  const drawWidth = chartWidth - padding.left - padding.right;
  const drawHeight = chartHeight - padding.top - padding.bottom;

  // Calculate Y domain - always include 135 (liquidation line) for consistent reference
  const yDomain = useMemo(() => {
    if (!lineData.length) return [125, 350];
    const values = lineData.map(d => d.healthValue);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);

    // Always include 135 (liquidation threshold) and some room below it
    // Min should show liquidation zone context (125-135 is danger zone)
    const min = 125;

    // Max should accommodate the highest data point plus 10% headroom
    const headroom = (dataMax - min) * 0.1;
    const max = Math.max(dataMax + headroom, 250); // At least show up to 250%

    return [min, max];
  }, [lineData]);

  // Scale functions - use full series range for consistent time window
  const xScale = useCallback((timestamp: number) => {
    if (!series.length) return padding.left;
    const minX = series[0].date;
    const maxX = series[series.length - 1].date;
    const range = maxX - minX || 1;
    // Full width - no padding
    return padding.left + ((timestamp - minX) / range) * drawWidth;
  }, [series, drawWidth, padding.left]);

  const yScale = useCallback((value: number) => {
    const [minY, maxY] = yDomain;
    const range = maxY - minY || 1;
    return padding.top + drawHeight - ((value - minY) / range) * drawHeight;
  }, [yDomain, drawHeight, padding.top]);

  // Generate segmented line paths - each segment stops at event points
  // Line A ends at event X position (prevValue), Line B starts at same X (newValue)
  const lineSegments = useMemo(() => {
    if (lineData.length === 0) return [];

    // If only one point, draw a short horizontal line
    if (lineData.length === 1) {
      const x = xScale(lineData[0].date);
      const y = yScale(lineData[0].healthValue);
      return [`M ${x - 10} ${y} L ${x + 10} ${y}`];
    }

    // Create a map of event timestamps to their reference line data
    const eventMap = new Map<number, { prevValue: number; newValue: number }>();
    for (const rl of referenceLines) {
      eventMap.set(rl.date, { prevValue: rl.prevValue, newValue: rl.newValue });
    }

    const segments: string[] = [];
    let currentSegment = '';

    for (let i = 0; i < lineData.length; i++) {
      const x = xScale(lineData[i].date);
      const y = yScale(lineData[i].healthValue);
      const eventData = eventMap.get(lineData[i].date);

      if (eventData) {
        // This is an event point
        // End current segment at the PREVIOUS value (top of the vertical line)
        const prevY = yScale(eventData.prevValue);
        if (currentSegment === '') {
          currentSegment = `M ${x} ${prevY}`;
        } else {
          currentSegment += ` L ${x} ${prevY}`;
        }
        segments.push(currentSegment);

        // Start new segment at the NEW value (bottom of the vertical line) at SAME X
        const newY = yScale(eventData.newValue);
        currentSegment = `M ${x} ${newY}`;
      } else {
        // Regular point
        if (currentSegment === '') {
          currentSegment = `M ${x} ${y}`;
        } else {
          currentSegment += ` L ${x} ${y}`;
        }
      }
    }

    // Push final segment if exists
    if (currentSegment !== '') {
      segments.push(currentSegment);
    }

    return segments;
  }, [lineData, xScale, yScale, referenceLines]);

  // Generate area path - starts from first data point, not edge
  const areaPath = useMemo(() => {
    if (lineData.length === 0) return '';

    const bottomY = padding.top + drawHeight;

    // If only one point, create a small triangular area
    if (lineData.length === 1) {
      const x = xScale(lineData[0].date);
      const y = yScale(lineData[0].healthValue);
      return `M ${x - 10} ${bottomY} L ${x - 10} ${y} L ${x + 10} ${y} L ${x + 10} ${bottomY} Z`;
    }

    const firstX = xScale(lineData[0].date);
    const lastX = xScale(lineData[lineData.length - 1].date);

    let path = `M ${firstX} ${bottomY}`;
    path += ` L ${firstX} ${yScale(lineData[0].healthValue)}`;

    for (let i = 1; i < lineData.length; i++) {
      path += ` L ${xScale(lineData[i].date)} ${yScale(lineData[i].healthValue)}`;
    }

    path += ` L ${lastX} ${bottomY}`;
    path += ' Z';

    return path;
  }, [lineData, xScale, yScale, padding, drawHeight]);

  // Get health at X position - interpolate based on actual line path
  // Returns null if scrubbing in area with no vault data
  const getHealthAtX = useCallback((x: number): number | null => {
    if (!lineData.length || !series.length) return null;

    // Convert X position back to timestamp using series range (full time window)
    const clampedX = Math.max(padding.left, Math.min(x, padding.left + drawWidth));
    const ratio = (clampedX - padding.left) / drawWidth;

    const minTime = series[0].date;
    const maxTime = series[series.length - 1].date;
    const targetTime = minTime + ratio * (maxTime - minTime);

    // Find the series point at this time and check if it has a health value
    // Use the series (which may have null values) to determine if we're in vault area
    let seriesIdx = 0;
    for (let i = 0; i < series.length - 1; i++) {
      if (series[i].date <= targetTime && series[i + 1].date >= targetTime) {
        seriesIdx = i;
        break;
      }
    }

    // If the current series point has null health, return null (pre-vault area)
    if (series[seriesIdx].healthValue === null) {
      return null;
    }

    // Now interpolate using lineData (non-null health values only)
    if (lineData.length === 1) return lineData[0].healthValue;

    // Find the two lineData points that bracket this timestamp
    let beforeIdx = 0;
    let afterIdx = lineData.length - 1;

    for (let i = 0; i < lineData.length - 1; i++) {
      if (lineData[i].date <= targetTime && lineData[i + 1].date >= targetTime) {
        beforeIdx = i;
        afterIdx = i + 1;
        break;
      }
    }

    // If target is before all data, return first value
    if (targetTime <= lineData[0].date) {
      return lineData[0].healthValue;
    }

    // If target is after all data, return last value
    if (targetTime >= lineData[lineData.length - 1].date) {
      return lineData[lineData.length - 1].healthValue;
    }

    // Interpolate between the two bracketing points
    const beforePoint = lineData[beforeIdx];
    const afterPoint = lineData[afterIdx];
    const timeFraction = (targetTime - beforePoint.date) / (afterPoint.date - beforePoint.date || 1);
    const interpolatedHealth = beforePoint.healthValue + timeFraction * (afterPoint.healthValue - beforePoint.healthValue);

    return interpolatedHealth;
  }, [lineData, series, padding.left, drawWidth]);

  // Find which reference line is exactly at the current X position (within 5px tolerance)
  const findNearbyRefLine = useCallback((x: number): number | null => {
    if (!referenceLines.length) return null;

    const tolerance = 5; // 5 pixels tolerance

    for (let i = 0; i < referenceLines.length; i++) {
      const refLineX = xScale(referenceLines[i].date);
      if (Math.abs(x - refLineX) <= tolerance) {
        return i;
      }
    }

    return null;
  }, [referenceLines, xScale]);

  // Reset locked state
  const handleReset = useCallback(() => {
    setLockedRefLineIndex(null);
    setLockedScrubData({ health: null, x: null });
    onHighlightEvent?.(null);
  }, [onHighlightEvent]);

  // Pan responder for scrubbing
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt: GestureResponderEvent) => {
      // Disable parent scroll while scrubbing
      onScrollEnable?.(false);

      // DON'T clear the lock/filter on grant - only clear when locking to a new ref line
      // The visual lock state is cleared for scrubbing, but filter stays until new lock
      setLockedRefLineIndex(null);
      setLockedScrubData({ health: null, x: null });

      const x = evt.nativeEvent.locationX;
      setScrubData({ health: getHealthAtX(x), x });
      const refLineIdx = findNearbyRefLine(x);
      setHoveredRefLineIndex(refLineIdx);
      // Notify parent about which event is highlighted (real-time for chart)
      if (refLineIdx !== null && referenceLines[refLineIdx]) {
        onHighlightEvent?.(referenceLines[refLineIdx].date);
      } else {
        onHighlightEvent?.(null);
      }
    },
    onPanResponderMove: (evt: GestureResponderEvent) => {
      const x = evt.nativeEvent.locationX;
      setScrubData({ health: getHealthAtX(x), x });
      const refLineIdx = findNearbyRefLine(x);
      setHoveredRefLineIndex(refLineIdx);
      // Notify parent about which event is highlighted (real-time, no filter yet)
      if (refLineIdx !== null && referenceLines[refLineIdx]) {
        onHighlightEvent?.(referenceLines[refLineIdx].date);
      } else {
        onHighlightEvent?.(null);
      }
    },
    onPanResponderRelease: () => {
      // Re-enable parent scroll
      onScrollEnable?.(true);

      // If we were on a reference line, lock it at the exact center of the reference line
      if (hoveredRefLineIndex !== null && referenceLines[hoveredRefLineIndex]) {
        const refLine = referenceLines[hoveredRefLineIndex];
        const exactX = xScale(refLine.date);
        // Use the newValue (post-event health) for the locked position
        setLockedRefLineIndex(hoveredRefLineIndex);
        setLockedScrubData({ health: refLine.newValue, x: exactX });
        // Keep the highlight active (use date for chart)
        onHighlightEvent?.(refLine.date);
        // Apply filter using actual tx timestamp (for matching with activity list)
        onLockFilter?.(refLine.txTimestamp);
      }
      setScrubData({ health: null, x: null });
      setHoveredRefLineIndex(null);
    },
    onPanResponderTerminate: () => {
      // Re-enable parent scroll
      onScrollEnable?.(true);

      // If we were on a reference line, lock it at the exact center
      if (hoveredRefLineIndex !== null && referenceLines[hoveredRefLineIndex]) {
        const refLine = referenceLines[hoveredRefLineIndex];
        const exactX = xScale(refLine.date);
        setLockedRefLineIndex(hoveredRefLineIndex);
        setLockedScrubData({ health: refLine.newValue, x: exactX });
        onHighlightEvent?.(refLine.date);
        // Apply filter using actual tx timestamp (for matching with activity list)
        onLockFilter?.(refLine.txTimestamp);
      }
      setScrubData({ health: null, x: null });
      setHoveredRefLineIndex(null);
    },
  }), [getHealthAtX, findNearbyRefLine, referenceLines, onHighlightEvent, onLockFilter, onScrollEnable, hoveredRefLineIndex, lockedRefLineIndex, xScale]);

  // Is there a locked or active reference line?
  const activeRefLineIndex = hoveredRefLineIndex ?? lockedRefLineIndex;

  // Get the active reference line data for displaying "X% → Y%"
  const activeRefLine = activeRefLineIndex !== null ? referenceLines[activeRefLineIndex] : null;

  // Current display health - prioritize active scrub, then locked state, then latest
  const displayHealth = scrubData.health ?? lockedScrubData.health ?? (lineData.length > 0 ? lineData[lineData.length - 1].healthValue : null);

  // Active scrub position or locked position
  const activeScrubX = scrubData.x ?? lockedScrubData.x;
  const activeScrubHealth = scrubData.health ?? lockedScrubData.health;

  // Health color
  const healthColor = useMemo(() => {
    if (!displayHealth) return COLORS.SECONDARY_TEXT;
    if (displayHealth <= 160) return '#d04c68';
    if (displayHealth <= 200) return '#fde37b';
    return '#59aa8a';
  }, [displayHealth]);

  // Health chip background with 10% opacity
  const healthChipBg = useMemo(() => {
    if (!displayHealth) return 'rgba(128, 128, 128, 0.1)';
    if (displayHealth <= 160) return 'rgba(208, 76, 104, 0.1)';
    if (displayHealth <= 200) return 'rgba(253, 227, 123, 0.1)';
    return 'rgba(89, 170, 138, 0.1)';
  }, [displayHealth]);

  // Loading state - show skeleton
  if (loading) {
    return <VaultChartSkeleton />;
  }

  // Empty state - no data available
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
              <Text style={[styles.timeframeText, selectedTimeframe === tf && styles.timeframeTextActive]}>
                {tf}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Health display chip - shows "X% → Y%" when on a reference line */}
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
            {/* Area fill gradient - matches health colors with transparency */}
            <LinearGradient
              id="areaGradient"
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
            {/* Event gradient - Green at 200%+, Yellow at 160-200%, Red below 160% */}
            <LinearGradient
              id="eventGradient"
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
          <Path
            d={areaPath}
            fill="url(#areaGradient)"
          />

          {/* Main line segments - gradient colored, stops at each event */}
          {lineSegments.map((segment, i) => (
            <Path
              key={i}
              d={segment}
              stroke="url(#eventGradient)"
              strokeWidth={2}
              fill="none"
            />
          ))}

          {/* Reference lines for events (vertical jumps) - gradient colored, thicker when active */}
          {referenceLines.map((line, i) => {
            const isActive = hoveredRefLineIndex === i || lockedRefLineIndex === i;
            return (
              <Line
                key={i}
                x1={xScale(line.date)}
                x2={xScale(line.date)}
                y1={yScale(line.prevValue)}
                y2={yScale(line.newValue)}
                stroke="url(#eventGradient)"
                strokeWidth={isActive ? 3 : 2}
                strokeLinecap="round"
              />
            );
          })}

          {/* Locked Scrubber - show when there's a locked state and not actively scrubbing */}
          {lockedScrubData.x !== null && scrubData.x === null && (() => {
            const ballY = yScale(lockedScrubData.health || 0);
            return (
              <G>
                <Line
                  x1={lockedScrubData.x}
                  x2={lockedScrubData.x}
                  y1={ballY + 6}
                  y2={chartHeight - padding.bottom}
                  stroke={healthColor}
                  strokeWidth={1}
                />
                <Circle
                  cx={lockedScrubData.x}
                  cy={ballY}
                  r={6}
                  fill={healthColor}
                />
                <Circle
                  cx={lockedScrubData.x}
                  cy={ballY}
                  r={3}
                  fill="#fff"
                />
              </G>
            );
          })()}

          {/* Active Scrubber */}
          {scrubData.x !== null && (() => {
            const ballY = yScale(scrubData.health || 0);
            return (
              <G>
                <Line
                  x1={scrubData.x}
                  x2={scrubData.x}
                  y1={ballY + 6}
                  y2={chartHeight - padding.bottom}
                  stroke={healthColor}
                  strokeWidth={1}
                />
                <Circle
                  cx={scrubData.x}
                  cy={ballY}
                  r={6}
                  fill={healthColor}
                />
                <Circle
                  cx={scrubData.x}
                  cy={ballY}
                  r={3}
                  fill="#fff"
                />
              </G>
            );
          })()}
        </Svg>
      </View>

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
              onHighlightEvent?.(null);
              onLockFilter?.(null);
            }}
          >
            <Text style={[styles.timeframeText, selectedTimeframe === tf && styles.timeframeTextActive]}>
              {tf}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    width: '100%',
    minHeight: 200, // Fixed height to prevent layout jumping
    marginHorizontal: -16, // Extend chart to full width
    paddingHorizontal: 0,
  },
  chartWrapper: {
    position: 'relative',
    width: '100%',
  },
  healthChip: {
    position: 'absolute',
    top: -10,
    right: -10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 10,
  },
  healthChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
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
    backgroundColor: COLORS.VERY_DARK_GRAY,
  },
  timeframeText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    fontWeight: '700',
  },
  timeframeTextActive: {
    color: '#fff',
  },
});

export default VaultHealthChartView;
