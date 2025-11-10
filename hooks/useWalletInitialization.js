/**
 * useWalletInitialization - Handles wallet loading and initialization on app start
 */

import { useState, useEffect } from 'react';

export const useWalletInitialization = ({
  loadWallet,
  loadBiometricPreference,
  setSeedConfirmed,
  setIsAuthenticated,
  walletExistsRef,
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeWallet = async () => {
      try {
        // Load biometric preference from storage
        await loadBiometricPreference();

        // Load wallet using context (handles addresses and balances)
        const result = await loadWallet();

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
      } catch (error) {
        // Silently handle errors, allow user to proceed
      } finally {
        // Hide loading screen after a brief delay to show the logo
        setTimeout(() => setIsLoading(false), 1500);
      }
    };

    initializeWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return { isLoading };
};
