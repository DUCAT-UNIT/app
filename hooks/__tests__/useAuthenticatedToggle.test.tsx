/**
 * Tests for useAuthenticatedToggle Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import * as biometricService from '../../services/biometricService';
import * as SettingsService from '../../services/settingsService';
import { useAuthenticatedToggle, useAuthToEnable, useAuthToToggle } from '../useAuthenticatedToggle';
import { notify } from '../../utils/notify';

// Helper to render hooks with react-test-renderer
function renderHook<T>(hook: () => T) {
  const result: { current: T | null } = { current: null };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  let component: ReturnType<typeof create> | undefined;
  act(() => {
    component = create(<TestComponent />);
  });

  return {
    result,
    unmount: () => component?.unmount(),
  };
}

// Mock dependencies
jest.mock('../../services/biometricService');
jest.mock('../../services/settingsService');

describe('useAuthenticatedToggle', () => {
  let mockConfig: {
    settingKey: string;
    settingName: string;
    currentValue: boolean;
    onValueChange: jest.Mock;
    biometricEnabled: boolean;
    setIsAuthenticated: jest.Mock;
    pendingEnableKey?: string;
    authPrompt?: string;
    requireAuthToDisable?: boolean;
  };

  beforeEach(() => {
    mockConfig = {
      settingKey: 'testSetting',
      settingName: 'Test Setting',
      currentValue: false,
      onValueChange: jest.fn(),
      biometricEnabled: false,
      setIsAuthenticated: jest.fn(),
    };

    jest.clearAllMocks();
    (biometricService.authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: true });
    (SettingsService.setBoolean as jest.Mock).mockResolvedValue(null);
  });

  describe('Basic functionality', () => {
    it('should initialize with modal hidden', () => {
      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      expect(result.current!.showModal).toBe(false);
    });

    it('should show modal when handleToggle is called', () => {
      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      expect(result.current!.showModal).toBe(false);

      act(() => {
        result.current!.handleToggle();
      });

      expect(result.current!.showModal).toBe(true);
    });

    it('should hide modal when cancelToggle is called', () => {
      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      act(() => {
        result.current!.handleToggle();
      });
      expect(result.current!.showModal).toBe(true);

      act(() => {
        result.current!.cancelToggle();
      });

      expect(result.current!.showModal).toBe(false);
    });

    it('should return all expected properties', () => {
      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      expect(result.current).toHaveProperty('showModal');
      expect(result.current).toHaveProperty('handleToggle');
      expect(result.current).toHaveProperty('confirmToggle');
      expect(result.current).toHaveProperty('cancelToggle');
      expect(typeof result.current!.handleToggle).toBe('function');
      expect(typeof result.current!.confirmToggle).toBe('function');
      expect(typeof result.current!.cancelToggle).toBe('function');
    });
  });

  describe('Disabling without auth requirement', () => {
    beforeEach(() => {
      mockConfig.currentValue = true; // Currently enabled
      mockConfig.requireAuthToDisable = false;
    });

    it('should disable without authentication', async () => {
      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      act(() => {
        result.current!.handleToggle();
      });

      await act(async () => {
        await result.current!.confirmToggle();
      });

      expect(biometricService.authenticateWithBiometrics).not.toHaveBeenCalled();
      expect(SettingsService.setBoolean).toHaveBeenCalledWith('testSetting', false);
      expect(mockConfig.onValueChange).toHaveBeenCalledWith(false);
      expect(notify.settings.disabled).toHaveBeenCalled();
    });
  });

  describe('Enabling with biometric auth', () => {
    beforeEach(() => {
      mockConfig.biometricEnabled = true;
    });

    it('should enable when biometric auth succeeds', async () => {
      (biometricService.authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      act(() => {
        result.current!.handleToggle();
      });

      await act(async () => {
        await result.current!.confirmToggle();
      });

      expect(biometricService.authenticateWithBiometrics).toHaveBeenCalledWith(
        'Authenticate to enable Test Setting',
        'Use PIN'
      );
      expect(SettingsService.setBoolean).toHaveBeenCalledWith(
        SettingsService.SettingKeys.RETURN_TO_SETTINGS_AFTER_AUTH,
        true
      );
      expect(SettingsService.setBoolean).toHaveBeenCalledWith('testSetting', true);
      expect(mockConfig.onValueChange).toHaveBeenCalledWith(true);
      expect(notify.settings.enabled).toHaveBeenCalled();
    });

    it('should use custom auth prompt when provided', async () => {
      mockConfig.authPrompt = 'Custom authentication message';

      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      act(() => {
        result.current!.handleToggle();
      });

      await act(async () => {
        await result.current!.confirmToggle();
      });

      expect(biometricService.authenticateWithBiometrics).toHaveBeenCalledWith(
        'Custom authentication message',
        'Use PIN'
      );
    });

    it('should redirect to PIN when biometric auth fails', async () => {
      (biometricService.authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      act(() => {
        result.current!.handleToggle();
      });

      await act(async () => {
        await result.current!.confirmToggle();
      });

      expect(SettingsService.setBoolean).toHaveBeenCalledWith('pendingTestSettingEnable', true);
      expect(SettingsService.setBoolean).toHaveBeenCalledWith(
        SettingsService.SettingKeys.RETURN_TO_SETTINGS_AFTER_AUTH,
        true
      );
      expect(mockConfig.setIsAuthenticated).toHaveBeenCalledWith(false);
      expect(mockConfig.onValueChange).not.toHaveBeenCalled();
    });

    it('should use custom pendingEnableKey when provided', async () => {
      mockConfig.pendingEnableKey = 'customPendingKey';
      (biometricService.authenticateWithBiometrics as jest.Mock).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      act(() => {
        result.current!.handleToggle();
      });

      await act(async () => {
        await result.current!.confirmToggle();
      });

      expect(SettingsService.setBoolean).toHaveBeenCalledWith('customPendingKey', true);
    });

    it('should handle biometric authentication errors', async () => {
      (biometricService.authenticateWithBiometrics as jest.Mock).mockRejectedValue(new Error('Auth error'));

      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      act(() => {
        result.current!.handleToggle();
      });

      await act(async () => {
        await result.current!.confirmToggle();
      });

      expect(notify.auth.required).toHaveBeenCalled();
      expect(mockConfig.onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('Enabling without biometric auth', () => {
    beforeEach(() => {
      mockConfig.biometricEnabled = false;
    });

    it('should redirect to PIN screen', async () => {
      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      act(() => {
        result.current!.handleToggle();
      });

      await act(async () => {
        await result.current!.confirmToggle();
      });

      expect(biometricService.authenticateWithBiometrics).not.toHaveBeenCalled();
      expect(SettingsService.setBoolean).toHaveBeenCalledWith('pendingTestSettingEnable', true);
      expect(SettingsService.setBoolean).toHaveBeenCalledWith(
        SettingsService.SettingKeys.RETURN_TO_SETTINGS_AFTER_AUTH,
        true
      );
      expect(mockConfig.setIsAuthenticated).toHaveBeenCalledWith(false);
    });
  });

  describe('requireAuthToDisable flag', () => {
    beforeEach(() => {
      mockConfig.currentValue = true; // Currently enabled
      mockConfig.requireAuthToDisable = true;
      mockConfig.biometricEnabled = true;
    });

    it('should require authentication when disabling', async () => {
      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      act(() => {
        result.current!.handleToggle();
      });

      await act(async () => {
        await result.current!.confirmToggle();
      });

      expect(biometricService.authenticateWithBiometrics).toHaveBeenCalledWith(
        'Authenticate to disable Test Setting',
        'Use PIN'
      );
      expect(SettingsService.setBoolean).toHaveBeenCalledWith('testSetting', false);
      expect(mockConfig.onValueChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Error handling', () => {
    it('should handle settings save errors', async () => {
      // Disabling doesn't need auth, so it goes straight to save which will fail
      mockConfig.currentValue = true;
      (SettingsService.setBoolean as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useAuthenticatedToggle(mockConfig));

      act(() => {
        result.current!.handleToggle();
      });

      await act(async () => {
        await result.current!.confirmToggle();
      });

      expect(notify.settings.failed).toHaveBeenCalled();
      expect(mockConfig.onValueChange).not.toHaveBeenCalled();
    });

  });

  describe('useAuthToEnable wrapper', () => {
    it('should create hook with requireAuthToDisable=false', async () => {
      const authContext = {
        biometricEnabled: false,
        setIsAuthenticated: jest.fn(),
      };

      const { result } = renderHook(() =>
        useAuthToEnable('testKey', 'Test', true, jest.fn(), authContext)
      );

      // Start disable (should NOT require auth)
      act(() => {
        result.current!.handleToggle();
      });

      await act(async () => {
        await result.current!.confirmToggle();
      });

      // Should disable without authentication
      expect(biometricService.authenticateWithBiometrics).not.toHaveBeenCalled();
      expect(authContext.setIsAuthenticated).not.toHaveBeenCalled();
    });
  });

  describe('useAuthToToggle wrapper', () => {
    it('should create hook with requireAuthToDisable=true', async () => {
      const authContext = {
        biometricEnabled: false,
        setIsAuthenticated: jest.fn(),
      };

      const { result } = renderHook(() =>
        useAuthToToggle('testKey', 'Test', true, jest.fn(), authContext)
      );

      // Start disable (SHOULD require auth)
      act(() => {
        result.current!.handleToggle();
      });

      await act(async () => {
        await result.current!.confirmToggle();
      });

      // Should require authentication even for disable
      expect(authContext.setIsAuthenticated).toHaveBeenCalledWith(false);
    });
  });
});
