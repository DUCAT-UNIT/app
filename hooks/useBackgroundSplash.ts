/**
 * useBackgroundSplash - Shows splash screen when app is backgrounded
 * Protects sensitive information in app switcher preview
 */

import { useEffect, useRef } from 'react';
import { AppState, Animated, LayoutAnimation, Platform, AppStateStatus } from 'react-native';

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

      // Show splash when app is backgrounded OR inactive (app switcher)
      // This protects sensitive info in app switcher preview
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Configure layout animation for immediate update
        if (Platform.OS === 'ios') {
          LayoutAnimation.configureNext(LayoutAnimation.create(
            1,
            LayoutAnimation.Types.linear,
            LayoutAnimation.Properties.opacity
          ));
        }
        // Set opacity to 1 IMMEDIATELY (synchronous, no React re-render needed)
        opacityRef.setValue(1);
      } else if (nextAppState === 'active' && (prevState === 'background' || prevState === 'inactive')) {
        // Only fade out if we were actually backgrounded (not just starting up)
        // Fade out animation
        Animated.timing(opacityRef, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false, // Disable native driver for immediate updates
        }).start();
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
