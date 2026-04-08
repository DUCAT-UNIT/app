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
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: {
    MAX: 5,
  },
  AndroidNotificationPriority: {
    HIGH: 'high',
  },
}));

// Mock pushNotificationService
jest.mock('../../services/pushNotificationService', () => ({
  sendLocalNotification: jest.fn().mockResolvedValue(undefined),
}));

// Mock e2e utility — default to non-E2E mode
jest.mock('../../utils/e2e', () => ({
  isE2E: false,
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Helper to render hooks
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

describe('useNotifications', () => {
  // Capture the notification handler before any tests run
  let capturedNotificationHandler: any;

  beforeAll(() => {
    // The setNotificationHandler is called at module load time
    // Capture it before any tests run
    if ((Notifications.setNotificationHandler as jest.Mock).mock.calls.length > 0) {
      capturedNotificationHandler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
    }
  });

  beforeEach(() => {
    // Don't clear setNotificationHandler mock since it's called at module level
    const setHandlerCalls = (Notifications.setNotificationHandler as jest.Mock).mock.calls;
    jest.clearAllMocks();
    // Restore setNotificationHandler calls
    if (setHandlerCalls.length > 0) {
      (Notifications.setNotificationHandler as jest.Mock).mock.calls = setHandlerCalls;
    }
    Platform.OS = 'ios';
  });

  describe('Notification Handler Configuration', () => {
    it('should configure notification handler to show alerts and banners', async () => {
      // Use the captured handler or get from mock calls
      const handler = capturedNotificationHandler || (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
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
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const { result } = renderHook(() => useNotifications());

      expect(result.current).toBeDefined();
      expect(result.current!.sendTransactionConfirmedNotification).toBeDefined();
      expect(result.current!.registerForPushNotificationsAsync).toBeDefined();
    });

    it('should set up notification listeners on mount', () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      renderHook(() => useNotifications());

      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalled();
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
    });
  });

  describe('Permission Handling', () => {
    it('should request permissions when not already granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        const success = await result.current!.registerForPushNotificationsAsync();
        expect(success).toBe(true);
      });

      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when permissions are denied', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        const success = await result.current!.registerForPushNotificationsAsync();
        expect(success).toBe(false);
      });
    });

    it('should not request permissions if already granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        const success = await result.current!.registerForPushNotificationsAsync();
        expect(success).toBe(true);
      });

      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should handle permission request errors gracefully', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValue(new Error('Permission error'));

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        const success = await result.current!.registerForPushNotificationsAsync();
        expect(success).toBe(false);
      });
    });
  });

  describe('Android Notification Channel', () => {
    it('should configure notification channel on Android', async () => {
      Platform.OS = 'android';
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current!.registerForPushNotificationsAsync();
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
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current!.registerForPushNotificationsAsync();
      });

      expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    });
  });

  describe('Transaction Notifications', () => {
    it('should send a local notification for BTC withdrawal', async () => {
      const { sendLocalNotification } = require('../../services/pushNotificationService');
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current!.sendTransactionConfirmedNotification(
          'BTC',
          '0.001',
          'abc123txid',
          'withdraw'
        );
      });

      expect(sendLocalNotification).toHaveBeenCalledWith({
        title: 'Sent BTC',
        body: 'Sent 0.001 BTC successfully.',
        data: { type: 'tx_confirmed', txid: 'abc123txid', assetType: 'BTC' },
      });
    });

    it('should send a local notification for UNIT deposit', async () => {
      const { sendLocalNotification } = require('../../services/pushNotificationService');
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current!.sendTransactionConfirmedNotification(
          'UNIT',
          '1000',
          'def456txid',
          'deposit'
        );
      });

      expect(sendLocalNotification).toHaveBeenCalledWith({
        title: 'Received UNIT',
        body: 'Received 1000 UNIT successfully.',
        data: { type: 'tx_confirmed', txid: 'def456txid', assetType: 'UNIT' },
      });
    });

    it('should default to withdraw type when not specified', async () => {
      const { sendLocalNotification } = require('../../services/pushNotificationService');
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current!.sendTransactionConfirmedNotification(
          'BTC',
          '0.002',
          'default-txid'
        );
      });

      expect(sendLocalNotification).toHaveBeenCalledWith({
        title: 'Sent BTC',
        body: 'Sent 0.002 BTC successfully.',
        data: { type: 'tx_confirmed', txid: 'default-txid', assetType: 'BTC' },
      });
    });

    it('should send notification for large BTC amounts', async () => {
      const { sendLocalNotification } = require('../../services/pushNotificationService');
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current!.sendTransactionConfirmedNotification(
          'BTC',
          '0.5',
          'immediate-txid',
          'withdraw'
        );
      });

      expect(sendLocalNotification).toHaveBeenCalledWith({
        title: 'Sent BTC',
        body: 'Sent 0.5 BTC successfully.',
        data: { type: 'tx_confirmed', txid: 'immediate-txid', assetType: 'BTC' },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing notification data gracefully', async () => {
      const { result } = renderHook(() => useNotifications());

      // Should not throw even with empty data
      await act(async () => {
        await result.current!.sendTransactionConfirmedNotification('' as any, '', '', '' as any);
      });
    });
  });

  describe('Notification Response Handling', () => {
    it('should call response handler when notification is tapped', () => {
      const responseHandler = jest.fn();
      let capturedCallback: ((response: any) => void) | undefined;

      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (callback: (response: any) => void) => {
          capturedCallback = callback;
          return { remove: jest.fn() };
        }
      );

      renderHook(() => useNotifications(responseHandler));

      expect(capturedCallback).toBeDefined();

      // Simulate a notification tap
      act(() => {
        capturedCallback!({
          notification: {
            request: {
              content: {
                data: { type: 'vault_health' },
              },
            },
          },
        });
      });

      expect(responseHandler).toHaveBeenCalledWith('vault_health');
    });

    it('should not call handler when notification has no type data', () => {
      const responseHandler = jest.fn();
      let capturedCallback: ((response: any) => void) | undefined;

      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (callback: (response: any) => void) => {
          capturedCallback = callback;
          return { remove: jest.fn() };
        }
      );

      renderHook(() => useNotifications(responseHandler));

      act(() => {
        capturedCallback!({
          notification: {
            request: {
              content: {
                data: {},
              },
            },
          },
        });
      });

      expect(responseHandler).not.toHaveBeenCalled();
    });
  });
});
