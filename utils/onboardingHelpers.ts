/**
 * Onboarding Helper Functions
 * Utilities for managing onboarding state
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SEED_RESTORE_REQUEST_KEY = 'ducat_open_seed_restore_next_v1';

/**
 * Reset all onboarding state
 * Clears all persisted onboarding data from AsyncStorage
 */
export const resetOnboardingState = async (): Promise<void> => {
  try {
    // Clear all onboarding-related AsyncStorage keys
    await Promise.all([
      AsyncStorage.removeItem('wallet_import_state'),
      AsyncStorage.removeItem('seed_verification_state'),
      AsyncStorage.removeItem('onboarding_state'), // Legacy key from old useOnboarding
    ]);
  } catch (error: unknown) {
    // Silently fail
  }
};

export const requestSeedRestoreOnNextLaunch = async (): Promise<void> => {
  await AsyncStorage.setItem(SEED_RESTORE_REQUEST_KEY, 'true');
};

export const clearSeedRestoreRequest = async (): Promise<void> => {
  await AsyncStorage.removeItem(SEED_RESTORE_REQUEST_KEY);
};

export const consumeSeedRestoreRequest = async (): Promise<boolean> => {
  const requested = await AsyncStorage.getItem(SEED_RESTORE_REQUEST_KEY);

  if (requested === 'true') {
    await clearSeedRestoreRequest();
    return true;
  }

  return false;
};
