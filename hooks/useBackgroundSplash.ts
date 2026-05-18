/**
 * useBackgroundSplash - Shows splash screen when app is backgrounded
 * Protects sensitive information in app switcher preview
 */

import { useEffect, useRef } from 'react';
import { AppState, Animated, LayoutAnimation, Platform, AppStateStatus } from 'react-native';
import { isPrivacySplashSuppressed } from '../services/privacySplashSuppression';

interface UseBackgroundSplashReturn {
  opacityRef: Animated.Value;
}

export const useBackgroundSplash = (): UseBackgroundSplashReturn => {
  // Initialize based on current AppState - if app starts inactive/background, show splash immediately
  const initialState = AppState.currentState;
  const initialOpacity = initialState === 'active' ? 0 : 1;
  const opacityRef = useRef(new Animated.Value(initialOpacity)).current;
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(initialState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      // Show splash when app is backgrounded OR inactive (app switcher).
      // Native auth prompts can also emit `inactive`; those are suppressed so
      // the splash does not cover signing flows after Face ID resolves.
      if (
        nextAppState === 'background' ||
        (nextAppState === 'inactive' && !isPrivacySplashSuppressed())
      ) {
        // Configure layout animation for immediate update
        if (Platform.OS === 'ios') {
          LayoutAnimation.configureNext(
            LayoutAnimation.create(
              1,
              LayoutAnimation.Types.linear,
              LayoutAnimation.Properties.opacity
            )
          );
        }
        // Set opacity to 1 IMMEDIATELY (synchronous, no React re-render needed)
        opacityRef.setValue(1);
      } else if (
        nextAppState === 'active' &&
        (prevState === 'background' || prevState === 'inactive')
      ) {
        // Hide synchronously on foreground. A native auth promise can resume
        // expensive signing work before an animation frame runs.
        opacityRef.setValue(0);
      }
    });

    return () => {
      subscription.remove();
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [opacityRef]);

  return { opacityRef };
};
