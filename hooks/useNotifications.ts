/**
 * useNotifications Hook
 * Handles push notification permissions, sending local notifications,
 * and routing notification tap responses to the appropriate screen.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Subscription } from 'expo-notifications';
import type { DisplayAssetType } from '../types/assets';
import { sendLocalNotification, initializePushNotifications } from '../services/pushNotificationService';
import { getNotificationsEnabled } from '../services/settingsService';
import { isE2E } from '../utils/e2e';
import { logger } from '../utils/logger';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // For backwards compatibility
    shouldShowBanner: true, // Show banner notification
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

type TransactionType = 'deposit' | 'withdraw';

/** Notification data type for routing on tap */
export type NotificationDataType =
  | 'tx_confirmed'
  | 'vault_health'
  | 'liquidation_opportunity'
  | 'swap_complete';

/** Callback for handling notification taps with routing data */
export type NotificationResponseHandler = (dataType: NotificationDataType) => void;

interface UseNotificationsReturn {
  sendTransactionConfirmedNotification: (assetType: DisplayAssetType, amount: string, txid: string, type?: TransactionType) => Promise<void>;
  registerForPushNotificationsAsync: () => Promise<boolean>;
}

export function useNotifications(
  onNotificationResponse?: NotificationResponseHandler,
  walletAddress?: string,
): UseNotificationsReturn {
  const notificationListener = useRef<Subscription | undefined>(undefined);
  const responseListener = useRef<Subscription | undefined>(undefined);

  // Initialize push notifications when wallet is available and notifications enabled
  useEffect(() => {
    if (isE2E || !walletAddress) return;
    void (async () => {
      const enabled = await getNotificationsEnabled();
      if (enabled) {
        const token = await initializePushNotifications(walletAddress);
        if (token) {
          logger.info('[Notifications] Push token registered', { token: token.substring(0, 20) });
        }
      }
    })();
  }, [walletAddress]);

  useEffect(() => {
    // Request permissions on mount
    registerForPushNotificationsAsync();

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        logger.debug('[Notifications] Foreground notification received', {
          title: notification.request.content.title,
        });
      }
    );

    // Listen for user interactions with notifications (tap handling)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | { type?: NotificationDataType }
          | undefined;

        const dataType = data?.type;
        logger.info('[Notifications] Notification tapped', { dataType });

        if (dataType && onNotificationResponse) {
          onNotificationResponse(dataType);
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [onNotificationResponse]);

  /**
   * Request notification permissions
   */
  const registerForPushNotificationsAsync = async (): Promise<boolean> => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return true;
    } catch (error: unknown) {
      return false;
    }
  };

  /**
   * Send a local notification for transaction confirmation
   */
  const sendTransactionConfirmedNotification = useCallback(async (
    assetType: DisplayAssetType,
    amount: string,
    txid: string,
    type: TransactionType = 'withdraw'
  ): Promise<void> => {
    if (isE2E) return;

    try {
      const action = type === 'deposit' ? 'Received' : 'Sent';
      const title = `${action} ${assetType}`;
      const body = `${action} ${amount} ${assetType} successfully.`;

      await sendLocalNotification({
        title,
        body,
        data: { type: 'tx_confirmed' as const, txid, assetType },
      });
    } catch (error: unknown) {
      logger.error('[Notifications] Failed to send transaction notification', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  return {
    sendTransactionConfirmedNotification,
    registerForPushNotificationsAsync,
  };
}
