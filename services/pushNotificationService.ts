/**
 * Push Notification Service
 * Handles Expo push token registration, backend token management, and local notifications.
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API } from '../utils/constants';
import { postJSON } from '../utils/apiClient';
import { isE2E } from '../utils/e2e';
import { logger } from '../utils/logger';

/**
 * Get the Expo push token for this device.
 * Returns null if permissions are not granted or running in E2E mode.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (isE2E) {
    logger.debug('[PushNotification] Skipped token retrieval in E2E mode');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        logger.info('[PushNotification] Push notification permission not granted');
        return null;
      }
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId
      ?? Constants.expoConfig?.owner;

    if (!projectId) {
      logger.warn('[PushNotification] No projectId found for push token');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    logger.info('[PushNotification] Push token obtained', { token: tokenData.data.slice(0, 20) + '...' });
    return tokenData.data;
  } catch (error: unknown) {
    logger.error('[PushNotification] Failed to get push token', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Register a push token with the backend server.
 * @param token - Expo push token string
 * @param walletAddress - The wallet's primary address for association
 * @param vaultPubkey - Optional taproot pubkey for vault health monitoring
 */
export async function registerPushToken(token: string, walletAddress: string, vaultPubkey?: string): Promise<void> {
  if (isE2E) return;

  try {
    await postJSON('https://notifications.ducatprotocol.com/api/register', {
      token,
      walletAddress,
      vaultPubkey,
      network: 'mutinynet',
    });
    logger.info('[PushNotification] Token registered with backend');
  } catch (error: unknown) {
    logger.error('[PushNotification] Failed to register push token', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Unregister a push token from the backend server.
 * @param token - Expo push token string to unregister
 */
export async function unregisterPushToken(token: string): Promise<void> {
  if (isE2E) return;

  try {
    await postJSON('https://notifications.ducatprotocol.com/api/unregister', { token });
    logger.info('[PushNotification] Token unregistered from backend');
  } catch (error: unknown) {
    logger.error('[PushNotification] Failed to unregister push token', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Send a local notification (used for foreground alerts like vault health, tx confirmation).
 * @param params - Notification content
 */
export async function sendLocalNotification(params: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (isE2E) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        sound: true,
      },
      trigger: null, // Deliver immediately
    });
    logger.debug('[PushNotification] Local notification sent', { title: params.title });
  } catch (error: unknown) {
    logger.error('[PushNotification] Failed to send local notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Initialize push notifications on app start.
 * Requests permissions, obtains a push token, registers it with the backend,
 * and configures the Android notification channel.
 *
 * @param walletAddress - The wallet's primary address for backend association
 * @param vaultPubkey - Optional taproot pubkey for vault health monitoring
 * @returns The Expo push token, or null if initialization failed
 */
export async function initializePushNotifications(walletAddress: string, vaultPubkey?: string): Promise<string | null> {
  if (isE2E) {
    logger.debug('[PushNotification] Skipped initialization in E2E mode');
    return null;
  }

  try {
    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const token = await getExpoPushToken();
    if (token) {
      await registerPushToken(token, walletAddress, vaultPubkey);
    }

    logger.info('[PushNotification] Initialization complete', { hasToken: !!token });
    return token;
  } catch (error: unknown) {
    logger.error('[PushNotification] Initialization failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
