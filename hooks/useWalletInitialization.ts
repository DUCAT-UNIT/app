/**
 * useWalletInitialization - Handles wallet loading and initialization on app start
 */

import { useState, useEffect, MutableRefObject } from 'react';

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
}

export const useWalletInitialization = ({
  loadWallet,
  loadBiometricPreference,
  setSeedConfirmed,
  setIsAuthenticated,
  walletExistsRef,
}: UseWalletInitializationParams): UseWalletInitializationReturn => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeWallet = async () => {
      try {
        // Load biometric preference and wallet in parallel for speed
        const [, result] = await Promise.all([
          loadBiometricPreference(),
          loadWallet(),
        ]);

        if (result.exists) {
          // Wallet exists - set up auth flow
          setSeedConfirmed(true);
          walletExistsRef.current = true;
          setIsAuthenticated(false); // Show locked screen
        } else {
          // No wallet exists - allow access to create/import screen
          walletExistsRef.current = false;
          setIsAuthenticated(true);
        }
      } catch (error: unknown) {
        // Silently handle errors, allow user to proceed
      } finally {
        // Immediately show the app - no artificial delay
        setIsLoading(false);
      }
    };

    initializeWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return { isLoading };
};
