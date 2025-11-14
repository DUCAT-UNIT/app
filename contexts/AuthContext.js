/**
 * AuthContext - Provides authentication and onboarding state to the entire app
 * Wraps the existing useAuth hook and includes onboarding flow state
 * Consolidates AuthContext + OnboardingFlowContext
 */

import React, { createContext, useContext, useState, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import * as SecureStore from 'expo-secure-store';
import { useAuth as useAuthHook } from '../hooks/useAuth';
import { SECURE_KEYS } from '../utils/constants';
import { resetOnboardingState } from '../utils/onboardingHelpers';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Backwards compatibility hook
export const useOnboardingFlow = () => {
  const { onboarding } = useAuth();
  return onboarding;
};

export const AuthProvider = ({ children, onSeedConfirmed, resetWallet }) => {
  const authState = useAuthHook({ onSeedConfirmed });

  // ============================================================
  // ONBOARDING FLOW STATE
  // ============================================================
  const [seedConfirmed, setSeedConfirmed] = useState(false);
  const seedConfirmedRef = useRef(false);
  const inactivityTimerRef = useRef(null);
  const amountInputRef = useRef(null);

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

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
  onSeedConfirmed: PropTypes.func,
  resetWallet: PropTypes.func,
};
