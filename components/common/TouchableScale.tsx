/**
 * TouchableScale
 * Subtle scale animation on press with optional haptic feedback
 * Architecture: Atom component (< 100 lines)
 */

import React, { useRef } from 'react';
import { Pressable, Animated, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface TouchableScaleProps {
  children: React.ReactNode;
  onPress?: () => void | Promise<void>;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  scaleAmount?: number;
  testID?: string;
  accessibilityLabel?: string;
}

const TouchableScale = ({
  children,
  onPress,
  style,
  disabled,
  haptic = true,
  scaleAmount = 0.95,
  testID,
  accessibilityLabel,
}: TouchableScaleProps) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;

    // Light haptic feedback
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Scale down
    Animated.spring(scale, {
      toValue: scaleAmount,
      useNativeDriver: true,
      friction: 5,
      tension: 300,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;

    // Scale back up
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 300,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={style}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
};


export default React.memo(TouchableScale);
