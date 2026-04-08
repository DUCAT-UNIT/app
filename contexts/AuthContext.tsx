/**
 * AuthContext - Provides authentication and onboarding state to the entire app
 * Wraps the existing useAuth hook and includes onboarding flow state
 * Consolidates AuthContext + OnboardingFlowContext
 */

import React, { createContext, useContext, useState, useRef, useMemo, useCallback, ReactNode, MutableRefObject } from 'react';
import { useAuth as useAuthHook, UseAuthReturn } from '../hooks/useAuth';
import { resetOnboardingState } from '../utils/onboardingHelpers';
import { logger } from '../utils/logger';
import { analytics } from '../services/analyticsService';
import { SETTINGS_EVENTS } from '../constants/analyticsEvents';
import { TextInput } from 'react-native';
import { deleteWalletData } from '../services/secureStorageService';

// Rate limit: minimum interval between wallet resets (1 hour)
const WALLET_RESET_COOLDOWN_MS = 60 * 60 * 1000;
let lastWalletResetTimestamp = 0;

// Reset function for testing only — gated behind __DEV__ to prevent production use
export const _resetWalletRateLimitState: (() => void) | undefined = __DEV__
  ? () => { lastWalletResetTimestamp = 0; }
  : undefined;

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
  // SECURITY: Requires authentication and rate limiting to prevent unauthorized wallet wipe
  const resetWalletAndState = useCallback(async () => {
    if (!authState.isAuthenticated) {
      throw new Error('Authentication required to reset wallet');
    }

    // SECURITY: Rate limit wallet resets to prevent rapid repeated deletion
    const now = Date.now();
    if (lastWalletResetTimestamp > 0 && now - lastWalletResetTimestamp < WALLET_RESET_COOLDOWN_MS) {
      const remainingMin = Math.ceil(
        (WALLET_RESET_COOLDOWN_MS - (now - lastWalletResetTimestamp)) / 60000
      );
      logger.warn('[AuthContext] Wallet reset rate-limited', {
        lastResetAt: new Date(lastWalletResetTimestamp).toISOString(),
        remainingMin,
      });
      throw new Error(
        `Wallet was recently deleted. Please wait ${remainingMin} minute${remainingMin > 1 ? 's' : ''} before trying again.`
      );
    }

    // SECURITY: Audit log before destructive operation
    logger.warn('[AuthContext] Wallet reset initiated', {
      timestamp: new Date(now).toISOString(),
      action: 'resetWalletAndState',
    });

    await deleteWalletData();
    await resetOnboardingState();
    if (resetWallet) {
      resetWallet();
    }
    setSeedConfirmed(false);

    lastWalletResetTimestamp = now;

    analytics.track(SETTINGS_EVENTS.WALLET_DELETED);
    analytics.reset();
    logger.warn('[AuthContext] Wallet reset completed', {
      timestamp: new Date(now).toISOString(),
    });
  }, [resetWallet, authState.isAuthenticated]);

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

  // Destructure authState into individual stable values to avoid spread defeating memoization
  const {
    isAuthenticated,
    isBiometricSupported,
    biometricEnabled,
    showBiometricPrompt,
    showFaceIdButton,
    isPasskeySupported,
    passkeyEnabled,
        settingUpPin,
    changingPin,
    showPinEntry,
    pin,
    confirmPin,
    pinError,
    pinStep,
    setIsAuthenticated,
    setBiometricEnabled,
    setShowBiometricPrompt,
    setShowFaceIdButton,
    setPasskeyEnabled,

    setShowPinEntry,
    setSettingUpPin,
    setChangingPin,
    setPin,
    setConfirmPin,
    setPinError,
    setPinStep,
    authenticateUser,
    authenticateWithPasskey,
    handlePinSetupComplete,
    handlePinChangeComplete,
    handleLockScreenAuthenticated,
    loadBiometricPreference,
    loadPasskeyPreference,
    lock,
    resetAuth,
    startPinChange,
  } = authState;

  // TODO: Split AuthContext into AuthSessionContext (isAuthenticated, biometricEnabled, lock, resetAuth)
  // and PinFlowContext (pin, confirmPin, pinStep, pinError, etc.) to reduce re-render surface.
  // Currently, PIN keystroke changes re-render all useAuth() consumers including RootNavigator.
  const value = useMemo(
    () => ({
      // Auth state (from useAuth hook)
      isAuthenticated,
      isBiometricSupported,
      biometricEnabled,
      showBiometricPrompt,
      showFaceIdButton,
      isPasskeySupported,
      passkeyEnabled,
            settingUpPin,
      changingPin,
      showPinEntry,
      pin,
      confirmPin,
      pinError,
      pinStep,
      // Auth setters
      setIsAuthenticated,
      setBiometricEnabled,
      setShowBiometricPrompt,
      setShowFaceIdButton,
      setPasskeyEnabled,
  
      setShowPinEntry,
      setSettingUpPin,
      setChangingPin,
      setPin,
      setConfirmPin,
      setPinError,
      setPinStep,
      // Auth functions
      authenticateUser,
      authenticateWithPasskey,
      handlePinSetupComplete,
      handlePinChangeComplete,
      handleLockScreenAuthenticated,
      loadBiometricPreference,
      loadPasskeyPreference,
      lock,
      resetAuth,
      startPinChange,
      // Onboarding namespace
      onboarding,
    }),
    [
      isAuthenticated, isBiometricSupported, biometricEnabled, showBiometricPrompt,
      showFaceIdButton, isPasskeySupported, passkeyEnabled,       settingUpPin, changingPin, showPinEntry, pin, confirmPin, pinError, pinStep,
      setIsAuthenticated, setBiometricEnabled, setShowBiometricPrompt, setShowFaceIdButton,
      setPasskeyEnabled, setShowPinEntry, setSettingUpPin,
      setChangingPin, setPin, setConfirmPin, setPinError, setPinStep,
      authenticateUser, authenticateWithPasskey, handlePinSetupComplete,
      handlePinChangeComplete, handleLockScreenAuthenticated, loadBiometricPreference,
      loadPasskeyPreference, lock, resetAuth, startPinChange,
      onboarding,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
