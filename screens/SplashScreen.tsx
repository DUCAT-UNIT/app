/**
 * SplashScreen Component
 * Displays the Ducat logo during launch and while the app is backgrounded.
 */

import React, { useEffect, useState } from 'react';
import { Animated, AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from '../components/icons';
import { useBackgroundSplash } from '../hooks/useBackgroundSplash';
import styles from '../styles';

type PointerEvents = 'auto' | 'none' | 'box-none' | 'box-only';

interface SplashScreenProps {
  mode?: 'launch' | 'background';
}

function LaunchSplashScreen(): React.JSX.Element {
  return (
    <View style={styles.splashContainer}>
      <Icon name="ducat_logo" size={113} />
      <StatusBar style="light" />
    </View>
  );
}

function BackgroundSplashScreen(): React.JSX.Element {
  const { opacityRef } = useBackgroundSplash();
  const [pointerEvents, setPointerEvents] = useState<PointerEvents>(
    AppState.currentState === 'active' ? 'none' : 'auto'
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setPointerEvents(nextAppState === 'active' ? 'none' : 'auto');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <Animated.View
      pointerEvents={pointerEvents}
      style={[
        styles.splashContainer,
        {
          opacity: opacityRef,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        }
      ]}
    >
      <Icon name="ducat_logo" size={113} />
      <StatusBar style="light" />
    </Animated.View>
  );
}

export default function SplashScreen({
  mode = 'launch',
}: SplashScreenProps): React.JSX.Element {
  if (mode === 'background') {
    return <BackgroundSplashScreen />;
  }

  return <LaunchSplashScreen />;
}
