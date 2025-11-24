/**
 * SplashScreen Component
 * Displays the Ducat logo on app launch and when app is backgrounded
 */

import React, { useEffect, useRef } from 'react';
import { AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from '../components/icons';
import styles from '../styles';
import { logger } from '../utils/logger';

export default function SplashScreen() {
  const viewRef = useRef(null);
  const [pointerEvents, setPointerEvents] = React.useState('auto');
  const hasHiddenRef = useRef(false);

  useEffect(() => {
    let hasBeenInactive = false;

    // Fallback: Always hide after 2 seconds if not hidden yet
    const fallbackTimer = setTimeout(() => {
      if (!hasHiddenRef.current) {
        logger.debug('[SplashScreen] Fallback timer - hiding splash');
        viewRef.current?.setNativeProps({
          style: { opacity: 0 }
        });
        setPointerEvents('none');
        hasHiddenRef.current = true;
      }
    }, 2000);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Show splash immediately
        hasBeenInactive = true;
        setPointerEvents('auto');
        viewRef.current?.setNativeProps({
          style: { opacity: 1 }
        });
      } else if (nextAppState === 'active') {
        // Hide splash when becoming active
        setTimeout(() => {
          viewRef.current?.setNativeProps({
            style: { opacity: 0 }
          });
          setPointerEvents('none');
          hasHiddenRef.current = true;
          hasBeenInactive = false;
        }, hasBeenInactive ? 1000 : 100); // Longer delay if coming from background
      }
    });

    return () => {
      subscription.remove();
      clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <View
      ref={viewRef}
      pointerEvents={pointerEvents}
      style={[
        styles.splashContainer,
        {
          opacity: 1, // Always start visible
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        }
      ]}
    >
      <Icon name="ducat_logo" size={100} />
      <StatusBar style="light" />
    </View>
  );
}
