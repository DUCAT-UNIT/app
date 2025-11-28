/**
 * Navigation State Hook
 * Determines which navigation flow to show (Auth vs Main)
 */

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useOnboardingFlow } from '../contexts/AuthContext';

interface UseNavigationStateReturn {
  shouldShowAuth: boolean;
  shouldShowPinOverlay: boolean;
  shouldShowLockOverlay: boolean;
}

/**
 * Hook to determine navigation state
 */
export function useNavigationState(): UseNavigationStateReturn {
  const { isAuthenticated, changingPin, settingUpPin, showPinEntry } = useAuth();
  const { wallet } = useWallet();
  const { seedConfirmed } = useOnboardingFlow();

  // Show lock overlay when: has wallet, seed confirmed, but not authenticated
  // This keeps MainTabs mounted so data stays in memory for instant unlock
  const shouldShowLockOverlay = useMemo(() => {
    return !isAuthenticated && !!wallet && seedConfirmed && !settingUpPin && !showPinEntry;
  }, [isAuthenticated, wallet, seedConfirmed, settingUpPin, showPinEntry]);

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

    // NOTE: Removed the isAuthenticated check here!
    // When !isAuthenticated && wallet && seedConfirmed, we now show lock overlay instead
    // This keeps MainTabs mounted so data stays in memory

    // All conditions passed - show main app
    return false;
  }, [wallet, seedConfirmed, settingUpPin, changingPin, showPinEntry]);

  const shouldShowPinOverlay = useMemo(() => {
    // Show PIN overlay when changing PIN (not first-time setup)
    return settingUpPin && changingPin;
  }, [settingUpPin, changingPin]);

  return {
    shouldShowAuth,
    shouldShowPinOverlay,
    shouldShowLockOverlay,
  };
}
