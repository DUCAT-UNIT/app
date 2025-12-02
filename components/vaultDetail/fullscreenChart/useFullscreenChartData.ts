/**
 * useFullscreenChartData Hook
 * Fetches BTC prices and computes chart data for fullscreen view
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API, API_KEYS } from '../../../utils/constants';
import { logger } from '../../../utils/logger';
import type { VaultHistoryTransaction } from '../../../services/vaultService';
import type { BitcoinData, PriceTimeframe, SeriesItem, ReferenceLine } from '../vaultChart/types';
import { transformToEvents, createEventSeries } from '../vaultChart/utils';
import { CACHE_KEY_PREFIX, CACHE_EXPIRY_MS, LEFT_MARGIN, RIGHT_MARGIN, LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT, CHART_PADDING } from './constants';

interface UseFullscreenChartDataReturn {
  loading: boolean;
  series: SeriesItem[];
  referenceLines: ReferenceLine[];
  lineData: Array<SeriesItem & { healthValue: number }>;
  lineSegments: string[];
  areaPath: string;
  yDomain: [number, number];
  chartWidth: number;
  chartHeight: number;
  drawWidth: number;
  drawHeight: number;
  xScale: (timestamp: number) => number;
  yScale: (value: number) => number;
  getHealthAtX: (x: number) => number | null;
  findNearbyRefLine: (x: number) => number | null;
}

export function useFullscreenChartData(
  visible: boolean,
  selectedTimeframe: PriceTimeframe,
  transactions: VaultHistoryTransaction[]
): UseFullscreenChartDataReturn {
  const [btcPrices, setBtcPrices] = useState<BitcoinData[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Chart dimensions
  const chartWidth = LANDSCAPE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
  const chartHeight = LANDSCAPE_HEIGHT;
  const drawWidth = chartWidth - CHART_PADDING.left - CHART_PADDING.right;
  const drawHeight = chartHeight - CHART_PADDING.top - CHART_PADDING.bottom;

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
      } catch (err) {
        logger.debug('Failed to read price cache', { error: err instanceof Error ? err.message : String(err) });
      }

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
            })).catch((err) => logger.debug('Failed to cache prices', { error: err instanceof Error ? err.message : String(err) }));
          }
        }
      } catch (err) {
        logger.debug('Failed to fetch BTC prices', { error: err instanceof Error ? err.message : String(err) });
      }

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
    const events = transformToEvents(transactions);
    return createEventSeries(btcPrices, events, selectedTimeframe, transactions);
  }, [btcPrices, selectedTimeframe, transactions]);

  const lineData = useMemo(() => {
    return series.filter(s => s.healthValue !== null) as Array<SeriesItem & { healthValue: number }>;
  }, [series]);

  // Y domain
  const yDomain = useMemo((): [number, number] => {
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
    if (!series.length) return CHART_PADDING.left;
    const minX = series[0].date;
    const maxX = series[series.length - 1].date;
    const range = maxX - minX || 1;
    return CHART_PADDING.left + ((timestamp - minX) / range) * drawWidth;
  }, [series, drawWidth]);

  const yScale = useCallback((value: number) => {
    const [minY, maxY] = yDomain;
    const range = maxY - minY || 1;
    return CHART_PADDING.top + drawHeight - ((value - minY) / range) * drawHeight;
  }, [yDomain, drawHeight]);

  // Generate line segments
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

  // Generate area path
  const areaPath = useMemo(() => {
    if (lineData.length === 0) return '';
    const bottomY = chartHeight;
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
  }, [lineData, xScale, yScale, chartWidth, chartHeight, referenceLines]);

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

  // Find nearby reference line
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

  return {
    loading,
    series,
    referenceLines,
    lineData,
    lineSegments,
    areaPath,
    yDomain,
    chartWidth,
    chartHeight,
    drawWidth,
    drawHeight,
    xScale,
    yScale,
    getHealthAtX,
    findNearbyRefLine,
  };
}
