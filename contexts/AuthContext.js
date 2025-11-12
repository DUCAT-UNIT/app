/**
 * AuthContext - Provides authentication and onboarding state to the entire app
 * Wraps the existing useAuth hook and includes onboarding flow state
 * Consolidates AuthContext + OnboardingFlowContext
 */

import React, { createContext, useContext, useState, useRef } from 'react';
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

  // Reset wallet and all onboarding state
  const resetWalletAndState = async () => {
    await SecureStore.deleteItemAsync(SECURE_KEYS.MNEMONIC);
    await SecureStore.deleteItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    await resetOnboardingState();
    if (resetWallet) {
      resetWallet();
    }
    setSeedConfirmed(false);
  };

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  };

  // ============================================================
  // CONSOLIDATED VALUE
  // ============================================================
  const value = {
    // Auth state and methods (from useAuth hook)
    ...authState,
    // Onboarding namespace
    onboarding: {
      seedConfirmed,
      setSeedConfirmed,
      seedConfirmedRef,
      resetWalletAndState,
      resetInactivityTimer,
      inactivityTimerRef,
      amountInputRef,
    },
    // Direct exports for backwards compatibility
    seedConfirmed,
    setSeedConfirmed,
    seedConfirmedRef,
    resetWalletAndState,
    resetInactivityTimer,
    inactivityTimerRef,
    amountInputRef,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
  onSeedConfirmed: PropTypes.func,
  resetWallet: PropTypes.func,
};
