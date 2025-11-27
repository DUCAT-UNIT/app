// @ts-nocheck
/**
 * Tests for useSettings Hook
 * Validates settings management including wallet lock, deletion, PIN change, and security toggles
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useSettings } from '../useSettings';
import * as SecureStore from 'expo-secure-store';
import * as BiometricService from '../../services/biometricService';
import * as SecureStorageService from '../../services/secureStorageService';
import { notify } from '../../utils/notify';

// Mock expo-secure-store
jest.mock('expo-secure-store');

// Mock biometricService and secureStorageService
jest.mock('../../services/biometricService');
jest.mock('../../services/secureStorageService');

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
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStorageService.deleteWalletData.mockResolvedValue(true);

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(SecureStorageService.deleteWalletData).toHaveBeenCalled();
      expect(mockProps.resetWallet).toHaveBeenCalled();
      expect(mockProps.resetAuth).toHaveBeenCalled();
      expect(notify.wallet.deleted).toHaveBeenCalled();
    });

    it('should set pending flag if biometric fails', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: false });

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
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStorageService.deleteWalletData.mockResolvedValue(false);

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(notify.wallet.deleteFailed).toHaveBeenCalled();
    });

    it('should handle exceptions during wallet deletion', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStorageService.deleteWalletData.mockRejectedValue(new Error('Deletion error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(notify.wallet.deleteFailed).toHaveBeenCalled();
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
    it('should show modal when disabling Face ID', () => {
      mockProps.biometricEnabled = true;

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleFaceIdToggle();
      });

      expect(result.current.showFaceIdModal).toBe(true);
    });

    it('should disable Face ID on confirmFaceIdToggle', async () => {
      mockProps.biometricEnabled = true;

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(mockProps.setBiometricEnabled).toHaveBeenCalledWith(false);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('biometricEnabled', 'false');
      expect(notify.settings.faceIdDisabled).toHaveBeenCalled();
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
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });

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
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('biometricEnabled', 'true');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth', 'true');
      expect(notify.settings.faceIdEnabled).toHaveBeenCalled();
    });

    it('should handle storage error during Face ID enable after authentication', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStore.setItemAsync.mockImplementation((key, _value) => {
        if (key === 'biometricEnabled') {
          return Promise.reject(new Error('Storage error'));
        }
        return Promise.resolve();
      });

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(notify.settings.faceIdFailed).toHaveBeenCalled();
    });

    it('should handle authentication error during Face ID enable', async () => {
      BiometricService.authenticateWithBiometrics.mockRejectedValue(new Error('Auth error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(notify.auth.requiredForFaceId).toHaveBeenCalled();
    });

    it('should set pending flag if biometric fails', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: false });

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
    it('should show modal when disabling notifications', async () => {
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

      act(() => {
        result.current.handleNotificationsToggle();
      });

      expect(result.current.showNotificationsModal).toBe(true);
    });

    it('should disable notifications on confirmNotificationsToggle', async () => {
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

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(result.current.notificationsEnabled).toBe(false);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('notificationsEnabled', 'false');
      expect(notify.settings.notificationsDisabled).toHaveBeenCalled();
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

    it('should enable notifications with biometric success', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });

      const propsWithBiometric = { ...mockProps, biometricEnabled: true };
      const { result } = renderHook(() => useSettings(propsWithBiometric), {
        initialProps: propsWithBiometric,
      });

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(result.current.notificationsEnabled).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('notificationsEnabled', 'true');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth', 'true');
      expect(notify.settings.notificationsEnabled).toHaveBeenCalled();
    });

    it('should set pending flag if biometric fails for notifications', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: false });

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pendingNotificationsEnable', 'true');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth', 'true');
      expect(mockProps.setIsAuthenticated).toHaveBeenCalledWith(false);
    });

    it('should handle authentication error during notifications enable', async () => {
      BiometricService.authenticateWithBiometrics.mockRejectedValue(new Error('Auth error'));

      const propsWithBiometric = { ...mockProps, biometricEnabled: true };
      const { result } = renderHook(() => useSettings(propsWithBiometric), {
        initialProps: propsWithBiometric,
      });

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(notify.auth.requiredForNotifications).toHaveBeenCalled();
    });

    it('should handle storage error during notifications enable', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStore.setItemAsync.mockImplementation((key, _value) => {
        if (key === 'notificationsEnabled') {
          return Promise.reject(new Error('Storage error'));
        }
        return Promise.resolve();
      });

      const propsWithBiometric = { ...mockProps, biometricEnabled: true };
      const { result } = renderHook(() => useSettings(propsWithBiometric), {
        initialProps: propsWithBiometric,
      });

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(notify.settings.notificationsFailed).toHaveBeenCalled();
    });

    it('should handle storage error during notifications disable', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'notificationsEnabled') return Promise.resolve('true');
        return Promise.resolve(null);
      });
      SecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(notify.settings.notificationsFailed).toHaveBeenCalled();
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

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(notify.settings.faceIdFailed).toHaveBeenCalled();
    });

    it('should handle authentication errors during deletion', async () => {
      BiometricService.authenticateWithBiometrics.mockRejectedValue(new Error('Auth error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(notify.auth.requiredForDeleteWallet).toHaveBeenCalled();
    });
  });

  describe('Without notify (graceful degradation)', () => {
    it('should handle wallet deletion gracefully on auth error', async () => {
      BiometricService.authenticateWithBiometrics.mockRejectedValue(new Error('Auth error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      // Should complete without errors
      expect(mockProps.resetWallet).not.toHaveBeenCalled();
    });

    it('should handle wallet deletion success gracefully', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStorageService.deleteWalletData.mockResolvedValue(true);

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(mockProps.resetWallet).toHaveBeenCalled();
    });

    it('should handle wallet deletion failure gracefully', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStorageService.deleteWalletData.mockResolvedValue(false);

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(mockProps.resetWallet).not.toHaveBeenCalled();
    });

    it('should handle wallet deletion exception gracefully', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStorageService.deleteWalletData.mockRejectedValue(new Error('Delete error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(mockProps.resetWallet).not.toHaveBeenCalled();
    });

    it('should handle Face ID disable gracefully on success', async () => {
      mockProps.biometricEnabled = true;

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(mockProps.setBiometricEnabled).toHaveBeenCalledWith(false);
    });

    it('should handle Face ID disable gracefully on error', async () => {
      mockProps.biometricEnabled = true;
      SecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(mockProps.setBiometricEnabled).toHaveBeenCalledWith(false);
    });

    it('should handle Face ID enable auth error gracefully', async () => {
      BiometricService.authenticateWithBiometrics.mockRejectedValue(new Error('Auth error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleFaceIdToggle();
      });

      await act(async () => {
        await result.current.confirmFaceIdToggle();
      });

      expect(result.current.showFaceIdModal).toBe(false);
    });

    it('should handle Face ID enable success gracefully', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });

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
    });

    it('should handle Face ID enable storage error gracefully', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStore.setItemAsync.mockImplementation((key) => {
        if (key === 'biometricEnabled') {
          return Promise.reject(new Error('Storage error'));
        }
        return Promise.resolve();
      });

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
    });

    it('should handle notifications disable success gracefully', async () => {
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

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(result.current.notificationsEnabled).toBe(false);
    });

    it('should handle notifications disable error gracefully', async () => {
      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'notificationsEnabled') return Promise.resolve('true');
        return Promise.resolve(null);
      });
      SecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(result.current.notificationsEnabled).toBe(false);
    });

    it('should handle notifications enable auth error gracefully', async () => {
      BiometricService.authenticateWithBiometrics.mockRejectedValue(new Error('Auth error'));

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(result.current.showNotificationsModal).toBe(false);
    });

    it('should handle notifications enable success gracefully', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });

      const propsWithBiometric = { ...mockProps, biometricEnabled: true };
      const { result } = renderHook(() => useSettings(propsWithBiometric), {
        initialProps: propsWithBiometric,
      });

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(result.current.notificationsEnabled).toBe(true);
    });

    it('should handle notifications enable storage error gracefully', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStore.setItemAsync.mockImplementation((key) => {
        if (key === 'notificationsEnabled') {
          return Promise.reject(new Error('Storage error'));
        }
        return Promise.resolve();
      });

      const propsWithBiometric = { ...mockProps, biometricEnabled: true };
      const { result } = renderHook(() => useSettings(propsWithBiometric), {
        initialProps: propsWithBiometric,
      });

      act(() => {
        result.current.handleNotificationsToggle();
      });

      await act(async () => {
        await result.current.confirmNotificationsToggle();
      });

      expect(result.current.notificationsEnabled).toBe(true);
    });
  });

  describe('walletExistsRef variations', () => {
    it('should handle wallet deletion with undefined walletExistsRef', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStorageService.deleteWalletData.mockResolvedValue(true);
      mockProps.walletExistsRef = undefined;

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(mockProps.resetWallet).toHaveBeenCalled();
    });

    it('should handle wallet deletion with walletExistsRef.current undefined', async () => {
      BiometricService.authenticateWithBiometrics.mockResolvedValue({ success: true });
      SecureStorageService.deleteWalletData.mockResolvedValue(true);
      mockProps.walletExistsRef = { current: undefined };

      const { result } = renderHook(() => useSettings(mockProps), {
        initialProps: mockProps,
      });

      act(() => {
        result.current.handleDeleteWallet();
      });

      await act(async () => {
        await result.current.confirmDeleteWallet();
      });

      expect(mockProps.resetWallet).toHaveBeenCalled();
    });
  });

});

