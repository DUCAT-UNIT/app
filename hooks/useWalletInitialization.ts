/**
 * useWalletInitialization - Handles wallet loading and initialization on app start
 */

import { useState, useEffect, MutableRefObject } from 'react';
import { logger } from '../utils/logger';

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

      try {
        // Load biometric preference and wallet in parallel for speed
        const [, result] = await Promise.all([
          loadBiometricPreference(),
          loadWallet(),
        ]);

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
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize wallet';
        logger.error('[useWalletInitialization] Wallet initialization failed', {
          error: errorMessage,
        });
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

  const retryInitialization = async (): Promise<void> => {
    setInitializationError(null);
    setIsLoading(true);

    try {
      const [, result] = await Promise.all([
        loadBiometricPreference(),
        loadWallet(),
      ]);

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
  };

  return { isLoading, initializationError, retryInitialization };
};
