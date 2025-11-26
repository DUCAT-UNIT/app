/**
 * Onboarding Helper Functions
 * Utilities for managing onboarding state
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Reset all onboarding state
 * Clears all persisted onboarding data from AsyncStorage
 */
export const resetOnboardingState = async (): Promise<void> => {
  try {
    // Clear all onboarding-related AsyncStorage keys
    await Promise.all([
      AsyncStorage.removeItem('wallet_creation_state'),
      AsyncStorage.removeItem('wallet_import_state'),
      AsyncStorage.removeItem('seed_verification_state'),
      AsyncStorage.removeItem('onboarding_state'), // Legacy key from old useOnboarding
    ]);
  } catch (error) {
    // Silently fail
  }
};
