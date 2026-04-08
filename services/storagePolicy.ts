import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/logger';

export const DEVICE_ONLY = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} as const;

// Keys that are safe to migrate from SecureStore to AsyncStorage (non-sensitive preferences only)
const MIGRATABLE_PREFERENCE_KEYS = new Set([
  'notificationsEnabled',
  'showZeroAssets',
  'advancedMode',
  'ecashThreshold',
  'displayCurrency',
  'priceDisplayMode',
  'autoLockEnabled',
  'autoLockTimeout',
]);

const migrateLegacyPreferenceFromSecureStore = async (key: string): Promise<string | null> => {
  if (!MIGRATABLE_PREFERENCE_KEYS.has(key)) {
    logger.warn('[StoragePolicy] Attempted to migrate non-allowlisted key from SecureStore', { key });
    return null;
  }

  const legacyValue = await SecureStore.getItemAsync(key);
  if (legacyValue == null) {
    return null;
  }

  await AsyncStorage.setItem(key, legacyValue);
  await SecureStore.deleteItemAsync(key);
  return legacyValue;
};

export const getPreferenceItem = async (key: string): Promise<string | null> => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value != null) {
      return value;
    }

    return await migrateLegacyPreferenceFromSecureStore(key);
  } catch (error: unknown) {
    logger.error('[storagePolicy] Failed to read preference item', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      return (await SecureStore.getItemAsync(key)) ?? null;
    } catch (fallbackError: unknown) {
      logger.error('[storagePolicy] SecureStore fallback read failed', {
        key,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
      return null;
    }
  }
};

export const setPreferenceItem = async (key: string, value: string): Promise<void> => {
  await AsyncStorage.setItem(key, value);

  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error: unknown) {
    logger.debug('[storagePolicy] Failed to delete legacy SecureStore preference', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const deletePreferenceItem = async (key: string): Promise<void> => {
  const results = await Promise.allSettled([
    AsyncStorage.removeItem(key),
    SecureStore.deleteItemAsync(key),
  ]);

  if (results.every((result) => result.status === 'rejected')) {
    throw new Error(`Failed to delete preference item "${key}"`);
  }
};

export const preferenceItemExists = async (key: string): Promise<boolean> => {
  return (await getPreferenceItem(key)) !== null;
};

export const clearPreferenceItems = async (keys: string[]): Promise<void> => {
  await Promise.allSettled(keys.map((key) => deletePreferenceItem(key)));
};

export const getDeviceOnlyItem = async (key: string): Promise<string | null> => {
  return SecureStore.getItemAsync(key);
};

export const setDeviceOnlyItem = async (key: string, value: string): Promise<void> => {
  await SecureStore.setItemAsync(key, value, DEVICE_ONLY);
};
