/**
 * Tests for useSettings Hook
 * Validates settings management including wallet lock, deletion, PIN change, and security toggles
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useSettings } from '../useSettings';
import * as SecureStore from 'expo-secure-store';
import * as AuthService from '../../services/authService';

// Mock expo-secure-store
jest.mock('expo-secure-store');

// Mock authService
jest.mock('../../services/authService');

// Mock messages
jest.mock('../../utils/messages', () => ({
  ERRORS: {
    WALLET_DELETE_FAILED: 'Failed to delete wallet',
  },
  SUCCESS: {
    WALLET_DELETED: 'Wallet deleted successfully',
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

describe('useSettings', () => {
  let mockProps;

  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue(null);
    SecureStore.setItemAsync.mockResolvedValue();
    SecureStore.deleteItemAsync.mockResolvedValue();

    mockProps = {
      biometricEnabled: false,
      setBiometricEnabled: jest.fn(),
      resetAuth: jest.fn(),
      resetWallet: jest.fn(),
      startPinChange: jest.fn(),
      walletExistsRef: { current: true },
      setIsAuthenticated: jest.fn(),
      showToast: jest.fn(),
    };
  });

  describe('Initialization', () => {
    it('should load notifications setting on mount', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'notificationsEnabled') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.notificationsEnabled).toBe(true);
    });

    it('should load showZeroAssets setting on mount', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'showZeroAssets') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.showZeroAssets).toBe(true);
    });

    it('should handle settings load errors gracefully', async () => {
      SecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

      expect(() => {
        renderHook(() => useSettings(mockProps), {
          initialProps: mockProps,
        });
      }).not.toThrow();
    });
  });

  describe('Logout Flow', () => {
    it('should show logout modal when handleLogout is called', () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleLogout();
      });

      expect(result.current.showLogoutModal).toBe(true);
    });

    it('should lock wallet on confirmLogout', () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleLogout();
      });

      act(() => {
        result.current.confirmLogout();
      });

      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(false);
      expect(result.current.showLogoutModal).toBe(false);
    });

    it('should close modal on cancelLogout', () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleLogout();
      });

      act(() => {
        result.current.cancelLogout();
      });

      expect(result.current.showLogoutModal).toBe(false);
      expect(mockProps.setIsAuthenticated).not.toHaveBeenCalled();
    });
  });

  describe('Wallet Deletion Flow', () => {
    it('should show delete modal when handleDeleteWallet is called', () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      expect(result.current.showDeleteModal).toBe(true);
    });

    it('should delete wallet on confirmDeleteWallet with biometric success', async () => {
      AuthService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      AuthService.deleteWalletData.mockResolvedValue(true);

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(AuthService.deleteWalletData).toHaveBeenCalled();
      expect(mockProps.resetWallet).toHaveBeenCalled();
      expect(mockProps.resetAuth).toHaveBeenCalled();
      expect(mockProps.showToast).toHaveBeenCalledWith('Wallet deleted successfully', 'success');
    });

    it('should set pending flag if biometric fails', async () => {
      AuthService.authenticateWithBiometrics.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pendingWalletDelete', 'true');
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(false);
    });

    it('should handle deletion errors', async () => {
      AuthService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      AuthService.deleteWalletData.mockResolvedValue(false);

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith('Failed to delete wallet', 'error');
    });

    it('should cancel deletion on cancelDeleteWallet', () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      act(() => {
        result.current.cancelDeleteWallet();
      });

      expect(result.current.showDeleteModal).toBe(false);
    });
  });

  describe('PIN Change', () => {
    it('should trigger PIN change flow', () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleChangePin();
      });

      expect(mockProps.startPinChange).toHaveBeenCalled();
    });
  });

  describe('View Seed Phrase', () => {
    it('should return REQUEST_VIEW_SEED_PHRASE signal', () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      const signal = result.current.handleViewSeedPhrase();

      expect(signal).toBe('REQUEST_VIEW_SEED_PHRASE');
    });
  });

  describe('Face ID Toggle', () => {
    it('should disable Face ID immediately without modal', async () => {
      mockProps.biometricEnabled = true;

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.handleFaceIdToggle();
      });

      expect(mockProps.setBiometricEnabled).toHaveBeenCalledWith(false);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('biometricEnabled', 'false');
      expect(mockProps.showToast).toHaveBeenCalledWith('Face ID disabled', 'success');
    });

    it('should show modal when enabling Face ID', () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleFaceIdToggle();
      });

      expect(result.current.showFaceIdModal).toBe(true);
    });

    it('should enable Face ID with biometric success', async () => {
      AuthService.authenticateWithBiometrics.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(mockProps.setBiometricEnabled).toHaveBeenCalledWith(true);
      expect(mockProps.showToast).toHaveBeenCalledWith('Face ID enabled', 'success');
    });

    it('should set pending flag if biometric fails', async () => {
      AuthService.authenticateWithBiometrics.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pendingFaceIdEnable', 'true');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth', 'true');
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(false);
    });

    it('should cancel Face ID toggle', () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleFaceIdToggle();
      });

      act(() => {
        result.current.cancelFaceIdToggle();
      });

      expect(result.current.showFaceIdModal).toBe(false);
    });
  });

  describe('Notifications Toggle', () => {
    it('should disable notifications immediately without modal', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'notificationsEnabled') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.handleNotificationsToggle();
      });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('notificationsEnabled', 'false');
      expect(mockProps.showToast).toHaveBeenCalledWith('Notifications disabled', 'success');
    });

    it('should show modal when enabling notifications', async () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        result.current.handleNotificationsToggle();
      });

      expect(result.current.showNotificationsModal).toBe(true);
    });

    it('should cancel notifications toggle', async () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        result.current.handleNotificationsToggle();
      });

      act(() => {
        result.current.cancelNotificationsToggle();
      });

      expect(result.current.showNotificationsModal).toBe(false);
    });
  });

  describe('Show Zero Assets Toggle', () => {
    it('should toggle showZeroAssets setting', async () => {
      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      expect(result.current.showZeroAssets).toBe(false);

      await act(async () => {
        await result.current.handleShowZeroAssetsToggle();
      });

      expect(result.current.showZeroAssets).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('showZeroAssets', 'true');

      await act(async () => {
        await result.current.handleShowZeroAssetsToggle();
      });

      expect(result.current.showZeroAssets).toBe(false);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('showZeroAssets', 'false');
    });
  });

  describe('Error Handling', () => {
    it('should handle SecureStore errors during Face ID disable', async () => {
      mockProps.biometricEnabled = true;
      SecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await result.current.handleFaceIdToggle();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Failed to update Face ID setting',
        'error'
      );
    });

    it('should handle authentication errors during deletion', async () => {
      AuthService.authenticateWithBiometrics.mockRejectedValue(new Error('Auth error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(mockProps.showToast).toHaveBeenCalledWith(
        'Authentication required to delete wallet',
        'error'
      );
    });
  });
});
