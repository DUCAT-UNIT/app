/**
 * FullscreenVaultChart Component
 * Fullscreen modal with chart on top 60% and activity list below
 */

import React, { useState, useEffect, useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../theme';
import Icon from '../../icons';
import { VaultActivityList } from '../VaultActivityList';
import type { VaultHistoryTransaction } from '../../../services/vaultService';
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

        {/* Activity section - bottom 40% */}
        <View style={styles.activitySection}>
          <Text style={styles.activityTitle}>Activity</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <VaultActivityList
              transactions={filteredTransactions}
              isLoading={loading}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

export default FullscreenVaultChart;
