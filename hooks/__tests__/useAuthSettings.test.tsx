// @ts-nocheck
/**
 * Tests for useAuthSettings Hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import * as SecureStore from 'expo-secure-store';
import * as biometricService from '../../services/biometricService';
import { useAuthSettings } from '../useAuthSettings';
import { notify } from '../../utils/notify';

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

describe('useAuthSettings', () => {
  let mockProps;

  beforeEach(() => {
    mockProps = {
      biometricEnabled: false,
      setBiometricEnabled: jest.fn(),
      setIsAuthenticated: jest.fn(),
      startPinChange: jest.fn(),
    };
    jest.clearAllMocks();
    SecureStore.setItemAsync.mockResolvedValue(null);
    biometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
  });

  it('should initialize with modal hidden', () => {
    const { result } = renderHook(() => useAuthSettings(mockProps));

    expect(result.current.showFaceIdModal).toBe(false);
  });

  it('should call startPinChange when handleChangePin is called', () => {
    const { result } = renderHook(() => useAuthSettings(mockProps));

    act(() => {
      result.current.handleChangePin();
    });

    expect(mockProps.startPinChange).toHaveBeenCalled();
  });

  it('should show modal when toggling Face ID', () => {
    const { result } = renderHook(() => useAuthSettings(mockProps));

    expect(result.current.showFaceIdModal).toBe(false);

    act(() => {
      result.current.handleFaceIdToggle();
    });

    expect(result.current.showFaceIdModal).toBe(true);
  });

  it('should hide modal when canceling Face ID toggle', () => {
    const { result } = renderHook(() => useAuthSettings(mockProps));

    // First show the modal
    act(() => {
      result.current.handleFaceIdToggle();
    });
    expect(result.current.showFaceIdModal).toBe(true);

    // Then cancel
    act(() => {
      result.current.cancelFaceIdToggle();
    });
    expect(result.current.showFaceIdModal).toBe(false);
  });

  describe('confirmFaceIdToggle - Enabling', () => {
    beforeEach(() => {
      mockProps.biometricEnabled = false;
    });

    it('should enable Face ID when biometric authentication succeeds', async () => {
      biometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuthSettings(mockProps));

      // Start toggle
      act(() => {
        result.current.handleFaceIdToggle();
      });

      // Confirm
      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(biometricService.authenticateWithBiometrics).toHaveBeenCalledWith(
        'Authenticate to enable Face ID',
        'Use PIN'
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth', 'true');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('biometricEnabled', 'true');
      expect(mockProps.setBiometricEnabled).toHaveBeenCalledWith(true);
      expect(notify.settings.faceIdEnabled).toHaveBeenCalled();
      expect(result.current.showFaceIdModal).toBe(false);
    });

    it('should fall back to PIN when biometric authentication fails', async () => {
      biometricService.authenticateWithBiometrics.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuthSettings(mockProps));

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pendingFaceIdEnable', 'true');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth', 'true');
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(false);
      expect(mockProps.setBiometricEnabled).not.toHaveBeenCalled();
    });

    it('should handle biometric authentication errors', async () => {
      const mockError = new Error('Biometric error');
      biometricService.authenticateWithBiometrics.mockRejectedValue(mockError);

      const { result } = renderHook(() => useAuthSettings(mockProps));

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(notify.auth.requiredForFaceId).toHaveBeenCalled();
      expect(mockProps.setBiometricEnabled).not.toHaveBeenCalled();
    });

    it('should handle SecureStore errors when saving', async () => {
      biometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      // Make setItemAsync fail only on the final biometricEnabled save
      SecureStore.setItemAsync.mockImplementation((key) => {
        if (key === 'biometricEnabled') {
          return Promise.reject(new Error('Storage error'));
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAuthSettings(mockProps));

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(notify.settings.faceIdFailed).toHaveBeenCalled();
    });

    it('should not crash if notify is not available', async () => {
      const propsWithoutToast = { ...mockProps };
      biometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuthSettings(propsWithoutToast));

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      // Should not throw and should complete
      expect(propsWithoutToast.setBiometricEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('confirmFaceIdToggle - Disabling', () => {
    beforeEach(() => {
      mockProps.biometricEnabled = true;
    });

    it('should disable Face ID without authentication', async () => {
      const { result } = renderHook(() => useAuthSettings(mockProps));

      // Start toggle (to disable)
      act(() => {
        result.current.handleFaceIdToggle();
      });

      // Confirm
      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      // Should NOT prompt for biometric authentication when disabling
      expect(biometricService.authenticateWithBiometrics).not.toHaveBeenCalled();
      expect(mockProps.setBiometricEnabled).toHaveBeenCalledWith(false);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('biometricEnabled', 'false');
      expect(notify.settings.faceIdDisabled).toHaveBeenCalled();
    });

    it('should handle SecureStore errors when disabling', async () => {
      SecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useAuthSettings(mockProps));

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(notify.settings.faceIdFailed).toHaveBeenCalled();
    });
  });

  describe('Toggle Cycle', () => {
    it('should toggle from false to true when enabling', async () => {
      mockProps.biometricEnabled = false;
      biometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuthSettings(mockProps));

      // Enable Face ID (false -> true)
      act(() => {
        result.current.handleFaceIdToggle();
      });
      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(mockProps.setBiometricEnabled).toHaveBeenCalledWith(true);
      expect(biometricService.authenticateWithBiometrics).toHaveBeenCalled();
    });

    it('should toggle from true to false when disabling', async () => {
      mockProps.biometricEnabled = true;

      const { result } = renderHook(() => useAuthSettings(mockProps));

      // Disable Face ID (true -> false)
      act(() => {
        result.current.handleFaceIdToggle();
      });
      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(mockProps.setBiometricEnabled).toHaveBeenCalledWith(false);
      expect(biometricService.authenticateWithBiometrics).not.toHaveBeenCalled();
    });
  });

  describe('Return values', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useAuthSettings(mockProps));

      expect(result.current).toHaveProperty('handleChangePin');
      expect(result.current).toHaveProperty('handleFaceIdToggle');
      expect(result.current).toHaveProperty('showFaceIdModal');
      expect(result.current).toHaveProperty('confirmFaceIdToggle');
      expect(result.current).toHaveProperty('cancelFaceIdToggle');

      expect(typeof result.current.handleChangePin).toBe('function');
      expect(typeof result.current.handleFaceIdToggle).toBe('function');
      expect(typeof result.current.confirmFaceIdToggle).toBe('function');
      expect(typeof result.current.cancelFaceIdToggle).toBe('function');
      expect(typeof result.current.showFaceIdModal).toBe('boolean');
    });

    it('should memoize return value', () => {
      const { result } = renderHook(() => useAuthSettings(mockProps));

      const firstResult = result.current;

      // Re-render without changing dependencies
      act(() => {
        // Trigger a re-render by calling a function
        result.current.cancelFaceIdToggle();
      });

      // Functions should remain stable due to useCallback/useMemo
      expect(result.current.handleChangePin).toBe(firstResult.handleChangePin);
      expect(result.current.cancelFaceIdToggle).toBe(firstResult.cancelFaceIdToggle);
    });
  });
});
