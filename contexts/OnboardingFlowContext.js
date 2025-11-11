/**
 * OnboardingFlowContext
 * Manages onboarding flow state: seed confirmation, reset wallet, inactivity
 */

import React, { createContext, useContext, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';
import { resetOnboardingState } from '../utils/onboardingHelpers';

const OnboardingFlowContext = createContext();

export const OnboardingFlowProvider = ({ children, resetWallet }) => {
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
    resetWallet();
    setSeedConfirmed(false);
  };

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  };

  const value = {
    seedConfirmed,
    setSeedConfirmed,
    seedConfirmedRef,
    resetWalletAndState,
    resetInactivityTimer,
    inactivityTimerRef,
    amountInputRef,
  };

  return <OnboardingFlowContext.Provider value={value}>{children}</OnboardingFlowContext.Provider>;
};

OnboardingFlowProvider.propTypes = {
  children: PropTypes.node.isRequired,
  resetWallet: PropTypes.func.isRequired,
};

export const useOnboardingFlow = () => {
  const context = useContext(OnboardingFlowContext);
  if (!context) {
    throw new Error('useOnboardingFlow must be used within OnboardingFlowProvider');
  }
  return context;
};
