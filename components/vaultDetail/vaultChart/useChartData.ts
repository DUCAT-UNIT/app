/**
 * useChartData Hook
 * Computes chart series, paths, and scaling functions
 */

import { useMemo, useCallback } from 'react';
import { Dimensions } from 'react-native';
import type { VaultHistoryTransaction } from '../../../services/vaultService';
import type { BitcoinData, SeriesItem, ReferenceLine, PriceTimeframe, ChartDimensions } from './types';
import { createEventSeries, transformToEvents } from './utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UseChartDataResult {
  vaultEvents: ReturnType<typeof transformToEvents>;
  series: SeriesItem[];
  referenceLines: ReferenceLine[];
  lineData: Array<SeriesItem & { healthValue: number }>;
  lineSegments: string[];
  areaPath: string;
  yDomain: [number, number];
  dimensions: ChartDimensions;
  xScale: (timestamp: number) => number;
  yScale: (value: number) => number;
}

/**
 * Hook to compute all chart data and scaling functions
 */
export function useChartData(
  transactions: VaultHistoryTransaction[],
  btcPrices: BitcoinData[] | null,
  selectedTimeframe: PriceTimeframe
): UseChartDataResult {
  // Chart dimensions
  const dimensions = useMemo<ChartDimensions>(() => {
    const chartWidth = SCREEN_WIDTH;
    const chartHeight = 140;
    // Padding includes 6px for scrubber circle radius
    const padding = { top: 25, right: 6, bottom: 15, left: 6 };
    return {
      chartWidth,
      chartHeight,
      padding,
      drawWidth: chartWidth - padding.left - padding.right,
      drawHeight: chartHeight - padding.top - padding.bottom,
    };
  }, []);

  // Convert transactions to events
  const vaultEvents = useMemo(() => {
    if (!transactions.length) return [];
    return transformToEvents(transactions);
  }, [transactions]);

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

  // Calculate Y domain - always include 135 (liquidation line) for consistent reference
  const yDomain = useMemo<[number, number]>(() => {
    if (!lineData.length) return [125, 350];
    const values = lineData.map(d => d.healthValue);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);

    // Always include 135 (liquidation threshold) and some room below it
    const min = 125;

    // Max should accommodate the highest data point plus 10% headroom
    const headroom = (dataMax - min) * 0.1;
    const max = Math.max(dataMax + headroom, 250);

    return [min, max];
  }, [lineData]);

  // Scale functions
  const xScale = useCallback((timestamp: number) => {
    if (!series.length) return dimensions.padding.left;
    const minX = series[0].date;
    const maxX = series[series.length - 1].date;
    const range = maxX - minX || 1;
    return dimensions.padding.left + ((timestamp - minX) / range) * dimensions.drawWidth;
  }, [series, dimensions]);

  const yScale = useCallback((value: number) => {
    const [minY, maxY] = yDomain;
    const range = maxY - minY || 1;
    return dimensions.padding.top + dimensions.drawHeight - ((value - minY) / range) * dimensions.drawHeight;
  }, [yDomain, dimensions]);

  // Generate segmented line paths
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
        // This is an event point - end at previous value, start new at new value
        const prevY = yScale(eventData.prevValue);
        if (currentSegment === '') {
          currentSegment = `M ${x} ${prevY}`;
        } else {
          currentSegment += ` L ${x} ${prevY}`;
        }
        segments.push(currentSegment);

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

    if (currentSegment !== '') {
      segments.push(currentSegment);
    }

    return segments;
  }, [lineData, xScale, yScale, referenceLines]);

  // Generate area path
  const areaPath = useMemo(() => {
    if (lineData.length === 0) return '';

    const bottomY = dimensions.padding.top + dimensions.drawHeight;

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
  }, [lineData, xScale, yScale, dimensions]);

  return {
    vaultEvents,
    series,
    referenceLines,
    lineData,
    lineSegments,
    areaPath,
    yDomain,
    dimensions,
    xScale,
    yScale,
  };
}
