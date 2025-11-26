// @ts-nocheck
/**
 * Tests for useNotifications Hook
 * Validates push notification permissions and local notification sending
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useNotifications } from '../useNotifications';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: {
    MAX: 5,
  },
  AndroidNotificationPriority: {
    HIGH: 'high',
  },
}));

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
    unmount: () => component.unmount(),
  };
}

describe('useNotifications', () => {
  // Capture the notification handler before any tests run
  let capturedNotificationHandler;

  beforeAll(() => {
    // The setNotificationHandler is called at module load time
    // Capture it before any tests run
    if (Notifications.setNotificationHandler.mock.calls.length > 0) {
      capturedNotificationHandler = Notifications.setNotificationHandler.mock.calls[0][0];
    }
  });

  beforeEach(() => {
    // Don't clear setNotificationHandler mock since it's called at module level
    const setHandlerCalls = Notifications.setNotificationHandler.mock.calls;
    jest.clearAllMocks();
    // Restore setNotificationHandler calls
    if (setHandlerCalls.length > 0) {
      Notifications.setNotificationHandler.mock.calls = setHandlerCalls;
    }
    Platform.OS = 'ios';
  });

  describe('Notification Handler Configuration', () => {
    it('should configure notification handler to show alerts and banners', async () => {
      // Use the captured handler or get from mock calls
      const handler = capturedNotificationHandler || Notifications.setNotificationHandler.mock.calls[0][0];
      expect(handler).toBeDefined();
      expect(handler.handleNotification).toBeDefined();

      // Call the handleNotification function and verify it returns correct config
      const config = await handler.handleNotification();

      expect(config).toEqual({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowList: true,
      });
    });
  });

  describe('Initialization', () => {
    it('should initialize and request permissions on mount', () => {
      Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const { result } = renderHook(() => useNotifications());

      expect(result.current).toBeDefined();
      expect(result.current.sendTransactionConfirmedNotification).toBeDefined();
      expect(result.current.registerForPushNotificationsAsync).toBeDefined();
    });

    it('should set up notification listeners on mount', () => {
      Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

      renderHook(() => useNotifications());

      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalled();
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
    });



  });

  describe('Permission Handling', () => {
    it('should request permissions when not already granted', async () => {
      Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
      Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        const success = await result.current.registerForPushNotificationsAsync();
        expect(success).toBe(true);
      });

      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when permissions are denied', async () => {
      Notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
      Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        const success = await result.current.registerForPushNotificationsAsync();
        expect(success).toBe(false);
      });
    });

    it('should not request permissions if already granted', async () => {
      Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        const success = await result.current.registerForPushNotificationsAsync();
        expect(success).toBe(true);
      });

      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should handle permission request errors gracefully', async () => {
      Notifications.getPermissionsAsync.mockRejectedValue(new Error('Permission error'));

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        const success = await result.current.registerForPushNotificationsAsync();
        expect(success).toBe(false);
      });
    });
  });

  describe('Android Notification Channel', () => {
    it('should configure notification channel on Android', async () => {
      Platform.OS = 'android';
      Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.registerForPushNotificationsAsync();
      });

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', {
        name: 'default',
        importance: 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    });

    it('should not configure notification channel on iOS', async () => {
      Platform.OS = 'ios';
      Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.registerForPushNotificationsAsync();
      });

      expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    });
  });

  describe('Transaction Notifications', () => {
    it('should call sendTransactionConfirmedNotification without errors (notifications disabled)', async () => {
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.sendTransactionConfirmedNotification(
          'BTC',
          '0.001',
          'abc123txid',
          'withdraw'
        );
      });

      // Notifications are disabled - function should complete without throwing
      // No notification should be scheduled since feature is disabled
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should handle UNIT transaction notification call (notifications disabled)', async () => {
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.sendTransactionConfirmedNotification(
          'UNIT',
          '1000',
          'def456txid',
          'deposit'
        );
      });

      // Notifications are disabled - function should complete without throwing
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should accept type parameter with default value (notifications disabled)', async () => {
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        // Call without the type parameter to test default value
        await result.current.sendTransactionConfirmedNotification(
          'BTC',
          '0.002',
          'default-txid'
        );
      });

      // Notifications are disabled - function should complete without errors
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });


    it('should complete successfully without scheduling (notifications disabled)', async () => {
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.sendTransactionConfirmedNotification(
          'BTC',
          '0.5',
          'immediate-txid',
          'withdraw'
        );
      });

      // Notifications are disabled - no scheduling should occur
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing notification data gracefully', async () => {
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.sendTransactionConfirmedNotification('', '', '', '');
      });

      // Notifications are disabled - function should not throw even with empty data
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

  });
});
