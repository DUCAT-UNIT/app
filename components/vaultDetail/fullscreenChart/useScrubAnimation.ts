/**
 * useScrubAnimation Hook
 * Manages native-driven animated scrubbing for ultra-smooth 60fps performance
 */

import { useRef, useCallback, useMemo } from 'react';
import { Animated, PanResponder, GestureResponderEvent } from 'react-native';
import type { ReferenceLine, ScrubData } from '../vaultChart/types';

interface UseScrubAnimationProps {
  chartWidth: number;
  referenceLines: ReferenceLine[];
  xScale: (timestamp: number) => number;
  yScale: (value: number) => number;
  getHealthAtX: (x: number) => number | null;
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
  referenceLines,
  xScale,
  yScale,
  getHealthAtX,
  findNearbyRefLine,
  onScrubDataChange,
  onHoveredRefLineChange,
  onLockRefLine,
}: UseScrubAnimationProps): UseScrubAnimationReturn {
  // Animated values for native-driven smooth scrubbing
  const scrubXAnim = useRef(new Animated.Value(0)).current;
  const scrubYAnim = useRef(new Animated.Value(0)).current;
  const scrubOpacity = useRef(new Animated.Value(0)).current;
  const scrubColorAnim = useRef(new Animated.Value(0)).current;

  // Refs for performance optimization
  const scrubDataRef = useRef<ScrubData>({ health: null, x: null });
  const hoveredRefLineRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);
  const pendingUpdateRef = useRef<number | null>(null);

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

    // Update animated values directly (native-driven smooth)
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
    onPanResponderGrant: (evt: GestureResponderEvent) => {
      isPanningRef.current = true;
      if (pendingUpdateRef.current) {
        cancelAnimationFrame(pendingUpdateRef.current);
      }
      onLockRefLine(null, { health: null, x: null });

      // Show scrubber immediately
      scrubOpacity.setValue(1);
      updateAnimatedScrub(evt.nativeEvent.locationX);

      // Update displays
      onScrubDataChange({ ...scrubDataRef.current });
      onHoveredRefLineChange(hoveredRefLineRef.current);
    },
    onPanResponderMove: (evt: GestureResponderEvent) => {
      const x = evt.nativeEvent.locationX;

      // Update animated position immediately (60fps smooth)
      updateAnimatedScrub(x);

      // Throttle state updates for text to ~10fps (100ms)
      const now = Date.now();
      if (now - lastUpdateRef.current < 100) {
        if (!pendingUpdateRef.current) {
          pendingUpdateRef.current = requestAnimationFrame(() => {
            if (isPanningRef.current) {
              onScrubDataChange({ ...scrubDataRef.current });
            }
            pendingUpdateRef.current = null;
          });
        }
        return;
      }
      lastUpdateRef.current = now;
      onScrubDataChange({ ...scrubDataRef.current });
    },
    onPanResponderRelease: () => {
      isPanningRef.current = false;
      if (pendingUpdateRef.current) {
        cancelAnimationFrame(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }

      const nearbyRefIndex = hoveredRefLineRef.current;
      if (nearbyRefIndex !== null && referenceLines[nearbyRefIndex]) {
        // Locking to an event - keep scrubber visible
        const refLine = referenceLines[nearbyRefIndex];
        const exactX = xScale(refLine.date);
        onLockRefLine(nearbyRefIndex, { health: refLine.newValue, x: exactX });
      } else {
        // Not locking - hide scrubber
        scrubOpacity.setValue(0);
      }
      onScrubDataChange({ health: null, x: null });
      onHoveredRefLineChange(null);
      scrubDataRef.current = { health: null, x: null };
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
