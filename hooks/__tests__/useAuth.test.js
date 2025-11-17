/**
 * Tests for useAuth Hook
 * Validates authentication state and flows including biometric auth, PIN setup, and lock/unlock
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useAuth } from '../useAuth';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

// Mock expo-secure-store
jest.mock('expo-secure-store');

// Mock constants
jest.mock('../../utils/constants', () => ({
  SECURE_KEYS: {
    BIOMETRIC_ENABLED: 'biometricEnabled',
  },
}));

// Helper to render hooks with props
function renderHook(hook, { initialProps } = {}) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = hook(hookProps);
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent hookProps={initialProps} />);
  });
  return {
    result,
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
    unmount: () => component.unmount(),
  };
}

describe('useAuth', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
    LocalAuthentication.authenticateAsync.mockResolvedValue({ success: true });
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue();

    mockProps = {
      onSeedConfirmed: jest.fn(),
    };
  });

  describe('Initialization', () => {
    it('should start with isAuthenticated false', async () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should check biometric support on mount', async () => {
      renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
    });

    it('should set isBiometricSupported based on hardware availability', async () => {
      LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);

      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isBiometricSupported).toBe(true);
    });
  });

  describe('Load Biometric Preference', () => {
    it('should load biometric preference from storage', async () => {
      SecureStore.getItemAsync.mockResolvedValue('true');

      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.loadBiometricPreference();
      });

      expect(result.current.biometricEnabled).toBe(true);
    });

    it('should default to false if no preference stored', async () => {
      SecureStore.getItemAsync.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.loadBiometricPreference();
      });

      expect(result.current.biometricEnabled).toBe(false);
    });

    it('should handle storage errors gracefully', async () => {
      SecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.loadBiometricPreference();
      });

      expect(result.current.biometricEnabled).toBe(false);
    });
  });

  describe('Authenticate User', () => {
    it('should authenticate with biometrics if enabled', async () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setBiometricEnabled(true);
      });

      await act(async () => {
        await result.current.authenticateUser();
      });

      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should show biometric prompt if not enabled', async () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.authenticateUser();
      });

      expect(result.current.showBiometricPrompt).toBe(true);
    });

    it('should handle biometric authentication failure', async () => {
      LocalAuthentication.authenticateAsync.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setBiometricEnabled(true);
      });

      await act(async () => {
        await result.current.authenticateUser();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle authentication errors', async () => {
      LocalAuthentication.authenticateAsync.mockRejectedValue(new Error('Auth error'));

      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setBiometricEnabled(true);
      });

      await act(async () => {
        await result.current.authenticateUser();
      });

      expect(result.current.showBiometricPrompt).toBe(true);
    });
  });

  describe('PIN Change Flow', () => {
    it('should enter PIN setup after biometric auth when changing PIN', async () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setBiometricEnabled(true);
        result.current.setChangingPin(true);
      });

      await act(async () => {
        await result.current.authenticateUser();
      });

      expect(result.current.settingUpPin).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.pinStep).toBe('enter');
    });

    it('should reset PIN state when changing PIN', async () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setPin('1234');
        result.current.setConfirmPin('1234');
        result.current.setPinError('error');
        result.current.setBiometricEnabled(true);
        result.current.setChangingPin(true);
      });

      await act(async () => {
        await result.current.authenticateUser();
      });

      expect(result.current.pin).toBe('');
      expect(result.current.confirmPin).toBe('');
      expect(result.current.pinError).toBe('');
    });

    it('should start PIN change flow', async () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setIsAuthenticated(true);
      });

      await act(async () => {
        await result.current.startPinChange();
      });

      expect(result.current.changingPin).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('returnToSettingsAfterPinChange', 'true');
    });

    it('should complete PIN change', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setSettingUpPin(true);
        result.current.setChangingPin(true);
      });

      act(() => {
        result.current.handlePinChangeComplete();
      });

      expect(result.current.settingUpPin).toBe(false);
      expect(result.current.changingPin).toBe(false);
    });
  });

  describe('PIN Setup', () => {
    it('should complete PIN setup and authenticate', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setSettingUpPin(true);
      });

      act(() => {
        result.current.handlePinSetupComplete();
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.settingUpPin).toBe(false);
      expect(mockProps.onSeedConfirmed).toHaveBeenCalledWith(true);
    });

    it('should handle PIN setup without onSeedConfirmed callback', () => {
      mockProps.onSeedConfirmed = null;

      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setSettingUpPin(true);
      });

      act(() => {
        result.current.handlePinSetupComplete();
      });

      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Lock Screen Authentication', () => {
    it('should authenticate on lock screen', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setShowPinEntry(true);
      });

      act(() => {
        result.current.handleLockScreenAuthenticated();
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.showPinEntry).toBe(false);
      expect(result.current.showFaceIdButton).toBe(true);
    });

    it('should proceed to PIN setup after lock screen auth when changing PIN', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setShowPinEntry(true);
        result.current.setChangingPin(true);
        result.current.setPin('1234');
        result.current.setConfirmPin('1234');
      });

      act(() => {
        result.current.handleLockScreenAuthenticated();
      });

      expect(result.current.showPinEntry).toBe(false);
      expect(result.current.settingUpPin).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.pin).toBe('');
      expect(result.current.confirmPin).toBe('');
      expect(result.current.pinStep).toBe('enter');
    });
  });

  describe('Lock/Unlock', () => {
    it('should lock the wallet', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setIsAuthenticated(true);
      });

      act(() => {
        result.current.lock();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Reset Auth', () => {
    it('should reset all auth state', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setIsAuthenticated(true);
        result.current.setBiometricEnabled(true);
        result.current.setShowFaceIdButton(false);
        result.current.setShowBiometricPrompt(true);
        result.current.setSettingUpPin(true);
        result.current.setChangingPin(true);
        result.current.setShowPinEntry(true);
        result.current.setPin('1234');
        result.current.setConfirmPin('1234');
        result.current.setPinError('error');
        result.current.setPinStep('confirm');
      });

      act(() => {
        result.current.resetAuth();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.biometricEnabled).toBe(false);
      expect(result.current.showFaceIdButton).toBe(true);
      expect(result.current.showBiometricPrompt).toBe(false);
      expect(result.current.settingUpPin).toBe(false);
      expect(result.current.changingPin).toBe(false);
      expect(result.current.showPinEntry).toBe(false);
      expect(result.current.pin).toBe('');
      expect(result.current.confirmPin).toBe('');
      expect(result.current.pinError).toBe('');
      expect(result.current.pinStep).toBe('enter');
    });
  });

  describe('PIN State Management', () => {
    it('should allow setting PIN', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setPin('1234');
      });

      expect(result.current.pin).toBe('1234');
    });

    it('should allow setting confirm PIN', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setConfirmPin('1234');
      });

      expect(result.current.confirmPin).toBe('1234');
    });

    it('should allow setting PIN error', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setPinError('PINs do not match');
      });

      expect(result.current.pinError).toBe('PINs do not match');
    });

    it('should allow setting PIN step', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setPinStep('confirm');
      });

      expect(result.current.pinStep).toBe('confirm');
    });
  });

  describe('Biometric State Management', () => {
    it('should allow enabling biometrics', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setBiometricEnabled(true);
      });

      expect(result.current.biometricEnabled).toBe(true);
    });

    it('should allow showing biometric prompt', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setShowBiometricPrompt(true);
      });

      expect(result.current.showBiometricPrompt).toBe(true);
    });

    it('should allow hiding Face ID button', () => {
      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setShowFaceIdButton(false);
      });

      expect(result.current.showFaceIdButton).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no biometric hardware', async () => {
      LocalAuthentication.hasHardwareAsync.mockResolvedValue(false);

      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isBiometricSupported).toBe(false);
    });

    it('should handle biometric authentication cancellation', async () => {
      LocalAuthentication.authenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });

      const { result } = renderHook(() => useAuth(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.setBiometricEnabled(true);
      });

      await act(async () => {
        await result.current.authenticateUser();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
