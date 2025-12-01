/**
 * useNotifications Hook
 * Handles push notification permissions and sending local notifications
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Subscription } from 'expo-notifications';
import type { DisplayAssetType } from '../types/assets';

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

interface UseNotificationsReturn {
  sendTransactionConfirmedNotification: (assetType: DisplayAssetType, amount: string, txid: string, type?: TransactionType) => Promise<void>;
  registerForPushNotificationsAsync: () => Promise<boolean>;
}

export function useNotifications(): UseNotificationsReturn {
  const notificationListener = useRef<Subscription | undefined>(undefined);
  const responseListener = useRef<Subscription | undefined>(undefined);

  useEffect(() => {
    // Request permissions on mount
    registerForPushNotificationsAsync();

    // Note: Background fetch disabled - requires backend server for true background notifications
    // registerBackgroundFetchAsync();

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {}
    );

    // Listen for user interactions with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (_response) => {}
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

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
  const sendTransactionConfirmedNotification = async (
    _assetType: DisplayAssetType,
    _amount: string,
    _txid: string,
    _type: TransactionType = 'withdraw'
  ): Promise<void> => {
    try {
      // Push notifications disabled - using snackbars only
      // Format message based on asset type
      // Notification removed - snackbars are used instead
      // const notificationId = await Notifications.scheduleNotificationAsync({...});

      // Auto-dismiss timer removed
      // setTimeout(async () => {
      //   try {
      //     await Notifications.dismissNotificationAsync(notificationId);
      //   } catch (dismissError) {
      //     // Silently fail if notification already dismissed
      //   }
      // }, 15000);
    } catch (error: unknown) {
      // Notification functionality disabled - using snackbars only
      // Silently ignore since this is intentionally a no-op
    }
  };

  return {
    sendTransactionConfirmedNotification,
    registerForPushNotificationsAsync,
  };
}
