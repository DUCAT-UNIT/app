/**
 * AmountSlider Component
 * Real-time updates using Reanimated on UI thread
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
import Icon from '../icons';
import TouchableScale from '../common/TouchableScale';

// Animated TextInput for real-time text updates on UI thread
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface AmountSliderProps {
  value: number;
  maxValue: number;
  onValueChange: (value: number) => void;
  onLiveValueChange?: (value: number) => void; // Called during drag for live preview
  label?: string;
  btcPrice?: number;
  disabled?: boolean;
}

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 4;

export const AmountSlider = memo(function AmountSlider({
  value,
  maxValue,
  onValueChange,
  onLiveValueChange,
  label = 'Amount',
  btcPrice,
  disabled = false,
}: AmountSliderProps): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const thumbX = useSharedValue(0);
  const currentValue = useSharedValue(value);
  const trackWidth = useSharedValue(0);
  const maxVal = useSharedValue(maxValue);
  const priceVal = useSharedValue(btcPrice || 0);
  const isDragging = useSharedValue(false);
  const lastLiveUpdate = useSharedValue(0);

  // Sync props to shared values
  useEffect(() => {
    maxVal.value = maxValue;
  }, [maxValue, maxVal]);

  useEffect(() => {
    priceVal.value = btcPrice || 0;
  }, [btcPrice, priceVal]);

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
      // Round to satoshi (1 sat = 0.00000001 BTC)
      const sats = Math.round(ratio * maxVal.value * 100000000);
      const newVal = sats / 100000000;
      currentValue.value = newVal;
      lastLiveUpdate.value = sats;
      runOnJS(updateLive)(newVal);
    })
    .onUpdate((e) => {
      'worklet';
      const w = trackWidth.value;
      if (w <= 0) return;
      const x = Math.max(0, Math.min(e.x - THUMB_SIZE / 2, w - THUMB_SIZE));
      thumbX.value = x;
      const ratio = x / (w - THUMB_SIZE);
      // Round to satoshi (1 sat = 0.00000001 BTC)
      const sats = Math.round(ratio * maxVal.value * 100000000);
      const newVal = sats / 100000000;
      currentValue.value = newVal;
      // Only update if satoshi value changed
      if (sats !== lastLiveUpdate.value) {
        lastLiveUpdate.value = sats;
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
    setEditText(value.toFixed(8));
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

  // Animated text props for BTC value - fixed 8 decimal places
  const btcAnimatedProps = useAnimatedProps(() => {
    const v = currentValue.value;
    const text = v.toFixed(8);
    return { text, defaultValue: text };
  });

  // Animated text props for USD value
  const usdAnimatedProps = useAnimatedProps(() => {
    const v = currentValue.value;
    const p = priceVal.value;
    if (p <= 0) return { text: '', defaultValue: '' };
    const usd = v * p;
    // Simple formatting for worklet - fixed 2 decimal places, use period as decimal separator
    const formatted = '$' + usd.toFixed(2);
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
            <Icon name="btc_symbol" size={24} color={COLORS.WHITE} />
            <TextInput
              ref={inputRef}
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              keyboardType="decimal-pad"
              onSubmitEditing={handleEditSubmit}
              onBlur={handleEditSubmit}
              selectTextOnFocus
              autoFocus
            />
            <Text style={styles.btcUnit}>BTC</Text>
          </View>
          <Text style={styles.usdTextStatic}>Tap done when finished</Text>
        </View>
      ) : (
        <TouchableOpacity onPress={handleTapToEdit} activeOpacity={0.7} style={styles.valueContainer}>
          <View style={styles.valueRow}>
            <Icon name="btc_symbol" size={24} color={COLORS.WHITE} />
            <AnimatedTextInput
              editable={false}
              style={styles.valueText}
              animatedProps={btcAnimatedProps}
              pointerEvents="none"
            />
            <Text style={styles.btcUnit}>BTC</Text>
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
    fontWeight: '500',
  },
  maxBtn: {
    color: COLORS.PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: '700',
  },
  maxBtnDisabled: {
    color: COLORS.DARK_GRAY,
  },
  valueContainer: {
    alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  valueText: {
    color: COLORS.WHITE,
    fontSize: 32,
    fontWeight: '700',
    padding: 0,
    margin: 0,
    minWidth: 100,
    textAlign: 'center',
  },
  editInput: {
    color: COLORS.WHITE,
    fontSize: 32,
    fontWeight: '700',
    padding: 0,
    margin: 0,
    minWidth: 180,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY_BLUE,
  },
  btcUnit: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 16,
    fontWeight: '500',
  },
  usdText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    padding: 0,
    margin: 0,
    width: '100%',
  },
  usdTextStatic: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  sliderWrap: {
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: COLORS.DARK_GRAY,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: TRACK_HEIGHT,
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: COLORS.WHITE,
    top: (40 - THUMB_SIZE) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
});

export default AmountSlider;
