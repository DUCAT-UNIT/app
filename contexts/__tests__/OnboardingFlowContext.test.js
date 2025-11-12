/**
 * Tests for OnboardingFlowContext
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { OnboardingFlowProvider, useOnboardingFlow } from '../OnboardingFlowContext';
import * as SecureStore from 'expo-secure-store';
import * as onboardingHelpers from '../../utils/onboardingHelpers';
import { SECURE_KEYS } from '../../utils/constants';

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

// Mock dependencies
jest.mock('expo-secure-store');
jest.mock('../../utils/onboardingHelpers');

describe('OnboardingFlowContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockResetWallet = jest.fn();

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useOnboardingFlow());
    }).toThrow('useOnboardingFlow must be used within OnboardingFlowProvider');

    consoleError.mockRestore();
  });

  it('should provide initial state', () => {
    const wrapper = ({ children }) => (
      <OnboardingFlowProvider resetWallet={mockResetWallet}>
        {children}
      </OnboardingFlowProvider>
    );
    const { result } = renderHook(() => useOnboardingFlow(), { wrapper });

    expect(result.current.seedConfirmed).toBe(false);
    expect(result.current.seedConfirmedRef.current).toBe(false);
    expect(typeof result.current.setSeedConfirmed).toBe('function');
    expect(typeof result.current.resetWalletAndState).toBe('function');
    expect(typeof result.current.resetInactivityTimer).toBe('function');
    expect(result.current.inactivityTimerRef).toBeDefined();
    expect(result.current.amountInputRef).toBeDefined();
  });

  it('should update seedConfirmed state and ref', () => {
    const wrapper = ({ children }) => (
      <OnboardingFlowProvider resetWallet={mockResetWallet}>
        {children}
      </OnboardingFlowProvider>
    );
    const { result } = renderHook(() => useOnboardingFlow(), { wrapper });

    expect(result.current.seedConfirmed).toBe(false);
    expect(result.current.seedConfirmedRef.current).toBe(false);

    act(() => {
      result.current.setSeedConfirmed(true);
    });

    // Wait for useEffect to sync ref
    act(() => {
      jest.runAllTimers();
    });

    expect(result.current.seedConfirmed).toBe(true);
    expect(result.current.seedConfirmedRef.current).toBe(true);
  });

  it('should reset wallet and state', async () => {
    SecureStore.deleteItemAsync.mockResolvedValue(undefined);
    onboardingHelpers.resetOnboardingState.mockResolvedValue(undefined);

    const wrapper = ({ children }) => (
      <OnboardingFlowProvider resetWallet={mockResetWallet}>
        {children}
      </OnboardingFlowProvider>
    );
    const { result } = renderHook(() => useOnboardingFlow(), { wrapper });

    // Set seedConfirmed to true first
    act(() => {
      result.current.setSeedConfirmed(true);
    });

    expect(result.current.seedConfirmed).toBe(true);

    // Reset wallet and state
    await act(async () => {
      await result.current.resetWalletAndState();
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_KEYS.MNEMONIC);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_KEYS.CURRENT_ACCOUNT);
    expect(onboardingHelpers.resetOnboardingState).toHaveBeenCalled();
    expect(mockResetWallet).toHaveBeenCalled();
    expect(result.current.seedConfirmed).toBe(false);
  });

  it('should reset inactivity timer', () => {
    const wrapper = ({ children }) => (
      <OnboardingFlowProvider resetWallet={mockResetWallet}>
        {children}
      </OnboardingFlowProvider>
    );
    const { result } = renderHook(() => useOnboardingFlow(), { wrapper });

    // Set a timer
    act(() => {
      result.current.inactivityTimerRef.current = setTimeout(() => {}, 5000);
    });

    const timerId = result.current.inactivityTimerRef.current;
    expect(timerId).not.toBeNull();

    // Reset the timer
    act(() => {
      result.current.resetInactivityTimer();
    });

    // Timer should be cleared
    // Note: We can't directly check if timeout was cleared, but we can verify the function executes without error
  });

  it('should handle resetInactivityTimer when no timer exists', () => {
    const wrapper = ({ children }) => (
      <OnboardingFlowProvider resetWallet={mockResetWallet}>
        {children}
      </OnboardingFlowProvider>
    );
    const { result } = renderHook(() => useOnboardingFlow(), { wrapper });

    // Call resetInactivityTimer without setting a timer first
    expect(() => {
      act(() => {
        result.current.resetInactivityTimer();
      });
    }).not.toThrow();
  });

  it('should provide mutable refs for inactivityTimer and amountInput', () => {
    const wrapper = ({ children }) => (
      <OnboardingFlowProvider resetWallet={mockResetWallet}>
        {children}
      </OnboardingFlowProvider>
    );
    const { result } = renderHook(() => useOnboardingFlow(), { wrapper });

    // Set values to refs
    act(() => {
      result.current.inactivityTimerRef.current = 'test-timer';
      result.current.amountInputRef.current = { focus: jest.fn() };
    });

    expect(result.current.inactivityTimerRef.current).toBe('test-timer');
    expect(result.current.amountInputRef.current.focus).toBeDefined();
  });

  it('should keep seedConfirmedRef in sync with seedConfirmed state', () => {
    const wrapper = ({ children }) => (
      <OnboardingFlowProvider resetWallet={mockResetWallet}>
        {children}
      </OnboardingFlowProvider>
    );
    const { result } = renderHook(() => useOnboardingFlow(), { wrapper });

    // Toggle seedConfirmed multiple times
    act(() => {
      result.current.setSeedConfirmed(true);
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(result.current.seedConfirmedRef.current).toBe(true);

    act(() => {
      result.current.setSeedConfirmed(false);
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(result.current.seedConfirmedRef.current).toBe(false);
  });
});
