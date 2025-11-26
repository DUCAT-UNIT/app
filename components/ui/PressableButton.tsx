/**
 * PressableButton
 * Interactive button with scale animation and haptic feedback
 *
 * Architecture: Atom component (< 150 lines)
 * Props: 6 (children, onPress, style, disabled, haptic, scaleAmount)
 * State: 1 (animation ref)
 * Complexity: Simple interaction component
 */

import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface PressableButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  scaleAmount?: number;
  testID?: string;
  accessibilityLabel?: string;
}

const PressableButton = ({
  children,
  onPress,
  style,
  disabled = false,
  haptic = true,
  scaleAmount = 0.95,
  testID,
  accessibilityLabel,
}: PressableButtonProps) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;

    // Haptic feedback on press
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Scale down animation
    Animated.spring(scale, {
      toValue: scaleAmount,
      useNativeDriver: true,
      friction: 3,
      tension: 100,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;

    // Scale back animation
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3,
      tension: 40,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[styles.pressable, disabled && styles.disabled]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    // No default styles - fully customizable
  },
  disabled: {
    opacity: 0.5,
  },
});

export default React.memo(PressableButton);
