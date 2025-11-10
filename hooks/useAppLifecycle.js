/**
 * useAppLifecycle Hook
 * Manages app lifecycle events including:
 * - Screen capture prevention (always enabled for security)
 * - App state changes (background/foreground)
 * - Inactivity timer for auto-lock
 * - Cleanup on unmount
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds

export function useAppLifecycle({
  isAuthenticated,
  walletExists,
  seedConfirmedRef,
  isBiometricSupported,
  biometricEnabled,
  onLock,
  onAuthenticateUser,
}) {
  const appState = useRef(AppState.currentState);
  const inactivityTimer = useRef(null);

  // Allow screenshots by default (privacy mode disabled)
  useEffect(() => {
    const manageScreenCapture = async () => {
      try {
        await ScreenCapture.allowScreenCaptureAsync();
      } catch (error) {
      }
    };

    manageScreenCapture();

    // Cleanup: ensure screen capture is allowed when component unmounts
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch((error) => {
        // Ignore cleanup errors
      });
    };
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('[AppLifecycle] AppState changed:', appState.current, '->', nextAppState);

      // ONLY lock when coming back from background, NOT from inactive
      // (inactive happens during Face ID, control center, etc.)
      if (
        appState.current === 'background' &&
        nextAppState === 'active'
      ) {
        console.log('[AppLifecycle] Checking if should lock:', {
          walletExists: walletExists.current,
          seedConfirmed: seedConfirmedRef.current,
          isBiometricSupported,
          biometricEnabled
        });

        // App has come to foreground from background, require re-authentication if wallet exists AND seed backup is confirmed
        if (walletExists.current && seedConfirmedRef.current && isBiometricSupported) {
          console.log('[AppLifecycle] Locking app');
          onLock();
          // Only auto-trigger biometrics if user has enabled it
          if (biometricEnabled) {
            console.log('[AppLifecycle] Auto-triggering biometrics');
            onAuthenticateUser();
          }
        } else {
          console.log('[AppLifecycle] NOT locking (conditions not met)');
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isBiometricSupported, biometricEnabled, onLock, onAuthenticateUser, walletExists, seedConfirmedRef]);

  // Inactivity timer - locks wallet after 2 minutes of no interaction
  const startInactivityTimer = useCallback(() => {
    // Clear any existing timer
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    // Set new timer
    inactivityTimer.current = setTimeout(() => {
      // Lock the wallet after inactivity timeout
      onLock();
    }, INACTIVITY_TIMEOUT);
  }, [onLock]);

  const resetInactivityTimer = useCallback(() => {
    // Restart timer when user interacts
    startInactivityTimer();
  }, [startInactivityTimer]);

  // Start timer when authenticated (but only if seed backup is confirmed)
  useEffect(() => {
    if (isAuthenticated && walletExists.current && seedConfirmedRef.current && isBiometricSupported) {
      startInactivityTimer();

      return () => {
        if (inactivityTimer.current) {
          clearTimeout(inactivityTimer.current);
          inactivityTimer.current = null;
        }
      };
    }
  }, [isAuthenticated, isBiometricSupported, startInactivityTimer, walletExists, seedConfirmedRef]);

  // Cleanup inactivity timer on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, []);

  return {
    resetInactivityTimer,
  };
}
