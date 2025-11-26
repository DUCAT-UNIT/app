/**
 * AuthContext - Provides authentication and onboarding state to the entire app
 * Wraps the existing useAuth hook and includes onboarding flow state
 * Consolidates AuthContext + OnboardingFlowContext
 */

import React, { createContext, useContext, useState, useRef, useMemo, useCallback, ReactNode, MutableRefObject } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth as useAuthHook } from '../hooks/useAuth';
import { SECURE_KEYS } from '../utils/constants';
import { resetOnboardingState } from '../utils/onboardingHelpers';
import { TextInput } from 'react-native';

// Type for the auth hook return value
interface AuthHookReturn {
  isAuthenticated: boolean;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  isBiometricSupported: boolean;
  biometricEnabled: boolean;
  setBiometricEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showBiometricPrompt: boolean;
  setShowBiometricPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  showFaceIdButton: boolean;
  setShowFaceIdButton: React.Dispatch<React.SetStateAction<boolean>>;
  isPasskeySupported: boolean;
  passkeyEnabled: boolean;
  setPasskeyEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  showPasskeyPrompt: boolean;
  setShowPasskeyPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  settingUpPin: boolean;
  setSettingUpPin: React.Dispatch<React.SetStateAction<boolean>>;
  changingPin: boolean;
  setChangingPin: React.Dispatch<React.SetStateAction<boolean>>;
  showPinEntry: boolean;
  setShowPinEntry: React.Dispatch<React.SetStateAction<boolean>>;
  pin: string;
  setPin: React.Dispatch<React.SetStateAction<string>>;
  confirmPin: string;
  setConfirmPin: React.Dispatch<React.SetStateAction<string>>;
  pinError: string;
  setPinError: React.Dispatch<React.SetStateAction<string>>;
  pinStep: 'enter' | 'confirm';
  setPinStep: React.Dispatch<React.SetStateAction<'enter' | 'confirm'>>;
  loadBiometricPreference: () => Promise<void>;
  loadPasskeyPreference: () => Promise<void>;
  authenticateWithPasskey: () => Promise<boolean>;
  authenticateUser: () => Promise<void>;
  handlePinSubmit: (enteredPin: string, showToast: (msg: string, type?: string) => void) => Promise<boolean>;
  startPinChange: () => void;
  cancelPinSetup: () => void;
  handlePinSetupComplete: () => void;
  handlePinChangeComplete: () => void;
  resetAuth: () => void;
}

export interface OnboardingState {
  seedConfirmed: boolean;
  setSeedConfirmed: React.Dispatch<React.SetStateAction<boolean>>;
  seedConfirmedRef: MutableRefObject<boolean>;
  resetWalletAndState: () => Promise<void>;
  resetInactivityTimer: () => void;
  inactivityTimerRef: MutableRefObject<NodeJS.Timeout | null>;
  amountInputRef: MutableRefObject<TextInput | null>;
}

export interface AuthContextValue extends AuthHookReturn {
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
  const authState = useAuthHook({ onSeedConfirmed }) as unknown as AuthHookReturn;

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
