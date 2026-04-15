/**
 * useWalletInitialization - Handles wallet loading and initialization on app start
 */

import { useState, useEffect, useCallback, MutableRefObject } from 'react';
import { logger } from '../utils/logger';
import { analytics } from '../services/analyticsService';
import { STARTUP_EVENTS } from '../constants/analyticsEvents';

// Safety timeout — if wallet init hasn't resolved after 10s, give up and show
// the error/retry screen instead of staying stuck on the splash screen forever.
// This prevents the "frozen on splash" rejection from Apple.
const INIT_TIMEOUT_MS = 10000;

interface LoadWalletResult {
  exists: boolean;
  [key: string]: unknown;
}

interface UseWalletInitializationParams {
  loadWallet: () => Promise<LoadWalletResult>;
  loadBiometricPreference: () => Promise<void>;
  setSeedConfirmed: (value: boolean) => void;
  setIsAuthenticated: (value: boolean) => void;
  walletExistsRef: MutableRefObject<boolean>;
}

interface UseWalletInitializationReturn {
  isLoading: boolean;
  initializationError: string | null;
  retryInitialization: () => Promise<void>;
}

export const useWalletInitialization = ({
  loadWallet,
  loadBiometricPreference,
  setSeedConfirmed,
  setIsAuthenticated,
  walletExistsRef,
}: UseWalletInitializationParams): UseWalletInitializationReturn => {
  const [isLoading, setIsLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    const initializeWallet = async () => {
      setIsLoading(true);
      setInitializationError(null);

      const t0 = Date.now();
      try {
        // Load biometric preference and wallet in parallel for speed.
        // Race against a timeout so the app never stays stuck on the splash screen.
        // Each sub-op is tracked individually so PostHog shows which one hung.
        const biometricPromise = loadBiometricPreference().then(() => {
          analytics.track(STARTUP_EVENTS.STARTUP_CHECKPOINT, {
            gate: 'biometric_pref_loaded', elapsed_ms: Date.now() - t0,
          });
        });

        const walletPromise = loadWallet().then((r) => {
          analytics.track(STARTUP_EVENTS.STARTUP_CHECKPOINT, {
            gate: 'wallet_loaded', elapsed_ms: Date.now() - t0,
            wallet_exists: r?.exists ?? false,
          });
          return r;
        });

        const initPromise = Promise.all([biometricPromise, walletPromise]);

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => {
            analytics.track(STARTUP_EVENTS.STARTUP_TIMEOUT, {
              elapsed_ms: Date.now() - t0, timeout_ms: INIT_TIMEOUT_MS,
            });
            analytics.flush(); // Force-send before we might get stuck
            reject(new Error('Wallet initialization timed out'));
          }, INIT_TIMEOUT_MS),
        );

        const [, result] = await Promise.race([initPromise, timeoutPromise]);

        if (!result || typeof result.exists !== 'boolean') {
          throw new Error('Wallet initialization returned an invalid result');
        }

        if (result.exists) {
          // Wallet exists - set up auth flow
          setSeedConfirmed(true);
          walletExistsRef.current = true;
          setIsAuthenticated(false); // Show locked screen
        } else {
          // No wallet exists - allow access to create/import screen
          setSeedConfirmed(false);
          walletExistsRef.current = false;
          setIsAuthenticated(true);
        }

        analytics.track(STARTUP_EVENTS.STARTUP_COMPLETE, {
          elapsed_ms: Date.now() - t0, wallet_exists: result.exists,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize wallet';
        logger.error('[useWalletInitialization] Wallet initialization failed', {
          error: errorMessage,
        });
        analytics.track(STARTUP_EVENTS.STARTUP_TIMEOUT, {
          elapsed_ms: Date.now() - t0, error: errorMessage,
        });
        analytics.flush();
        setSeedConfirmed(false);
        walletExistsRef.current = false;
        setIsAuthenticated(false);
        setInitializationError(errorMessage);
      } finally {
        // Immediately show the app - no artificial delay
        setIsLoading(false);
      }
    };

    initializeWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const retryInitialization = useCallback(async (): Promise<void> => {
    setInitializationError(null);
    setIsLoading(true);

    try {
      const initPromise = Promise.all([
        loadBiometricPreference(),
        loadWallet(),
      ]);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Wallet initialization timed out')),
          INIT_TIMEOUT_MS,
        ),
      );

      const [, result] = await Promise.race([initPromise, timeoutPromise]);

      if (!result || typeof result.exists !== 'boolean') {
        throw new Error('Wallet initialization returned an invalid result');
      }

      if (result.exists) {
        setSeedConfirmed(true);
        walletExistsRef.current = true;
        setIsAuthenticated(false);
      } else {
        setSeedConfirmed(false);
        walletExistsRef.current = false;
        setIsAuthenticated(true);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize wallet';
      logger.error('[useWalletInitialization] Wallet initialization retry failed', {
        error: errorMessage,
      });
      setSeedConfirmed(false);
      walletExistsRef.current = false;
      setIsAuthenticated(false);
      setInitializationError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [loadWallet, loadBiometricPreference, setSeedConfirmed, setIsAuthenticated, walletExistsRef]);

  return { isLoading, initializationError, retryInitialization };
};
