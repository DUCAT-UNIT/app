/**
 * UnitAmountSlider Component
 * Real-time updates using Reanimated on UI thread for UNIT amounts
 */

import React,{ memo,useCallback,useEffect,useRef,useState } from 'react';
import {
Keyboard,
LayoutChangeEvent,
StyleSheet,
Text,
TextInput,
TouchableOpacity,
View,
} from 'react-native';
import { Gesture,GestureDetector } from 'react-native-gesture-handler';
import Animated,{
runOnJS,
useAnimatedProps,
useAnimatedStyle,
useSharedValue,
} from 'react-native-reanimated';
import { COLORS } from '../../theme';
import { isE2E } from '../../utils/e2e';
import TouchableScale from '../common/TouchableScale';

// Animated TextInput for real-time text updates on UI thread
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export interface UnitAmountSliderProps {
  value: number;
  maxValue: number;
  onValueChange: (value: number) => void;
  onLiveValueChange?: (value: number) => void;
  label?: string;
  unitLabel?: 'UNIT' | 'USD';
  disabled?: boolean;
  /** Optional footer content to render inside the card (e.g., fee selector) */
  renderFooter?: () => React.ReactNode;
  /** Remove bottom border radius when attached to another element below */
  attachedBottom?: boolean;
  /** Remove top border radius when attached to another element above */
  attachedTop?: boolean;
  /** Custom color for slider track fill (defaults to PRIMARY_BLUE) */
  sliderColor?: string;
  /** Hide the available amount in header */
  hideAvailable?: boolean;
  /** Optional prefix for stable E2E selectors on editable controls */
  testIDPrefix?: string;
}

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 4;

