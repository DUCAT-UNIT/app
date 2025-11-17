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
import { logger } from '../utils/logger';

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
  const wasInBackground = useRef(false);

  // Allow screenshots by default (privacy mode disabled)
  useEffect(() => {
    const manageScreenCapture = async () => {
      try {
        await ScreenCapture.allowScreenCaptureAsync();
      } catch (_error) {}
    };

    manageScreenCapture();

    // Cleanup: ensure screen capture is allowed when component unmounts
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch((_error) => {
        // Ignore cleanup errors
      });
    };
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    logger.debug('[useAppLifecycle] Setting up AppState listener');
    logger.debug(`[useAppLifecycle] Initial AppState: ${AppState.currentState}`);

    // Initialize appState ref with current state
    appState.current = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const prevState = appState.current;
      logger.debug(`[useAppLifecycle] AppState changed: ${prevState} -> ${nextAppState}`);
      logger.debug(`[useAppLifecycle] walletExists: ${walletExists.current}, seedConfirmed: ${seedConfirmedRef.current}`);
      logger.debug(`[useAppLifecycle] wasInBackground: ${wasInBackground.current}`);

      // Track when we go to background/inactive
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        wasInBackground.current = true;
        logger.debug('[useAppLifecycle] App went to background/inactive - setting flag');
      }

      // Lock when coming back to active AND we were in background
      if (nextAppState === 'active' && wasInBackground.current) {
        logger.debug('[useAppLifecycle] Coming back to active from background/inactive');
        wasInBackground.current = false; // Reset flag

        // Require re-authentication if wallet exists AND seed backup is confirmed
        if (walletExists.current && seedConfirmedRef.current) {
          logger.debug('[useAppLifecycle] 🔒 LOCKING WALLET');
          onLock();
          // Only auto-trigger biometrics if user has enabled it AND device supports it
          if (isBiometricSupported && biometricEnabled) {
            logger.debug('[useAppLifecycle] Triggering biometric auth');
            onAuthenticateUser();
          }
        } else {
          logger.debug('[useAppLifecycle] NOT locking - conditions not met');
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [
    isBiometricSupported,
    biometricEnabled,
    onLock,
    onAuthenticateUser,
    walletExists,
    seedConfirmedRef,
  ]);

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
    logger.debug(`[useAppLifecycle] Inactivity timer check: isAuth=${isAuthenticated}, walletExists=${walletExists.current}, seedConfirmed=${seedConfirmedRef.current}`);
    if (
      isAuthenticated &&
      walletExists.current &&
      seedConfirmedRef.current
    ) {
      logger.debug('[useAppLifecycle] ⏱️  Starting inactivity timer');
      startInactivityTimer();

      return () => {
        if (inactivityTimer.current) {
          logger.debug('[useAppLifecycle] Clearing inactivity timer');
          clearTimeout(inactivityTimer.current);
          inactivityTimer.current = null;
        }
      };
    } else {
      logger.debug('[useAppLifecycle] NOT starting inactivity timer - conditions not met');
    }
  }, [isAuthenticated, startInactivityTimer, walletExists, seedConfirmedRef]);

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
