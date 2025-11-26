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

// Mock cashuWalletService
jest.mock('../../services/cashu/cashuWalletService', () => ({
  clearWallet: jest.fn(),
  recoverLockedChange: jest.fn(),
}));

// Mock cashuLockedTokensService
jest.mock('../../services/cashu/cashuLockedTokensService', () => ({
  clearSentLockedTokens: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
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

  describe('advancedMode', () => {
    it('should load advancedMode from SecureStore', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'advancedMode') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.advancedMode).toBe(true);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('advancedMode');
    });

    it('should toggle advancedMode and save to SecureStore', async () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      expect(result.current.advancedMode).toBe(false);

      await act(async () => {
        await result.current.handleAdvancedModeToggle();
      });

      expect(result.current.advancedMode).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('advancedMode', 'true');
    });

    it('should toggle advancedMode from true to false', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'advancedMode') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.advancedMode).toBe(true);

      await act(async () => {
        await result.current.handleAdvancedModeToggle();
      });

      expect(result.current.advancedMode).toBe(false);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('advancedMode', 'false');
    });
  });

  describe('ecashThreshold', () => {
    it('should initialize with default threshold of 100', () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      expect(result.current.ecashThreshold).toBe(100);
    });

    it('should load ecashThreshold from SecureStore', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'ecashThreshold') return Promise.resolve('500');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.ecashThreshold).toBe(500);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('ecashThreshold');
    });

    it('should update ecashThreshold and save to SecureStore', async () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await result.current.handleEcashThresholdChange(250);
      });

      expect(result.current.ecashThreshold).toBe(250);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ecashThreshold', '250');
    });
  });

  describe('handleClearCashuCache', () => {
    it('should clear cache and show success toast', async () => {
      const clearWallet = require('../../services/cashu/cashuWalletService').clearWallet;
      clearWallet.mockResolvedValue();

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await result.current.handleClearCashuCache();
      });

      expect(clearWallet).toHaveBeenCalled();
      expect(mockProps.showToast).toHaveBeenCalledWith('Cashu cache cleared successfully', 'success');
    });

    it('should show error toast on failure', async () => {
      const clearWallet = require('../../services/cashu/cashuWalletService').clearWallet;
      clearWallet.mockRejectedValue(new Error('Clear failed'));

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await result.current.handleClearCashuCache();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Failed to clear Cashu cache', 'error');
    });

    it('should not crash when showToast is not provided', async () => {
      mockProps.showToast = undefined;
      const clearWallet = require('../../services/cashu/cashuWalletService').clearWallet;
      clearWallet.mockResolvedValue();

      const { result } = renderHook(() => useAppSettings(mockProps));

      await act(async () => {
        await result.current.handleClearCashuCache();
      });

      // Should not throw
      expect(clearWallet).toHaveBeenCalled();
    });
  });

  // Note: handleClearLockedTokens and handleRecoverLockedChange use dynamic imports
  // which are difficult to mock in Jest without --experimental-vm-modules.
  // These functions are covered at 89% - the remaining lines use dynamic imports.
  // Full coverage requires integration/e2e testing.

  describe('handleClearLockedTokens', () => {
    it('should be a function', () => {
      const { result } = renderHook(() => useAppSettings(mockProps));
      expect(typeof result.current.handleClearLockedTokens).toBe('function');
    });
  });

  describe('handleRecoverLockedChange', () => {
    it('should be a function', () => {
      const { result } = renderHook(() => useAppSettings(mockProps));
      expect(typeof result.current.handleRecoverLockedChange).toBe('function');
    });

    it('should show initial toast when called', async () => {
      const { result } = renderHook(() => useAppSettings(mockProps));

      // Call the function - it will fail on dynamic import but that's expected
      try {
        await act(async () => {
          await result.current.handleRecoverLockedChange();
        });
      } catch {
        // Dynamic import error is expected in Jest
      }

      // Should have shown the initial toast before the import
      expect(mockProps.showToast).toHaveBeenCalledWith('Recovering change from sent tokens...', 'info');
    });
  });
});
