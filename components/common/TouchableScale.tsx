/**
 * TouchableScale
 * Subtle scale animation on press with optional haptic feedback
 * Architecture: Reusable atom component
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Animated, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface TouchableScaleProps {
  children: React.ReactNode;
  onPress?: () => void | Promise<void>;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  lockWhilePending?: boolean;
  pressLockMs?: number;
  scaleAmount?: number;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link' | 'none' | 'text' | 'search' | 'image' | 'adjustable' | 'header' | 'summary' | 'alert' | 'checkbox' | 'combobox' | 'menu' | 'menubar' | 'menuitem' | 'progressbar' | 'radio' | 'radiogroup' | 'scrollbar' | 'spinbutton' | 'switch' | 'tab' | 'tablist' | 'timer' | 'toolbar';
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean | 'mixed';
    busy?: boolean;
    expanded?: boolean;
  };
}

const TouchableScale = ({
  children,
  onPress,
  style,
  disabled,
  haptic = true,
  lockWhilePending = false,
  pressLockMs = 0,
  scaleAmount = 0.95,
  testID,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  accessibilityState,
}: TouchableScaleProps) => {
  const scale = useRef(new Animated.Value(1)).current;
  const lockRef = useRef(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPressLocked, setIsPressLocked] = useState(false);

  const releasePressLock = useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    lockRef.current = false;
    setIsPressLocked(false);
  }, []);

  useEffect(() => () => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    lockRef.current = false;
  }, []);

  const schedulePressUnlock = useCallback((delayMs: number) => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
    }
    lockTimerRef.current = setTimeout(() => {
      lockTimerRef.current = null;
      lockRef.current = false;
      setIsPressLocked(false);
    }, delayMs);
    (lockTimerRef.current as { unref?: () => void }).unref?.();
  }, []);

  const handlePress = useCallback(async () => {
    if (!onPress || disabled || lockRef.current) {
      return;
    }

    const shouldLock = lockWhilePending || pressLockMs > 0;
    if (shouldLock) {
      lockRef.current = true;
      setIsPressLocked(true);
    }

    try {
      const result = onPress();
      if (lockWhilePending && result && typeof (result as Promise<void>).then === 'function') {
        await result;
      }
    } finally {
      if (pressLockMs > 0) {
        schedulePressUnlock(pressLockMs);
      } else if (shouldLock) {
        releasePressLock();
      }
    }
  }, [disabled, lockWhilePending, onPress, pressLockMs, releasePressLock, schedulePressUnlock]);

  const handlePressIn = () => {
    if (disabled || isPressLocked) return;

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
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={style}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        ...accessibilityState,
        disabled: accessibilityState?.disabled || disabled || isPressLocked,
      }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
};


export default React.memo(TouchableScale);
