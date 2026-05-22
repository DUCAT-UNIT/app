/**
 * useAppLifecycle Hook
 * Manages app lifecycle events including:
 * - App state changes (background/foreground)
 * - Inactivity timer for auto-lock
 * - Cleanup on unmount
 */

import { useEffect, useRef, useCallback, MutableRefObject } from 'react';
import { AppState, AppStateStatus, Platform, PlatformIOSStatic } from 'react-native';

const IS_IPAD = Platform.OS === 'ios' && (Platform as PlatformIOSStatic).isPad === true;
import { logger } from '../utils/logger';
import {
  startDerivedKeyCacheLifecycle,
  stopDerivedKeyCacheLifecycle,
} from '../utils/wallet/keyDerivation';
import { isE2E } from '../utils/e2e';

const INACTIVITY_TIMEOUT = __DEV__ ? 600 * 1000 : 30 * 1000; // 10 min dev, 30s prod

interface UseAppLifecycleParams {
  isAuthenticated: boolean;
  walletExists: MutableRefObject<boolean>;
  seedConfirmedRef: MutableRefObject<boolean>;
  isBiometricSupported: boolean;
  biometricEnabled: boolean;
  isProcessing?: boolean;
  inactivityTimeoutMs?: number;
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
  isProcessing = false,
  inactivityTimeoutMs = INACTIVITY_TIMEOUT,
  onLock,
  onAuthenticateUser,
}: UseAppLifecycleParams): UseAppLifecycleReturn {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasInBackground = useRef(false);
  const lastResetAtRef = useRef(0);
  const wasProcessingRef = useRef(isProcessing);

  // Use refs for callbacks and state to avoid stale closures in timers
  const onLockRef = useRef(onLock);
  const onAuthenticateUserRef = useRef(onAuthenticateUser);
  const isProcessingRef = useRef(isProcessing);
  const isBiometricSupportedRef = useRef(isBiometricSupported);
  const biometricEnabledRef = useRef(biometricEnabled);

  // Keep refs updated
  useEffect(() => {
    onLockRef.current = onLock;
  }, [onLock]);

  useEffect(() => {
    onAuthenticateUserRef.current = onAuthenticateUser;
  }, [onAuthenticateUser]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    isBiometricSupportedRef.current = isBiometricSupported;
  }, [isBiometricSupported]);

  useEffect(() => {
    biometricEnabledRef.current = biometricEnabled;
  }, [biometricEnabled]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    logger.debug('[useAppLifecycle] Setting up AppState listener');
    logger.debug(`[useAppLifecycle] Initial AppState: ${AppState.currentState}`);

    // Initialize appState ref with current state
    appState.current = AppState.currentState;
    startDerivedKeyCacheLifecycle();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const prevState = appState.current;
      logger.debug(`[useAppLifecycle] AppState changed: ${prevState} -> ${nextAppState}`);
      logger.debug(
        `[useAppLifecycle] walletExists: ${walletExists.current}, seedConfirmed: ${seedConfirmedRef.current}`
      );
      logger.debug(`[useAppLifecycle] wasInBackground: ${wasInBackground.current}`);

      // Track when we go to background (NOT inactive - that triggers Face ID, control center, etc.)
      if (nextAppState === 'background') {
        wasInBackground.current = true;
        logger.debug('[useAppLifecycle] App went to background - setting flag');
      }

      // Lock when coming back to active AND we were in background (skip in E2E)
      if (nextAppState === 'active' && wasInBackground.current && !isE2E()) {
        logger.debug('[useAppLifecycle] Coming back to active from background');
        wasInBackground.current = false; // Reset flag

        // Require re-authentication if wallet exists AND seed backup is confirmed
        if (walletExists.current && seedConfirmedRef.current) {
          logger.debug('[useAppLifecycle] 🔒 LOCKING WALLET');
          onLockRef.current();
          // Only auto-trigger biometrics if user has enabled it AND device supports it
          // Skip on iPad — iPhone compatibility mode can cause the native biometric
          // dialog to hang or render incorrectly, leading to a frozen UI.
          // iPad users will see the PIN screen and can tap the Face ID button manually.
          if (isBiometricSupportedRef.current && biometricEnabledRef.current && !IS_IPAD) {
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
      stopDerivedKeyCacheLifecycle();
    };
  }, [walletExists, seedConfirmedRef]); // auth and biometric state use refs to avoid listener churn

  // Inactivity timer - locks wallet after inactivity
  const startInactivityTimer = useCallback(() => {
    // Clear any existing timer
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    // Set new timer
    inactivityTimer.current = setTimeout(
      () => {
        // Don't lock during active transaction processing
        if (isProcessingRef.current) {
          logger.debug(
            '[useAppLifecycle] Inactivity timeout reached but processing active; deferring lock'
          );
          startInactivityTimer();
          return;
        }
        // Lock the wallet after inactivity timeout
        logger.info('[useAppLifecycle] Inactivity timeout reached; locking wallet');
        onLockRef.current();
      },
      Math.max(1000, inactivityTimeoutMs)
    );
  }, [inactivityTimeoutMs]); // Callback refs supply latest lock/auth state.

  const resetInactivityTimer = useCallback(() => {
    const now = Date.now();
    if (lastResetAtRef.current > 0 && now - lastResetAtRef.current < 1000) {
      return;
    }
    lastResetAtRef.current = now;
    // Restart timer when user interacts
    startInactivityTimer();
  }, [startInactivityTimer]);

  useEffect(() => {
    const wasProcessing = wasProcessingRef.current;
    wasProcessingRef.current = isProcessing;

    if (
      wasProcessing &&
      !isProcessing &&
      isAuthenticated &&
      walletExists.current &&
      seedConfirmedRef.current
    ) {
      logger.debug('[useAppLifecycle] Processing finished - refreshing inactivity timer');
      startInactivityTimer();
    }
  }, [isAuthenticated, isProcessing, seedConfirmedRef, startInactivityTimer, walletExists]);

  // Start timer when authenticated (but only if seed backup is confirmed)
  useEffect(() => {
    logger.debug(
      `[useAppLifecycle] Inactivity timer check: isAuth=${isAuthenticated}, walletExists=${walletExists.current}, seedConfirmed=${seedConfirmedRef.current}`
    );
    if (isAuthenticated && walletExists.current && seedConfirmedRef.current) {
      logger.debug('[useAppLifecycle] Starting inactivity timer');
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
