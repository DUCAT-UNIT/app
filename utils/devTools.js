/**
 * Development Tools
 * Helper functions for testing and debugging
 * DO NOT USE IN PRODUCTION
 */

/* eslint-disable no-console */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * DANGER: Completely wipe all app data
 * Use this to reset to onboarding screen for testing
 */
export const nukeAllData = async () => {
  try {
    // Clear AsyncStorage
    await AsyncStorage.clear();

    // Clear SecureStore keys
    const secureKeys = [
      'mnemonic',
      'mnemonic_account_1',
      'mnemonic_account_2',
      'pin_hash',
      'biometric_enabled',
      'seed_confirmed',
      'pending_transactions',
      'temp_mnemonic',
    ];

    await Promise.all(
      secureKeys.map((key) =>
        SecureStore.deleteItemAsync(key).catch(() => {
          // Key might not exist, that's okay
        })
      )
    );

    console.log('✅ All app data wiped! Reload app to see onboarding.');
    return true;
  } catch (error) {
    console.error('❌ Failed to wipe data:', error);
    return false;
  }
};

/**
 * Log all current storage state (for debugging)
 */
export const logAllData = async () => {
  try {
    // AsyncStorage
    const asyncKeys = await AsyncStorage.getAllKeys();
    console.log('📦 AsyncStorage Keys:', asyncKeys);

    for (const key of asyncKeys) {
      const value = await AsyncStorage.getItem(key);
      console.log(`  ${key}:`, value?.substring(0, 100) + '...');
    }

    // SecureStore (can't enumerate keys, so check known ones)
    const secureKeys = ['mnemonic', 'pin_hash', 'biometric_enabled', 'seed_confirmed'];
    console.log('🔐 SecureStore Values:');
    for (const key of secureKeys) {
      const value = await SecureStore.getItemAsync(key);
      if (value) {
        console.log(`  ${key}: [EXISTS]`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to log data:', error);
  }
};
