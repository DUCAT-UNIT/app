/**
 * Tests for useAppSettings Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import * as SecureStore from 'expo-secure-store';
import * as biometricService from '../../services/biometricService';
import { useAppSettings } from '../useAppSettings';

// Helper to render hooks with react-test-renderer
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
    unmount: () => component.unmount(),
  };
}

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
}));

// Mock biometricService
jest.mock('../../services/biometricService', () => ({
  authenticateWithBiometrics: jest.fn(),
}));

describe('useAppSettings', () => {
  let mockProps;

  beforeEach(() => {
    mockProps = {
      biometricEnabled: false,
      setIsAuthenticated: jest.fn(),
      showToast: jest.fn(),
    };
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue(null);
    biometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      expect(result.current.notificationsEnabled).toBe(false);
      expect(result.current.showZeroAssets).toBe(false);
      expect(result.current.showNotificationsModal).toBe(false);
    });

    it('should load notificationsEnabled from SecureStore', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'notificationsEnabled') {
          return Promise.resolve('true');
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.notificationsEnabled).toBe(true);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('notificationsEnabled');
    });

    it('should load showZeroAssets from SecureStore', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'showZeroAssets') {
          return Promise.resolve('true');
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.showZeroAssets).toBe(true);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('showZeroAssets');
    });

    it('should load both settings from SecureStore', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'notificationsEnabled') return Promise.resolve('true');
        if (key === 'showZeroAssets') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.notificationsEnabled).toBe(true);
      expect(result.current.showZeroAssets).toBe(true);
    });

    it('should handle load errors gracefully', async () => {
      SecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Should not throw and should use defaults
      expect(result.current.notificationsEnabled).toBe(false);
      expect(result.current.showZeroAssets).toBe(false);
    });
  });

  describe('handleShowZeroAssetsToggle', () => {
    it('should toggle showZeroAssets from false to true', async () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      expect(result.current.showZeroAssets).toBe(false);

      await act(async () => {
        await result.current.handleShowZeroAssetsToggle();
      });

      expect(result.current.showZeroAssets).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('showZeroAssets', 'true');
    });

    it('should toggle showZeroAssets from true to false', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'showZeroAssets') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.showZeroAssets).toBe(true);

      await act(async () => {
        await result.current.handleShowZeroAssetsToggle();
      });

      expect(result.current.showZeroAssets).toBe(false);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('showZeroAssets', 'false');
    });
  });

  describe('handleNotificationsToggle', () => {
    it('should show modal when toggling notifications', () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      expect(result.current.showNotificationsModal).toBe(false);

      act(() => {
        result.current.handleNotificationsToggle();
      });

      expect(result.current.showNotificationsModal).toBe(true);
    });

    it('should hide modal when canceling', () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      act(() => {
        result.current.handleNotificationsToggle();
      });
      expect(result.current.showNotificationsModal).toBe(true);

      act(() => {
        result.current.cancelNotificationsToggle();
      });

      expect(result.current.showNotificationsModal).toBe(false);
    });
  });

  describe('confirmNotificationsToggle - Enabling with biometrics', () => {
    beforeEach(() => {
      mockProps.biometricEnabled = true;
    });

    it('should enable notifications when biometric auth succeeds', async () => {
      biometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAppSettings(mockProps));

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(biometricService.authenticateWithBiometrics).toHaveBeenCalledWith(
        'Authenticate to enable notifications',
        'Use PIN'
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth', 'true');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('notificationsEnabled', 'true');
      expect(result.current.notificationsEnabled).toBe(true);
      expect(mockProps.showToast).toHaveBeenCalledWith('Notifications enabled', 'success');
    });

    it('should redirect to PIN when biometric auth fails', async () => {
      biometricService.authenticateWithBiometrics.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAppSettings(mockProps));

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pendingNotificationsEnable', 'true');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth', 'true');
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(false);
      expect(result.current.notificationsEnabled).toBe(false);
    });

    it('should handle biometric authentication errors', async () => {
      biometricService.authenticateWithBiometrics.mockRejectedValue(new Error('Auth error'));

      const { result } = renderHook(() => useAppSettings(mockProps));

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Authentication required to enable notifications',
        'error'
      );
      expect(result.current.notificationsEnabled).toBe(false);
    });

    it('should not crash when showToast is not provided on auth error', async () => {
      mockProps.showToast = undefined;
      biometricService.authenticateWithBiometrics.mockRejectedValue(new Error('Auth error'));

      const { result } = renderHook(() => useAppSettings(mockProps));

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      // Should not throw
      expect(result.current.notificationsEnabled).toBe(false);
    });
  });

  describe('confirmNotificationsToggle - Enabling without biometrics', () => {
    beforeEach(() => {
      mockProps.biometricEnabled = false;
    });

    it('should redirect to PIN screen when biometrics disabled', async () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(biometricService.authenticateWithBiometrics).not.toHaveBeenCalled();
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pendingNotificationsEnable', 'true');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth', 'true');
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(false);
      expect(result.current.notificationsEnabled).toBe(false);
    });
  });

  describe('confirmNotificationsToggle - Disabling', () => {
    beforeEach(async () => {
      // Start with notifications enabled
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'notificationsEnabled') return Promise.resolve('true');
        return Promise.resolve(null);
      });
    });

    it('should disable notifications without authentication', async () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.notificationsEnabled).toBe(true);

      // Toggle to disable
      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(biometricService.authenticateWithBiometrics).not.toHaveBeenCalled();
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('notificationsEnabled', 'false');
      expect(result.current.notificationsEnabled).toBe(false);
      expect(mockProps.showToast).toHaveBeenCalledWith('Notifications disabled', 'success');
    });

    it('should handle save errors when disabling', async () => {
      SecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Failed to update notifications setting',
        'error'
      );
    });

    it('should not crash when showToast is not provided on save error', async () => {
      mockProps.showToast = undefined;
      SecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      // Should not throw
      expect(result.current.notificationsEnabled).toBe(false);
    });
  });

  describe('Return values', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      expect(result.current).toHaveProperty('notificationsEnabled');
      expect(result.current).toHaveProperty('showZeroAssets');
      expect(result.current).toHaveProperty('handleShowZeroAssetsToggle');
      expect(result.current).toHaveProperty('handleNotificationsToggle');
      expect(result.current).toHaveProperty('showNotificationsModal');
      expect(result.current).toHaveProperty('confirmNotificationsToggle');
      expect(result.current).toHaveProperty('cancelNotificationsToggle');

      expect(typeof result.current.handleShowZeroAssetsToggle).toBe('function');
      expect(typeof result.current.handleNotificationsToggle).toBe('function');
      expect(typeof result.current.confirmNotificationsToggle).toBe('function');
      expect(typeof result.current.cancelNotificationsToggle).toBe('function');
      expect(typeof result.current.showNotificationsModal).toBe('boolean');
    });

    it('should memoize return value', () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      const firstResult = result.current;

      act(() => {
        result.current.cancelNotificationsToggle();
      });

      // Functions should remain stable due to useCallback/useMemo
      expect(result.current.handleNotificationsToggle).toBe(firstResult.handleNotificationsToggle);
      expect(result.current.cancelNotificationsToggle).toBe(firstResult.cancelNotificationsToggle);
    });
  });
});
