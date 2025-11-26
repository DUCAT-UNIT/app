/**
 * useSettingsNavigation Hook
 * Manages settings screen navigation including:
 * - Settings visibility and animation
 * - Swipe-to-close gesture
 * - Return-to-settings flow after auth operations
 * - Initial flag checking to prevent flicker
 */

import { useState, useRef, useEffect, useLayoutEffect, MutableRefObject } from 'react';
import { Animated, PanResponder, Dimensions, PanResponderInstance, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useSeedPhrase } from '../contexts/SeedPhraseContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UseSettingsNavigationReturn {
  showSettings: boolean;
  hasCheckedInitialFlags: boolean;
  settingsTranslateX: Animated.Value;
  settingsOpacity: Animated.Value;
  settingsPanResponderRef: MutableRefObject<PanResponderInstance | null>;
  openSettings: () => void;
  closeSettings: () => void;
}

export function useSettingsNavigation(): UseSettingsNavigationReturn {
  const { viewingSeedPhrase, returnToSettings, setReturnToSettings } = useSeedPhrase();

  // State
  const [showSettings, setShowSettings] = useState(false);
  const [hasCheckedInitialFlags, setHasCheckedInitialFlags] = useState(false);

  // Animated values
  const settingsTranslateX = useRef(new Animated.Value(0)).current;
  const settingsOpacity = useRef(new Animated.Value(0)).current;
  const settingsPanResponderRef = useRef<PanResponderInstance | null>(null);
  const checkingFlags = useRef(false);
  const prevShowSettings = useRef(showSettings);

  // Create settings pan responder (swipe-to-close)
  if (!settingsPanResponderRef.current) {
    settingsPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (gestureState.dx > 0) {
          settingsTranslateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (gestureState.dx > SCREEN_WIDTH * 0.4) {
          Animated.timing(settingsTranslateX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setShowSettings(false);
            settingsTranslateX.setValue(0);
          });
        } else {
          Animated.spring(settingsTranslateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    });
  }

  // Check flags before first render to prevent flicker
  useLayoutEffect(() => {
    const checkFlagsSync = async () => {
      const shouldReturnAuth = await SecureStore.getItemAsync('returnToSettingsAfterAuth');
      const shouldReturnPinChange = await SecureStore.getItemAsync(
        'returnToSettingsAfterPinChange'
      );
      const shouldReturnSeedPhrase = await SecureStore.getItemAsync(
        'returnToSettingsAfterSeedPhrase'
      );

      if (
        shouldReturnAuth === 'true' ||
        shouldReturnPinChange === 'true' ||
        shouldReturnSeedPhrase === 'true'
      ) {
        // Set settings visible immediately without animation
        settingsOpacity.setValue(1);
        settingsTranslateX.setValue(0);
        setShowSettings(true);
      }

      setHasCheckedInitialFlags(true);
    };
    checkFlagsSync();
  }, [settingsOpacity, settingsTranslateX]);

  // Check when screen comes into focus if we should open settings
  useFocusEffect(
    useRef(() => {
      const checkReturnToSettings = async () => {
        // Prevent multiple simultaneous checks
        if (checkingFlags.current) {
          return;
        }

        checkingFlags.current = true;

        const shouldReturnSeedPhrase = await SecureStore.getItemAsync(
          'returnToSettingsAfterSeedPhrase'
        );
        const shouldReturnPinChange = await SecureStore.getItemAsync(
          'returnToSettingsAfterPinChange'
        );
        const shouldReturnAuth = await SecureStore.getItemAsync('returnToSettingsAfterAuth');

        if (
          shouldReturnSeedPhrase === 'true' ||
          shouldReturnPinChange === 'true' ||
          shouldReturnAuth === 'true'
        ) {
          // Open settings
          settingsTranslateX.setValue(0);
          setShowSettings(true);
          // Clear the flags
          await SecureStore.deleteItemAsync('returnToSettingsAfterSeedPhrase');
          await SecureStore.deleteItemAsync('returnToSettingsAfterPinChange');
          await SecureStore.deleteItemAsync('returnToSettingsAfterAuth');
          setReturnToSettings(false);
        }

        checkingFlags.current = false;
      };
      checkReturnToSettings();
    }).current
  );

  // Watch for seed phrase closing - if returnToSettings is true, re-open settings
  useEffect(() => {
    if (!viewingSeedPhrase && returnToSettings) {
      // Seed phrase just closed and we should return to settings
      setShowSettings(true);
      settingsTranslateX.setValue(0);
      setReturnToSettings(false);
    }
  }, [viewingSeedPhrase, returnToSettings, settingsTranslateX, setReturnToSettings]);

  // Handle settings opacity to prevent flicker
  if (showSettings && !prevShowSettings.current) {
    // Just opened - make visible
    settingsTranslateX.setValue(0);
    settingsOpacity.setValue(1);
  } else if (!showSettings && prevShowSettings.current) {
    // Just closed - force invisible immediately to prevent flicker
    settingsOpacity.setValue(0);
  }
  prevShowSettings.current = showSettings;

  // Helper functions
  const openSettings = (): void => {
    settingsTranslateX.setValue(0);
    setShowSettings(true);
  };

  const closeSettings = (): void => {
    settingsTranslateX.setValue(0);
    setShowSettings(false);
  };

  return {
    // State
    showSettings,
    hasCheckedInitialFlags,

    // Animation values
    settingsTranslateX,
    settingsOpacity,
    settingsPanResponderRef,

    // Functions
    openSettings,
    closeSettings,
  };
}
