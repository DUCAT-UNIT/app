/**
 * AuthContext - Provides authentication and onboarding state to the entire app
 * Wraps the existing useAuth hook and includes onboarding flow state
 * Consolidates AuthContext + OnboardingFlowContext
 */

import React, { createContext, useContext, useState, useRef, useMemo, useCallback, ReactNode, MutableRefObject } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth as useAuthHook, UseAuthReturn } from '../hooks/useAuth';
import { SECURE_KEYS } from '../utils/constants';
import { resetOnboardingState } from '../utils/onboardingHelpers';
import { TextInput } from 'react-native';

export interface OnboardingState {
  seedConfirmed: boolean;
  setSeedConfirmed: React.Dispatch<React.SetStateAction<boolean>>;
  seedConfirmedRef: MutableRefObject<boolean>;
  resetWalletAndState: () => Promise<void>;
  resetInactivityTimer: () => void;
  inactivityTimerRef: MutableRefObject<NodeJS.Timeout | null>;
  amountInputRef: MutableRefObject<TextInput | null>;
}

export interface AuthContextValue extends UseAuthReturn {
  onboarding: OnboardingState;
  seedConfirmed: boolean;
  setSeedConfirmed: React.Dispatch<React.SetStateAction<boolean>>;
  seedConfirmedRef: MutableRefObject<boolean>;
  resetWalletAndState: () => Promise<void>;
  resetInactivityTimer: () => void;
  inactivityTimerRef: MutableRefObject<NodeJS.Timeout | null>;
  amountInputRef: MutableRefObject<TextInput | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Backwards compatibility hook
export const useOnboardingFlow = (): OnboardingState => {
  const { onboarding } = useAuth();
  return onboarding;
};

interface AuthProviderProps {
  children: ReactNode;
  onSeedConfirmed?: () => void;
  resetWallet?: () => void;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, onSeedConfirmed, resetWallet }) => {
  const authState: UseAuthReturn = useAuthHook({ onSeedConfirmed });

  // ============================================================
  // ONBOARDING FLOW STATE
  // ============================================================
  const [seedConfirmed, setSeedConfirmed] = useState(false);
  const seedConfirmedRef = useRef(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const amountInputRef = useRef<TextInput | null>(null);

  // Keep ref in sync with state
  React.useEffect(() => {
    seedConfirmedRef.current = seedConfirmed;
  }, [seedConfirmed]);

  // Reset wallet and all onboarding state - memoized to prevent recreation
  const resetWalletAndState = useCallback(async () => {
    await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
    await SecureStore.deleteItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    await resetOnboardingState();
    if (resetWallet) {
      resetWallet();
    }
    setSeedConfirmed(false);
  }, [resetWallet]);

  // Reset inactivity timer - memoized to prevent recreation
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  }, []);

  // ============================================================
  // CONSOLIDATED VALUE - Memoized to prevent infinite re-renders
  // ============================================================
  const onboarding = useMemo(
    () => ({
      seedConfirmed,
      setSeedConfirmed,
      seedConfirmedRef,
      resetWalletAndState,
      resetInactivityTimer,
      inactivityTimerRef,
      amountInputRef,
    }),
    [seedConfirmed, resetWalletAndState, resetInactivityTimer]
  );

  const value = useMemo(
    () => ({
      // Auth state and methods (from useAuth hook)
      ...authState,
      // Onboarding namespace
      onboarding,
      // Direct exports for backwards compatibility
      seedConfirmed,
      setSeedConfirmed,
      seedConfirmedRef,
      resetWalletAndState,
      resetInactivityTimer,
      inactivityTimerRef,
      amountInputRef,
    }),
    [authState, onboarding, seedConfirmed, resetWalletAndState, resetInactivityTimer]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
