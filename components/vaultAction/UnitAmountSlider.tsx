/**
 * UnitAmountSlider Component
 * Real-time updates using Reanimated on UI thread for UNIT amounts
 */

import React, { memo, useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  TextInput,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { COLORS } from '../../theme';
import TouchableScale from '../common/TouchableScale';

// Animated TextInput for real-time text updates on UI thread
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface UnitAmountSliderProps {
  value: number;
  maxValue: number;
  onValueChange: (value: number) => void;
  onLiveValueChange?: (value: number) => void;
  label?: string;
  disabled?: boolean;
}

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 6;

export const UnitAmountSlider = memo(function UnitAmountSlider({
  value,
  maxValue,
  onValueChange,
  onLiveValueChange,
  label = 'Amount',
  disabled = false,
}: UnitAmountSliderProps): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const thumbX = useSharedValue(0);
  const currentValue = useSharedValue(value);
  const trackWidth = useSharedValue(0);
  const maxVal = useSharedValue(maxValue);
  const isDragging = useSharedValue(false);
  const lastLiveUpdate = useSharedValue(0);

  // Sync props to shared values
  useEffect(() => {
    maxVal.value = maxValue;
  }, [maxValue, maxVal]);

  // Sync thumb position when value changes externally (and not dragging)
  useEffect(() => {
    if (!isDragging.value) {
      currentValue.value = value;
      if (width > 0 && maxValue > 0) {
        const pos = (value / maxValue) * (width - THUMB_SIZE);
        thumbX.value = Math.max(0, Math.min(pos, width - THUMB_SIZE));
      }
    }
  }, [value, maxValue, width, thumbX, currentValue, isDragging]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth(w);
    trackWidth.value = w;
    if (w > 0 && maxValue > 0) {
      const pos = (value / maxValue) * (w - THUMB_SIZE);
      thumbX.value = Math.max(0, Math.min(pos, w - THUMB_SIZE));
    }
  }, [value, maxValue, thumbX, trackWidth]);

  const updateParent = useCallback((val: number) => {
    onValueChange(val);
  }, [onValueChange]);

  const updateLive = useCallback((val: number) => {
    onLiveValueChange?.(val);
  }, [onLiveValueChange]);

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin((e) => {
      'worklet';
      isDragging.value = true;
      const w = trackWidth.value;
      if (w <= 0) return;
      const x = Math.max(0, Math.min(e.x - THUMB_SIZE / 2, w - THUMB_SIZE));
      thumbX.value = x;
      const ratio = x / (w - THUMB_SIZE);
      // Round to cents (0.01 UNIT increments)
      const cents = Math.round(ratio * maxVal.value * 100);
      const newVal = cents / 100;
      currentValue.value = newVal;
      lastLiveUpdate.value = cents;
      runOnJS(updateLive)(newVal);
    })
    .onUpdate((e) => {
      'worklet';
      const w = trackWidth.value;
      if (w <= 0) return;
      const x = Math.max(0, Math.min(e.x - THUMB_SIZE / 2, w - THUMB_SIZE));
      thumbX.value = x;
      const ratio = x / (w - THUMB_SIZE);
      // Round to cents (0.01 UNIT increments)
      const cents = Math.round(ratio * maxVal.value * 100);
      const newVal = cents / 100;
      currentValue.value = newVal;
      // Only update if cents value changed
      if (cents !== lastLiveUpdate.value) {
        lastLiveUpdate.value = cents;
        runOnJS(updateLive)(newVal);
      }
    })
    .onEnd(() => {
      'worklet';
      isDragging.value = false;
      runOnJS(updateParent)(currentValue.value);
    });

  const handleMax = useCallback(() => {
    if (disabled || maxValue <= 0) return;
    currentValue.value = maxValue;
    if (width > 0) {
      thumbX.value = width - THUMB_SIZE;
    }
    onValueChange(maxValue);
    onLiveValueChange?.(maxValue);
  }, [disabled, maxValue, onValueChange, onLiveValueChange, currentValue, thumbX, width]);

  const handleTapToEdit = useCallback(() => {
    if (disabled) return;
    setEditText(value.toFixed(2));
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [disabled, value]);

  const handleEditSubmit = useCallback(() => {
    const parsed = parseFloat(editText);
    if (!isNaN(parsed) && parsed >= 0) {
      const clamped = Math.min(parsed, maxValue);
      currentValue.value = clamped;
      if (width > 0 && maxValue > 0) {
        const pos = (clamped / maxValue) * (width - THUMB_SIZE);
        thumbX.value = Math.max(0, Math.min(pos, width - THUMB_SIZE));
      }
      onValueChange(clamped);
      onLiveValueChange?.(clamped);
    }
    setIsEditing(false);
    Keyboard.dismiss();
  }, [editText, maxValue, width, currentValue, thumbX, onValueChange, onLiveValueChange]);

  // Animated styles
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const trackFillStyle = useAnimatedStyle(() => ({
    width: thumbX.value + THUMB_SIZE / 2,
  }));

  // Animated text props for UNIT value - two decimal places
  const unitAnimatedProps = useAnimatedProps(() => {
    const v = currentValue.value;
    const text = v.toFixed(2);
    return { text, defaultValue: text };
  });

  // Animated text props for USD value (UNIT ≈ $1)
  const usdAnimatedProps = useAnimatedProps(() => {
    const v = currentValue.value;
    const formatted = '$' + Math.floor(v).toLocaleString('en-US');
    return { text: formatted, defaultValue: formatted };
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <TouchableScale onPress={handleMax} disabled={disabled}>
          <Text style={[styles.maxBtn, disabled && styles.maxBtnDisabled]}>MAX</Text>
        </TouchableScale>
      </View>

      {/* Value - tap to edit or animated display */}
      {isEditing ? (
        <View style={styles.valueContainer}>
          <View style={styles.valueRow}>
            <TextInput
              ref={inputRef}
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              keyboardType="number-pad"
              onSubmitEditing={handleEditSubmit}
              onBlur={handleEditSubmit}
              selectTextOnFocus
              autoFocus
            />
            <Text style={styles.unitLabel}>UNIT</Text>
          </View>
          <Text style={styles.usdTextStatic}>Tap done when finished</Text>
        </View>
      ) : (
        <TouchableOpacity onPress={handleTapToEdit} activeOpacity={0.7} style={styles.valueContainer}>
          <View style={styles.valueRow}>
            <AnimatedTextInput
              editable={false}
              style={styles.valueText}
              animatedProps={unitAnimatedProps}
              pointerEvents="none"
            />
            <Text style={styles.unitLabel}>UNIT</Text>
          </View>
          <AnimatedTextInput
            editable={false}
            style={styles.usdText}
            animatedProps={usdAnimatedProps}
            pointerEvents="none"
          />
        </TouchableOpacity>
      )}

      {/* Slider */}
      <GestureDetector gesture={gesture}>
        <View style={styles.sliderWrap} onLayout={handleLayout}>
          <View style={styles.track}>
            <Animated.View style={[styles.trackFill, trackFillStyle]} />
          </View>
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  maxBtn: {
    color: COLORS.SUCCESS_GREEN,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(89, 170, 138, 0.15)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  maxBtnDisabled: {
    color: COLORS.DARK_GRAY,
    backgroundColor: 'rgba(51, 51, 51, 0.3)',
  },
  valueContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 6,
  },
  valueText: {
    color: COLORS.WHITE,
    fontSize: 36,
    fontWeight: '700',
    padding: 0,
    margin: 0,
    width: 160,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  editInput: {
    color: COLORS.WHITE,
    fontSize: 36,
    fontWeight: '700',
    padding: 0,
    margin: 0,
    minWidth: 140,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.SUCCESS_GREEN,
  },
  unitLabel: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 18,
    fontWeight: '600',
  },
  usdText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    padding: 0,
    margin: 0,
    width: '100%',
  },
  usdTextStatic: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  sliderWrap: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: 'rgba(51, 51, 51, 0.8)',
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: TRACK_HEIGHT,
    backgroundColor: COLORS.SUCCESS_GREEN,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: COLORS.WHITE,
    top: (48 - THUMB_SIZE) / 2,
    shadowColor: COLORS.SUCCESS_GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 3,
    borderColor: COLORS.SUCCESS_GREEN,
  },
});

export default UnitAmountSlider;
