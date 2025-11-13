/**
 * Tests for useNavigationState hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useNavigationState } from '../useNavigationState';
import * as AuthContext from '../../contexts/AuthContext';
import * as WalletContext from '../../contexts/WalletContext';

// Mock the context hooks
jest.mock('../../contexts/AuthContext');
jest.mock('../../contexts/WalletContext');

// Helper to render hooks
function renderHook(hook) {
  const result = { current: null };
  function TestComponent() {
    result.current = hook();
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent />);
  });
  return {
    result,
    rerender: () => {
      act(() => {
        component.update(<TestComponent />);
      });
    },
    unmount: () => component.unmount(),
  };
}

describe('useNavigationState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldShowAuth', () => {
    it('should return true when no wallet exists', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: false,
        changingPin: false,
        settingUpPin: false,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: null });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: false });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowAuth).toBe(true);
    });

    it('should return true when wallet exists but seed not confirmed', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: false,
        changingPin: false,
        settingUpPin: false,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: { mnemonic: 'test' } });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: false });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowAuth).toBe(true);
    });

    it('should return true when setting up PIN for first time', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: false,
        changingPin: false,
        settingUpPin: true,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: { mnemonic: 'test' } });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: true });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowAuth).toBe(true);
    });

    it('should return false when changing PIN (not first time setup)', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: true,
        changingPin: true,
        settingUpPin: true,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: { mnemonic: 'test' } });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: true });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowAuth).toBe(false);
    });

    it('should return true when showPinEntry is true', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: false,
        changingPin: false,
        settingUpPin: false,
        showPinEntry: true,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: { mnemonic: 'test' } });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: true });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowAuth).toBe(true);
    });

    it('should return true when not authenticated with wallet and confirmed seed', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: false,
        changingPin: false,
        settingUpPin: false,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: { mnemonic: 'test' } });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: true });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowAuth).toBe(true);
    });

    it('should return false when fully authenticated and onboarded', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: true,
        changingPin: false,
        settingUpPin: false,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: { mnemonic: 'test' } });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: true });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowAuth).toBe(false);
    });
  });

  describe('shouldShowPinOverlay', () => {
    it('should return true when changing PIN', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: true,
        changingPin: true,
        settingUpPin: true,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: { mnemonic: 'test' } });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: true });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowPinOverlay).toBe(true);
    });

    it('should return false when setting up PIN for first time', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: false,
        changingPin: false,
        settingUpPin: true,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: { mnemonic: 'test' } });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: true });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowPinOverlay).toBe(false);
    });

    it('should return false when not setting up or changing PIN', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: true,
        changingPin: false,
        settingUpPin: false,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: { mnemonic: 'test' } });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: true });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowPinOverlay).toBe(false);
    });
  });

  describe('memoization', () => {
    it('should return same object reference when dependencies do not change', () => {
      const authValue = {
        isAuthenticated: true,
        changingPin: false,
        settingUpPin: false,
        showPinEntry: false,
      };
      const walletValue = { wallet: { mnemonic: 'test' } };
      const onboardingValue = { seedConfirmed: true };

      AuthContext.useAuth.mockReturnValue(authValue);
      WalletContext.useWallet.mockReturnValue(walletValue);
      AuthContext.useOnboardingFlow.mockReturnValue(onboardingValue);

      const { result, rerender } = renderHook(() => useNavigationState());
      const firstResult = result.current;

      rerender();
      const secondResult = result.current;

      // Values should be the same due to useMemo
      expect(firstResult.shouldShowAuth).toBe(secondResult.shouldShowAuth);
      expect(firstResult.shouldShowPinOverlay).toBe(secondResult.shouldShowPinOverlay);
    });

    it('should recalculate when dependencies change', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: false,
        changingPin: false,
        settingUpPin: false,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: null });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: false });

      const { result, rerender } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowAuth).toBe(true);

      // Change to authenticated state
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: true,
        changingPin: false,
        settingUpPin: false,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: { mnemonic: 'test' } });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: true });

      rerender();

      expect(result.current.shouldShowAuth).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle wallet being undefined vs null', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: false,
        changingPin: false,
        settingUpPin: false,
        showPinEntry: false,
      });
      WalletContext.useWallet.mockReturnValue({ wallet: undefined });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: false });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowAuth).toBe(true);
    });

    it('should prioritize showPinEntry over other conditions', () => {
      AuthContext.useAuth.mockReturnValue({
        isAuthenticated: true,
        changingPin: false,
        settingUpPin: false,
        showPinEntry: true, // This should force auth screen
      });
      WalletContext.useWallet.mockReturnValue({ wallet: { mnemonic: 'test' } });
      AuthContext.useOnboardingFlow.mockReturnValue({ seedConfirmed: true });

      const { result } = renderHook(() => useNavigationState());

      expect(result.current.shouldShowAuth).toBe(true);
    });
  });
});
