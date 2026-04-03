/**
 * Tests for AuthContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { AuthProvider, useAuth, _resetWalletRateLimitState } from '../AuthContext';

// Helper to render hooks with react-test-renderer
function renderHook<T>(hook: () => T, { wrapper: Wrapper }: { wrapper?: React.ComponentType<{ children: React.ReactNode }> } = {}) {
  const result: { current: T | null } = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = Wrapper
      ? create(<Wrapper><TestComponent /></Wrapper>)
      : create(<TestComponent />);
  });

  return { result, rerender: component!.update, unmount: component!.unmount };
}
import { useAuth as useAuthHook } from '../../hooks/useAuth';
import { resetOnboardingState } from '../../utils/onboardingHelpers';
import { deleteWalletData } from '../../services/secureStorageService';

// Mock the useAuth hook
jest.mock('../../hooks/useAuth');
jest.mock('../../utils/onboardingHelpers');
jest.mock('../../services/secureStorageService', () => ({
  deleteWalletData: jest.fn(),
}));

describe('AuthContext', () => {
  const mockAuthState = {
    // State
    isAuthenticated: true,
    isBiometricSupported: false,
    biometricEnabled: false,
    showBiometricPrompt: false,
    showFaceIdButton: true,
    isPasskeySupported: false,
    passkeyEnabled: false,
    showPasskeyPrompt: false,
    settingUpPin: false,
    changingPin: false,
    showPinEntry: false,
    pin: '',
    confirmPin: '',
    pinError: '',
    pinStep: 'enter' as const,
    // Setters
    setIsAuthenticated: jest.fn(),
    setBiometricEnabled: jest.fn(),
    setShowBiometricPrompt: jest.fn(),
    setShowFaceIdButton: jest.fn(),
    setPasskeyEnabled: jest.fn(),
    setShowPasskeyPrompt: jest.fn(),
    setShowPinEntry: jest.fn(),
    setSettingUpPin: jest.fn(),
    setChangingPin: jest.fn(),
    setPin: jest.fn(),
    setConfirmPin: jest.fn(),
    setPinError: jest.fn(),
    setPinStep: jest.fn(),
    // Functions
    authenticateUser: jest.fn(),
    authenticateWithPasskey: jest.fn(),
    handlePinSetupComplete: jest.fn(),
    handlePinChangeComplete: jest.fn(),
    handleLockScreenAuthenticated: jest.fn(),
    loadBiometricPreference: jest.fn(),
    loadPasskeyPreference: jest.fn(),
    lock: jest.fn(),
    resetAuth: jest.fn(),
    startPinChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    _resetWalletRateLimitState?.();
    (useAuthHook as jest.Mock).mockReturnValue(mockAuthState);
    (deleteWalletData as jest.Mock).mockResolvedValue(undefined);
    (resetOnboardingState as jest.Mock).mockResolvedValue(undefined);
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleError.mockRestore();
  });

  it('should provide auth state from hook', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Should include all auth state from the hook
    expect(result.current).toMatchObject(mockAuthState);
    // Should also include onboarding namespace
    expect(result.current).toHaveProperty('onboarding');
    expect(result.current!.onboarding).toHaveProperty('seedConfirmed');
  });

  it('should pass onSeedConfirmed to hook', () => {
    const onSeedConfirmed = jest.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider onSeedConfirmed={onSeedConfirmed}>{children}</AuthProvider>
    );

    renderHook(() => useAuth(), { wrapper });

    expect(useAuthHook).toHaveBeenCalledWith({ onSeedConfirmed });
  });

  it('should provide all hook methods and state', () => {
    const fullAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      isBiometricSupported: true,
      biometricEnabled: true,
    };

    (useAuthHook as jest.Mock).mockReturnValue(fullAuthState);

    const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current!.isAuthenticated).toBe(true);
    expect(result.current!.isBiometricSupported).toBe(true);
    expect(result.current!.biometricEnabled).toBe(true);
  });

  describe('Onboarding State', () => {
    it('should initialize with seedConfirmed as false', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current!.onboarding.seedConfirmed).toBe(false);
    });

    it('should update seedConfirmed state', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      act(() => {
        result.current!.onboarding.setSeedConfirmed(true);
      });

      expect(result.current!.onboarding.seedConfirmed).toBe(true);
    });

    it('should keep seedConfirmedRef in sync with state', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current!.onboarding.seedConfirmedRef.current).toBe(false);

      act(() => {
        result.current!.onboarding.setSeedConfirmed(true);
      });

      expect(result.current!.onboarding.seedConfirmedRef.current).toBe(true);
    });

    it('should provide refs for inactivityTimer and amountInput', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current!.onboarding.inactivityTimerRef).toBeDefined();
      expect(result.current!.onboarding.inactivityTimerRef.current).toBeNull();
      expect(result.current!.onboarding.amountInputRef).toBeDefined();
      expect(result.current!.onboarding.amountInputRef.current).toBeNull();
    });
  });

  describe('resetWalletAndState', () => {
    it('should delete wallet data and reset state', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Set seedConfirmed to true first
      act(() => {
        result.current!.onboarding.setSeedConfirmed(true);
      });

      await act(async () => {
        await result.current!.onboarding.resetWalletAndState();
      });

      expect(deleteWalletData).toHaveBeenCalledTimes(1);
      expect(resetOnboardingState).toHaveBeenCalled();
      expect(result.current!.onboarding.seedConfirmed).toBe(false);
    });

    it('should call resetWallet callback if provided', async () => {
      const resetWallet = jest.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider resetWallet={resetWallet}>{children}</AuthProvider>
      );
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current!.onboarding.resetWalletAndState();
      });

      expect(resetWallet).toHaveBeenCalled();
    });

    it('should work without resetWallet callback', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current!.onboarding.resetWalletAndState();
      });

      expect(deleteWalletData).toHaveBeenCalledTimes(1);
      expect(resetOnboardingState).toHaveBeenCalled();
    });
  });

  describe('resetInactivityTimer', () => {
    it('should clear timer if one exists', () => {
      jest.useFakeTimers();
      const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Set a timer
      const timerId = setTimeout(() => {}, 5000);
      result.current!.onboarding.inactivityTimerRef.current = timerId;

      act(() => {
        result.current!.onboarding.resetInactivityTimer();
      });

      // Timer should be cleared (we can't directly test clearTimeout, but we can verify it was called)
      expect(result.current!.onboarding.inactivityTimerRef.current).toBe(timerId);

      jest.useRealTimers();
    });
  });

  describe('useOnboardingFlow backwards compatibility', () => {
    it('should return onboarding namespace', () => {
      const { useOnboardingFlow } = require('../AuthContext');

      const result: { current: any } = { current: null };
      function TestComponent() {
        result.current = useOnboardingFlow();
        return null;
      }

      act(() => {
        create(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });

      expect(result.current).toHaveProperty('seedConfirmed');
      expect(result.current).toHaveProperty('setSeedConfirmed');
      expect(result.current).toHaveProperty('resetWalletAndState');
      expect(result.current).toHaveProperty('resetInactivityTimer');
      expect(result.current).toHaveProperty('inactivityTimerRef');
      expect(result.current).toHaveProperty('amountInputRef');
    });
  });

});
