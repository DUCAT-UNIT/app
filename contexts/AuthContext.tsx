/**
 * AuthContext - Provides authentication and onboarding state to the entire app
 * Wraps the existing useAuth hook and includes onboarding flow state
 * Consolidates AuthContext + OnboardingFlowContext
 */

import React, { createContext, useContext, useState, useRef, useMemo, useCallback, ReactNode, MutableRefObject } from 'react';
import { useAuth as useAuthHook, UseAuthReturn } from '../hooks/useAuth';
import { logger } from '../utils/logger';
import { analytics } from '../services/analyticsService';
import { SETTINGS_EVENTS } from '../constants/analyticsEvents';
import { TextInput } from 'react-native';
import { performFullWalletReset } from '../services/walletResetService';

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

export type AuthSessionContextValue = Pick<
  UseAuthReturn,
  | 'isAuthenticated'
  | 'isBiometricSupported'
  | 'biometricEnabled'
  | 'showBiometricPrompt'
  | 'showFaceIdButton'
  | 'isPasskeySupported'
  | 'passkeyEnabled'
  | 'setIsAuthenticated'
  | 'setBiometricEnabled'
  | 'setShowBiometricPrompt'
  | 'setShowFaceIdButton'
  | 'setPasskeyEnabled'
  | 'authenticateUser'
  | 'authenticateWithPasskey'
  | 'handleLockScreenAuthenticated'
  | 'loadBiometricPreference'
  | 'loadPasskeyPreference'
  | 'lock'
  | 'resetAuth'
>;

export type AuthPinFlowContextValue = Pick<
  UseAuthReturn,
  | 'settingUpPin'
  | 'changingPin'
  | 'showPinEntry'
  | 'pin'
  | 'confirmPin'
  | 'pinError'
  | 'pinStep'
  | 'setShowPinEntry'
  | 'setSettingUpPin'
  | 'setChangingPin'
  | 'setPin'
  | 'setConfirmPin'
  | 'setPinError'
  | 'setPinStep'
  | 'handlePinSetupComplete'
  | 'handlePinChangeComplete'
  | 'startPinChange'
>;

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);
const AuthPinFlowContext = createContext<AuthPinFlowContextValue | undefined>(undefined);
const OnboardingContext = createContext<OnboardingState | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const session = useContext(AuthSessionContext);
  const pinFlow = useContext(AuthPinFlowContext);
  const onboarding = useContext(OnboardingContext);

  if (!session || !pinFlow || !onboarding) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return useMemo(
    () => ({
      ...session,
      ...pinFlow,
      onboarding,
    }),
    [session, pinFlow, onboarding]
  );
};

export const useAuthSession = (): AuthSessionContextValue => {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error('useAuthSession must be used within an AuthProvider');
  }
  return context;
};

export const useAuthPinFlow = (): AuthPinFlowContextValue => {
  const context = useContext(AuthPinFlowContext);
  if (!context) {
    throw new Error('useAuthPinFlow must be used within an AuthProvider');
  }
  return context;
};

export const useOnboardingFlow = (): OnboardingState => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboardingFlow must be used within an AuthProvider');
  }
  return context;
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

    await performFullWalletReset({
      resetWallet,
      setSeedConfirmed,
    });

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

  const sessionValue = useMemo<AuthSessionContextValue>(
    () => ({
      isAuthenticated,
      isBiometricSupported,
      biometricEnabled,
      showBiometricPrompt,
      showFaceIdButton,
      isPasskeySupported,
      passkeyEnabled,
      setIsAuthenticated,
      setBiometricEnabled,
      setShowBiometricPrompt,
      setShowFaceIdButton,
      setPasskeyEnabled,
      authenticateUser,
      authenticateWithPasskey,
      handleLockScreenAuthenticated,
      loadBiometricPreference,
      loadPasskeyPreference,
      lock,
      resetAuth,
    }),
    [
      isAuthenticated, isBiometricSupported, biometricEnabled, showBiometricPrompt,
      showFaceIdButton, isPasskeySupported, passkeyEnabled,
      setIsAuthenticated, setBiometricEnabled, setShowBiometricPrompt, setShowFaceIdButton,
      setPasskeyEnabled, authenticateUser, authenticateWithPasskey,
      handleLockScreenAuthenticated, loadBiometricPreference,
      loadPasskeyPreference, lock, resetAuth,
    ]
  );

  const pinFlowValue = useMemo<AuthPinFlowContextValue>(
    () => ({
      settingUpPin,
      changingPin,
      showPinEntry,
      pin,
      confirmPin,
      pinError,
      pinStep,
      setShowPinEntry,
      setSettingUpPin,
      setChangingPin,
      setPin,
      setConfirmPin,
      setPinError,
      setPinStep,
      handlePinSetupComplete,
      handlePinChangeComplete,
      startPinChange,
    }),
    [
      settingUpPin, changingPin, showPinEntry, pin, confirmPin, pinError, pinStep,
      setShowPinEntry, setSettingUpPin, setChangingPin, setPin,
      setConfirmPin, setPinError, setPinStep, handlePinSetupComplete,
      handlePinChangeComplete, startPinChange,
    ]
  );

  return (
    <AuthSessionContext.Provider value={sessionValue}>
      <AuthPinFlowContext.Provider value={pinFlowValue}>
        <OnboardingContext.Provider value={onboarding}>{children}</OnboardingContext.Provider>
      </AuthPinFlowContext.Provider>
    </AuthSessionContext.Provider>
  );
};
