/**
 * FullscreenVaultChart Component
 * Fullscreen modal chart with transaction drawer
 */

import React, { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../theme';
import Icon from '../../icons';
import type { VaultHistoryTransaction } from '../../../services/vaultService';
import type { PriceTimeframe, ScrubData } from '../vaultChart/types';
import { TIMEFRAMES, INTERVAL_CONFIG } from '../vaultChart/types';
import { getHealthColor, getHealthChipBg } from '../vaultChart/utils';
import { DRAWER_WIDTH, LEFT_MARGIN, RIGHT_MARGIN } from './constants';
import { fullscreenStyles as styles } from './styles';
import { useFullscreenChartData } from './useFullscreenChartData';
import { useScrubAnimation } from './useScrubAnimation';
import { FullscreenChartDrawer } from './FullscreenChartDrawer';

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
  const [lockedRefLineIndex, setLockedRefLineIndex] = useState<number | null>(null);
  const [lockedScrubData, setLockedScrubData] = useState<ScrubData>({ health: null, x: null });

  // Drawer animation
  const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const [drawerSide, setDrawerSide] = useState<'left' | 'right' | null>(null);

  // Safe area insets
  const insets = useSafeAreaInsets();
  const safeAreaTop = insets.left;
  const safeAreaBottom = insets.right;

  // Chart data
  const {
    loading,
    referenceLines,
    lineData,
    lineSegments,
    areaPath,
    yDomain,
    chartWidth,
    chartHeight,
    xScale,
    yScale,
    getHealthAtX,
    findNearbyRefLine,
  } = useFullscreenChartData(visible, selectedTimeframe, transactions);

  // Lock handler
  const handleLockRefLine = useCallback((index: number | null, data: ScrubData) => {
    setLockedRefLineIndex(index);
    setLockedScrubData(data);
  }, []);

  // Scrub animation
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
    onLockRefLine: handleLockRefLine,
  });

  // Drawer animation effect
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

    return transactions.filter(tx =>
      tx.timestamp >= bucketStart && tx.timestamp <= bucketEnd
    );
  }, [lockedRefLineIndex, referenceLines, transactions, selectedTimeframe]);

  // Active reference line
  const activeRefLineIndex = hoveredRefLineIndex ?? lockedRefLineIndex;
  const activeRefLine = activeRefLineIndex !== null ? referenceLines[activeRefLineIndex] : null;

  // Display values
  const displayHealth = scrubData.health ?? lockedScrubData.health ?? (lineData.length > 0 ? lineData[lineData.length - 1].healthValue : null);
  const healthColor = getHealthColor(displayHealth);
  const healthChipBg = getHealthChipBg(displayHealth);

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
        <View style={[styles.rotatedContainer, { paddingTop: safeAreaTop, paddingBottom: safeAreaBottom }]}>
          {/* Top controls - hidden when drawer open */}
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

                {/* Animated Scrubber Line */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.animatedScrubberLine,
                    {
                      height: chartHeight,
                      opacity: scrubOpacity,
                      transform: [
                        { translateX: scrubXAnim },
                        { translateY: scrubYAnim },
                      ],
                      backgroundColor: scrubColorAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: ['#d04c68', '#fde37b', '#59aa8a'],
                      }),
                    },
                  ]}
                />
                {/* Animated Scrubber Dot */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.animatedScrubberDotOuter,
                    {
                      opacity: scrubOpacity,
                      transform: [
                        { translateX: Animated.subtract(scrubXAnim, 6) },
                        { translateY: Animated.subtract(scrubYAnim, 6) },
                      ],
                      backgroundColor: scrubColorAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: ['#d04c68', '#fde37b', '#59aa8a'],
                      }),
                    },
                  ]}
                >
                  <View style={styles.animatedScrubberDotInner} />
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

            {/* Drawer */}
            <FullscreenChartDrawer
              drawerSide={drawerSide}
              drawerAnim={drawerAnim}
              activeRefLine={activeRefLine}
              transactions={lockedEventTransactions}
              onClose={closeDrawer}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
});

export default FullscreenVaultChart;
