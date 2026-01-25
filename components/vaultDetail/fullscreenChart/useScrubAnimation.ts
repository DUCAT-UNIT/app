/**
 * useScrubAnimation Hook
 * Manages native-driven animated scrubbing for ultra-smooth 60fps performance
 */

import { useRef, useCallback, useMemo } from 'react';
import { Animated, PanResponder, GestureResponderEvent } from 'react-native';
import type { ReferenceLine, ScrubData } from '../vaultChart/types';

interface UseScrubAnimationProps {
  chartWidth: number;
  padding?: { left: number; right: number };
  referenceLines: ReferenceLine[];
  xScale: (timestamp: number) => number;
  yScale: (value: number) => number;
  getHealthAtX: (x: number) => number | null;
  getTimestampAtX: (x: number) => number | null;
  findNearbyRefLine: (x: number) => number | null;
  onScrubDataChange: (data: ScrubData) => void;
  onHoveredRefLineChange: (index: number | null) => void;
  onLockRefLine: (index: number | null, scrubData: ScrubData) => void;
}

interface UseScrubAnimationReturn {
  scrubXAnim: Animated.Value;
  scrubYAnim: Animated.Value;
  scrubOpacity: Animated.Value;
  scrubColorAnim: Animated.Value;
  panResponder: ReturnType<typeof PanResponder.create>;
}

export function useScrubAnimation({
  chartWidth,
  padding = { left: 0, right: 0 },
  referenceLines,
  xScale,
  yScale,
  getHealthAtX,
  getTimestampAtX,
  findNearbyRefLine,
  onScrubDataChange,
  onHoveredRefLineChange,
  onLockRefLine,
}: UseScrubAnimationProps): UseScrubAnimationReturn {
  // Scrubber circle radius for clamping
  const SCRUBBER_RADIUS = 6;

  // Clamp X to keep scrubber circle within chart bounds
  const clampX = (rawX: number): number => {
    const minX = padding.left + SCRUBBER_RADIUS;
    const maxX = chartWidth - padding.right - SCRUBBER_RADIUS;
    return Math.max(minX, Math.min(rawX, maxX));
  };
  // Animated values for native-driven smooth scrubbing
  const scrubXAnim = useRef(new Animated.Value(0)).current;
  const scrubYAnim = useRef(new Animated.Value(0)).current;
  const scrubOpacity = useRef(new Animated.Value(0)).current;
  const scrubColorAnim = useRef(new Animated.Value(0)).current;

  // Refs for tracking current values
  const scrubDataRef = useRef<ScrubData>({ health: null, x: null, timestamp: null });
  const hoveredRefLineRef = useRef<number | null>(null);

  // Update animated scrubber position (no state, pure animation)
  const updateAnimatedScrub = useCallback((x: number) => {
    const nearbyRefIndex = findNearbyRefLine(x);
    hoveredRefLineRef.current = nearbyRefIndex;

    let finalX = x;
    let health: number | null = null;
    let timestamp: number | null = null;

    if (nearbyRefIndex !== null && referenceLines[nearbyRefIndex]) {
      const refLine = referenceLines[nearbyRefIndex];
      finalX = xScale(refLine.date);
      health = refLine.newValue;
      timestamp = refLine.date;
    } else {
      health = getHealthAtX(x);
      timestamp = getTimestampAtX(x);
    }

    scrubDataRef.current = { health, x: finalX, timestamp };

    // Update animated values directly (native-driven smooth)
    scrubXAnim.setValue(finalX);
    if (health !== null) {
      scrubYAnim.setValue(yScale(health));
      // Set color value: 0=red (<=160), 0.5=yellow (<=200), 1=green (>200)
      const colorVal = health <= 160 ? 0 : health <= 200 ? 0.5 : 1;
      scrubColorAnim.setValue(colorVal);
    }
  }, [findNearbyRefLine, referenceLines, xScale, getHealthAtX, getTimestampAtX, scrubXAnim, scrubYAnim, scrubColorAnim, yScale]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false, // Prevent parent ScrollView from stealing gesture
    onShouldBlockNativeResponder: () => true, // Block native scroll while scrubbing
    onPanResponderGrant: (evt: GestureResponderEvent) => {
      onLockRefLine(null, { health: null, x: null, timestamp: null });

      // Show scrubber immediately
      scrubOpacity.setValue(1);
      const x = clampX(evt.nativeEvent.locationX);
      updateAnimatedScrub(x);

      // Update displays
      onScrubDataChange({ ...scrubDataRef.current });
      onHoveredRefLineChange(hoveredRefLineRef.current);
    },
    onPanResponderMove: (evt: GestureResponderEvent) => {
      const x = clampX(evt.nativeEvent.locationX);

      // Update animated position immediately (60fps smooth)
      updateAnimatedScrub(x);

      // Update state on every move for real-time text updates
      onScrubDataChange({ ...scrubDataRef.current });
      onHoveredRefLineChange(hoveredRefLineRef.current);
    },
    onPanResponderRelease: () => {
      const nearbyRefIndex = hoveredRefLineRef.current;
      if (nearbyRefIndex !== null && referenceLines[nearbyRefIndex]) {
        // Locking to an event - keep scrubber visible
        const refLine = referenceLines[nearbyRefIndex];
        const exactX = xScale(refLine.date);
        onLockRefLine(nearbyRefIndex, { health: refLine.newValue, x: exactX, timestamp: refLine.date });
      } else {
        // Not locking - hide scrubber
        scrubOpacity.setValue(0);
      }
      onScrubDataChange({ health: null, x: null, timestamp: null });
      onHoveredRefLineChange(null);
      scrubDataRef.current = { health: null, x: null, timestamp: null };
      hoveredRefLineRef.current = null;
    },
  }), [updateAnimatedScrub, referenceLines, xScale, scrubOpacity, onScrubDataChange, onHoveredRefLineChange, onLockRefLine]);

  return {
    scrubXAnim,
    scrubYAnim,
    scrubOpacity,
    scrubColorAnim,
    panResponder,
  };
}
