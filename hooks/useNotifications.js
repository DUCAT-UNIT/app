/**
 * useNotifications Hook
 * Handles push notification permissions and sending local notifications
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // For backwards compatibility
    shouldShowBanner: true, // Show banner notification
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  const notificationListener = useRef();
  const responseListener = useRef();

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
  const registerForPushNotificationsAsync = async () => {
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
    } catch (error) {
      return false;
    }
  };

  /**
   * Send a local notification for transaction confirmation
   * @param {string} assetType - 'BTC' or 'UNIT'
   * @param {string} amount - Amount sent (formatted)
   * @param {string} txid - Transaction ID
   * @param {string} type - 'deposit' or 'withdraw'
   */
  const sendTransactionConfirmedNotification = async (
    assetType,
    amount,
    txid,
    type = 'withdraw'
  ) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Transaction Confirmed',
          body: `The ${type} transaction for ${amount} ${assetType} has been confirmed on Mutinynet.`,
          data: { txid, assetType, amount, type },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // null means immediate
      });
    } catch (error) {}
  };

  return {
    sendTransactionConfirmedNotification,
    registerForPushNotificationsAsync,
  };
}
