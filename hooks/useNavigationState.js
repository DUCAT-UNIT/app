/**
 * Navigation State Hook
 * Determines which navigation flow to show (Auth vs Main)
 */

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useOnboardingFlow } from '../contexts/OnboardingFlowContext';

/**
 * Hook to determine navigation state
 * @returns {{shouldShowAuth: boolean, shouldShowPinOverlay: boolean}}
 */
export function useNavigationState() {
  const { isAuthenticated, changingPin, settingUpPin, showPinEntry } = useAuth();
  const { wallet } = useWallet();
  const { seedConfirmed } = useOnboardingFlow();

  const shouldShowAuth = useMemo(() => {
    // No wallet created yet - show onboarding
    if (!wallet) {
      return true;
    }

    // Wallet exists but seed not confirmed - show seed confirmation
    if (wallet && !seedConfirmed) {
      return true;
    }

    // Setting up PIN for the first time (not changing existing PIN)
    if (settingUpPin && !changingPin) {
      return true;
    }

    // Need to show PIN entry screen
    if (showPinEntry) {
      return true;
    }

    // User is not authenticated but has wallet and confirmed seed
    if (!isAuthenticated && wallet && seedConfirmed) {
      return true;
    }

    // All conditions passed - show main app
    return false;
  }, [wallet, seedConfirmed, settingUpPin, changingPin, showPinEntry, isAuthenticated]);

  const shouldShowPinOverlay = useMemo(() => {
    // Show PIN overlay when changing PIN (not first-time setup)
    return settingUpPin && changingPin;
  }, [settingUpPin, changingPin]);

  return {
    shouldShowAuth,
    shouldShowPinOverlay,
  };
}
