/**
 * useAppLifecycle Hook
 * Manages app lifecycle events including:
 * - Screen capture prevention (always enabled for security)
 * - App state changes (background/foreground)
 * - Inactivity timer for auto-lock
 * - Cleanup on unmount
 */

import { useEffect, useRef, useCallback, MutableRefObject } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { logger } from '../utils/logger';

const INACTIVITY_TIMEOUT = 30 * 1000; // 30 seconds in milliseconds

interface UseAppLifecycleParams {
  isAuthenticated: boolean;
  walletExists: MutableRefObject<boolean>;
  seedConfirmedRef: MutableRefObject<boolean>;
  isBiometricSupported: boolean;
  biometricEnabled: boolean;
  onLock: () => void;
  onAuthenticateUser: () => void;
}

interface UseAppLifecycleReturn {
  resetInactivityTimer: () => void;
}

export function useAppLifecycle({
  isAuthenticated,
  walletExists,
  seedConfirmedRef,
  isBiometricSupported,
  biometricEnabled,
  onLock,
  onAuthenticateUser,
}: UseAppLifecycleParams): UseAppLifecycleReturn {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasInBackground = useRef(false);

  // Use refs for callbacks to avoid stale closures in timers
  const onLockRef = useRef(onLock);
  const onAuthenticateUserRef = useRef(onAuthenticateUser);

  // Keep refs updated
  useEffect(() => {
    onLockRef.current = onLock;
  }, [onLock]);

  useEffect(() => {
    onAuthenticateUserRef.current = onAuthenticateUser;
  }, [onAuthenticateUser]);

  // Allow screenshots by default
  useEffect(() => {
    const manageScreenCapture = async () => {
      try {
        await ScreenCapture.allowScreenCaptureAsync();
      } catch (error: unknown) {
        // Non-critical: screen capture permissions may not be available on all devices
        logger.debug('[useAppLifecycle] Screen capture setup skipped', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    manageScreenCapture();

    // Cleanup: ensure screen capture is allowed when component unmounts
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch((error) => {
        // Cleanup errors are expected and non-critical, but log for debugging
        logger.debug('[useAppLifecycle] Screen capture cleanup failed (non-critical)', {
          error: error instanceof Error ? error.message : String(error)
        });
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

      // Track when we go to background (NOT inactive - that triggers Face ID, control center, etc.)
      if (nextAppState === 'background') {
        wasInBackground.current = true;
        logger.debug('[useAppLifecycle] App went to background - setting flag');
      }

      // Lock when coming back to active AND we were in background
      if (nextAppState === 'active' && wasInBackground.current) {
        logger.debug('[useAppLifecycle] Coming back to active from background');
        wasInBackground.current = false; // Reset flag

        // Require re-authentication if wallet exists AND seed backup is confirmed
        if (walletExists.current && seedConfirmedRef.current) {
          logger.debug('[useAppLifecycle] 🔒 LOCKING WALLET');
          onLockRef.current();
          // Only auto-trigger biometrics if user has enabled it AND device supports it
          if (isBiometricSupported && biometricEnabled) {
            logger.debug('[useAppLifecycle] Triggering biometric auth');
            onAuthenticateUserRef.current();
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
    walletExists,
    seedConfirmedRef,
  ]); // onLock and onAuthenticateUser use refs to avoid stale closures

  // Inactivity timer - locks wallet after inactivity
  const startInactivityTimer = useCallback(() => {
    // Clear any existing timer
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    // Set new timer
    inactivityTimer.current = setTimeout(() => {
      // Lock the wallet after inactivity timeout
      logger.info('[useAppLifecycle] ⏱️ Inactivity timeout reached - locking wallet');
      onLockRef.current();
    }, INACTIVITY_TIMEOUT);
  }, []); // No deps needed - uses ref for latest callback

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