export const UnitAmountSlider = memo(function UnitAmountSlider({
  value,
  maxValue,
  onValueChange,
  onLiveValueChange,
  label = 'Amount',
  unitLabel = 'UNIT',
  disabled = false,
  renderFooter,
  attachedBottom = false,
  attachedTop = false,
  sliderColor = COLORS.PRIMARY_BLUE,
  testIDPrefix,
}: UnitAmountSliderProps): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const editTextRef = useRef('');
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
      } else {
        thumbX.value = 0;
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
    .activeOffsetX([-0, 0])
    .activeOffsetY([-0, 0])
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
      runOnJS(updateParent)(newVal);
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

  const handleHalf = useCallback(() => {
    if (disabled || maxValue <= 0) return;
    const half = Math.round((maxValue / 2) * 100) / 100;
    currentValue.value = half;
    if (width > 0) {
      thumbX.value = (half / maxValue) * (width - THUMB_SIZE);
    }
    onValueChange(half);
    onLiveValueChange?.(half);
  }, [disabled, maxValue, onValueChange, onLiveValueChange, currentValue, thumbX, width]);

  const handleQuarter = useCallback(() => {
    if (disabled || maxValue <= 0) return;
    const quarter = Math.round((maxValue / 4) * 100) / 100;
    currentValue.value = quarter;
    if (width > 0) {
      thumbX.value = (quarter / maxValue) * (width - THUMB_SIZE);
    }
    onValueChange(quarter);
    onLiveValueChange?.(quarter);
  }, [disabled, maxValue, onValueChange, onLiveValueChange, currentValue, thumbX, width]);

  const handleTapToEdit = useCallback(() => {
    if (disabled) return;
    const initialText = value.toFixed(2);
    editTextRef.current = initialText;
    setEditText(initialText);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [disabled, value]);

  const handleEditTextChange = useCallback((text: string) => {
    editTextRef.current = text;
    setEditText(text);
  }, []);

  const handleEditSubmit = useCallback(() => {
    const parsed = parseFloat(editTextRef.current || editText);
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
    // Show with 2 decimal places for proper dollar amounts
    const formatted = '$' + v.toFixed(2);
    return { text: formatted, defaultValue: formatted };
  });

  return (
    <View style={[
      styles.container,
      attachedBottom && styles.containerAttachedBottom,
      attachedTop && styles.containerAttachedTop,
      renderFooter && styles.containerWithFooter,
    ]}>
      {/* Slider area with bottom radius when footer exists */}
      <View style={renderFooter ? styles.sliderArea : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.label} accessibilityElementsHidden>{label}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {isE2E() && (
              <>
                <TouchableScale
                  onPress={handleQuarter}
                  disabled={disabled}
                  testID="unit-slider-quarter-btn"
                >
                  <Text style={[styles.maxBtn, disabled && styles.maxBtnDisabled]}>QTR</Text>
                </TouchableScale>
                <TouchableScale
                  onPress={handleHalf}
                  disabled={disabled}
                  testID="unit-slider-half-btn"
                >
                  <Text style={[styles.maxBtn, disabled && styles.maxBtnDisabled]}>HALF</Text>
                </TouchableScale>
              </>
            )}
            <TouchableScale
              onPress={handleMax}
              disabled={disabled}
              testID="unit-slider-max-btn"
              accessibilityRole="button"
              accessibilityLabel="Set maximum amount"
              accessibilityHint="Sets the amount to the maximum available"
              accessibilityState={{ disabled }}
            >
              <Text style={[styles.maxBtn, disabled && styles.maxBtnDisabled]} accessibilityElementsHidden>MAX</Text>
            </TouchableScale>
          </View>
        </View>

        {/* Value - tap to edit or animated display */}
        {isEditing ? (
          <View style={styles.valueContainer}>
            <View style={styles.valueRow}>
              <TextInput
                ref={inputRef}
                style={styles.editInput}
                value={editText}
                onChangeText={handleEditTextChange}
                keyboardType="decimal-pad"
                onSubmitEditing={handleEditSubmit}
                onBlur={handleEditSubmit}
                selectTextOnFocus
                autoFocus
                testID={testIDPrefix ? `${testIDPrefix}-input` : undefined}
              />
              <Text style={styles.unitLabel}>{unitLabel}</Text>
              <TouchableOpacity
                onPress={handleEditSubmit}
                activeOpacity={0.8}
                style={styles.doneButton}
                testID={testIDPrefix ? `${testIDPrefix}-done-btn` : undefined}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleTapToEdit}
            activeOpacity={0.7}
            style={styles.valueContainer}
            testID={testIDPrefix ? `${testIDPrefix}-display` : undefined}
            accessibilityRole="button"
            accessibilityLabel={`Current amount: ${value.toFixed(2)} ${unitLabel}. Tap to edit`}
            accessibilityHint="Opens keyboard to enter a specific amount"
          >
            <View style={styles.valueRow} accessibilityElementsHidden>
              <AnimatedTextInput
                editable={false}
                style={styles.valueText}
                animatedProps={unitAnimatedProps}
                pointerEvents="none"
                testID={testIDPrefix ? `${testIDPrefix}-value` : undefined}
              />
              <Text style={styles.unitLabel}>{unitLabel}</Text>
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
          <View
            style={styles.sliderWrap}
            onLayout={handleLayout}
            accessibilityRole="adjustable"
            accessibilityLabel={`${label} slider`}
            accessibilityValue={{
              min: 0,
              max: maxValue,
              now: value,
            }}
            accessibilityHint="Drag to adjust the amount"
          >
            <View style={styles.track}>
              <Animated.View style={[styles.trackFill, trackFillStyle, { backgroundColor: sliderColor }]} />
            </View>
            <Animated.View style={[styles.thumb, thumbStyle]} />
          </View>
        </GestureDetector>
      </View>

      {/* Optional footer content */}
      {renderFooter && (
        <View style={styles.footer}>
          {renderFooter()}
        </View>
      )}
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
    overflow: 'hidden',
  },
  containerAttachedBottom: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  containerAttachedTop: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
  },
  containerWithFooter: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  sliderArea: {
    backgroundColor: COLORS.CARD_BG,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingBottom: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    marginTop: -16,
    paddingTop: 16,
    zIndex: 1,
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
    width: 150,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  editInput: {
    color: COLORS.WHITE,
    fontSize: 32,
    fontWeight: '700',
    padding: 0,
    margin: 0,
    minWidth: 120,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY_BLUE,
  },
  unitLabel: {
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
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE,
  },
  doneButtonText: {
    color: COLORS.PRIMARY_BLUE,
    fontSize: 13,
    fontWeight: '700',
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
  footer: {
    marginTop: -8,
    marginHorizontal: -16,
    marginBottom: -16,
    backgroundColor: '#28272C',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
});
