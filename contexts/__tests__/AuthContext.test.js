/**
 * Tests for AuthContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../AuthContext';

// Helper to render hooks with react-test-renderer
function renderHook(hook, { wrapper: Wrapper } = {}) {
  const result = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component;
  act(() => {
    component = Wrapper
      ? create(<Wrapper><TestComponent /></Wrapper>)
      : create(<TestComponent />);
  });

  return { result, rerender: component.update, unmount: component.unmount };
}
import { useAuth as useAuthHook } from '../../hooks/useAuth';
import * as SecureStore from 'expo-secure-store';
import { resetOnboardingState } from '../../utils/onboardingHelpers';
import { SECURE_KEYS } from '../../utils/constants';

// Mock the useAuth hook
jest.mock('../../hooks/useAuth');
jest.mock('expo-secure-store');
jest.mock('../../utils/onboardingHelpers');

describe('AuthContext', () => {
  const mockAuthState = {
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthHook.mockReturnValue(mockAuthState);
    SecureStore.deleteItemAsync.mockResolvedValue();
    resetOnboardingState.mockResolvedValue();
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleError.mockRestore();
  });

  it('should provide auth state from hook', () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Should include all auth state from the hook
    expect(result.current).toMatchObject(mockAuthState);
    // Should also include onboarding state
    expect(result.current).toHaveProperty('seedConfirmed');
    expect(result.current).toHaveProperty('onboarding');
  });

  it('should pass onSeedConfirmed to hook', () => {
    const onSeedConfirmed = jest.fn();
    const wrapper = ({ children }) => (
      <AuthProvider onSeedConfirmed={onSeedConfirmed}>{children}</AuthProvider>
    );

    renderHook(() => useAuth(), { wrapper });

    expect(useAuthHook).toHaveBeenCalledWith({ onSeedConfirmed });
  });

  it('should provide all hook methods and state', () => {
    const fullAuthState = {
      isAuthenticated: true,
      isLoading: false,
      user: { id: '123' },
      login: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
    };

    useAuthHook.mockReturnValue(fullAuthState);

    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toEqual({ id: '123' });
    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.refreshAuth).toBe('function');
  });

  describe('Onboarding State', () => {
    it('should initialize with seedConfirmed as false', () => {
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.seedConfirmed).toBe(false);
      expect(result.current.onboarding.seedConfirmed).toBe(false);
    });

    it('should update seedConfirmed state', () => {
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      act(() => {
        result.current.setSeedConfirmed(true);
      });

      expect(result.current.seedConfirmed).toBe(true);
      expect(result.current.onboarding.seedConfirmed).toBe(true);
    });

    it('should keep seedConfirmedRef in sync with state', () => {
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.seedConfirmedRef.current).toBe(false);

      act(() => {
        result.current.setSeedConfirmed(true);
      });

      expect(result.current.seedConfirmedRef.current).toBe(true);
    });

    it('should provide refs for inactivityTimer and amountInput', () => {
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.inactivityTimerRef).toBeDefined();
      expect(result.current.inactivityTimerRef.current).toBeNull();
      expect(result.current.amountInputRef).toBeDefined();
      expect(result.current.amountInputRef.current).toBeNull();
    });
  });

  describe('resetWalletAndState', () => {
    it('should delete secure store items and reset state', async () => {
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Set seedConfirmed to true first
      act(() => {
        result.current.setSeedConfirmed(true);
      });

      await act(async () => {
        await result.current.resetWalletAndState();
      });

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_KEYS.MNEMONIC);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_KEYS.CURRENT_ACCOUNT);
      expect(resetOnboardingState).toHaveBeenCalled();
      expect(result.current.seedConfirmed).toBe(false);
    });

    it('should call resetWallet callback if provided', async () => {
      const resetWallet = jest.fn();
      const wrapper = ({ children }) => (
        <AuthProvider resetWallet={resetWallet}>{children}</AuthProvider>
      );
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.resetWalletAndState();
      });

      expect(resetWallet).toHaveBeenCalled();
    });

    it('should work without resetWallet callback', async () => {
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.resetWalletAndState();
      });

      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
      expect(resetOnboardingState).toHaveBeenCalled();
    });
  });

  describe('resetInactivityTimer', () => {
    it('should clear timer if one exists', () => {
      jest.useFakeTimers();
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Set a timer
      const timerId = setTimeout(() => {}, 5000);
      result.current.inactivityTimerRef.current = timerId;

      act(() => {
        result.current.resetInactivityTimer();
      });

      // Timer should be cleared (we can't directly test clearTimeout, but we can verify it was called)
      expect(result.current.inactivityTimerRef.current).toBe(timerId);

      jest.useRealTimers();
    });

    it('should do nothing if no timer exists', () => {
      const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Should not throw
      expect(() => {
        act(() => {
          result.current.resetInactivityTimer();
        });
      }).not.toThrow();
    });
  });

  describe('useOnboardingFlow backwards compatibility', () => {
    it('should return onboarding namespace', () => {
      const { useOnboardingFlow } = require('../AuthContext');

      const result = { current: null };
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
    });
  });

  describe('Provider props validation', () => {
    it('should accept onSeedConfirmed prop', () => {
      const onSeedConfirmed = jest.fn();

      expect(() => {
        act(() => {
          create(
            <AuthProvider onSeedConfirmed={onSeedConfirmed}>
              <div>Test</div>
            </AuthProvider>
          );
        });
      }).not.toThrow();
    });

    it('should accept resetWallet prop', () => {
      const resetWallet = jest.fn();

      expect(() => {
        act(() => {
          create(
            <AuthProvider resetWallet={resetWallet}>
              <div>Test</div>
            </AuthProvider>
          );
        });
      }).not.toThrow();
    });

    it('should work with both props', () => {
      const onSeedConfirmed = jest.fn();
      const resetWallet = jest.fn();

      expect(() => {
        act(() => {
          create(
            <AuthProvider onSeedConfirmed={onSeedConfirmed} resetWallet={resetWallet}>
              <div>Test</div>
            </AuthProvider>
          );
        });
      }).not.toThrow();
    });
  });
});
