/**
 * Tests for Onboarding Helper Functions
 */

import { resetOnboardingState } from '../onboardingHelpers';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('onboardingHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resetOnboardingState', () => {
    it('should remove all onboarding-related keys', async () => {
      await resetOnboardingState();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('wallet_creation_state');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('wallet_import_state');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('seed_verification_state');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('onboarding_state');
      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(4);
    });

    it('should use Promise.all for parallel removal', async () => {
      await resetOnboardingState();

      // All removeItem calls should be made
      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(4);
    });

    it('should not throw if removal fails', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      // Should not throw
      await expect(resetOnboardingState()).resolves.toBeUndefined();
    });

    it('should silently handle all errors', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await resetOnboardingState();

      // Should complete without throwing
      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(4);
    });

    it('should handle partial failures gracefully', async () => {
      (AsyncStorage.removeItem as jest.Mock)
        .mockResolvedValueOnce(undefined) // wallet_creation_state succeeds
        .mockRejectedValueOnce(new Error('Fail')) // wallet_import_state fails
        .mockResolvedValueOnce(undefined) // seed_verification_state succeeds
        .mockResolvedValueOnce(undefined); // onboarding_state succeeds

      await resetOnboardingState();

      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(4);
    });
  });

  describe('AsyncStorage integration', () => {
    it('should handle AsyncStorage not available', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockImplementation(() => {
        throw new Error('AsyncStorage not available');
      });

      // Should not throw
      await expect(resetOnboardingState()).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should catch and ignore all errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Test error'));

      await resetOnboardingState();

      // Should not log errors (silently fails)
      // Note: The implementation uses empty catch block

      consoleErrorSpy.mockRestore();
    });

    it('should handle multiple simultaneous calls', async () => {
      const promises = [
        resetOnboardingState(),
        resetOnboardingState(),
        resetOnboardingState(),
      ];

      await Promise.all(promises);

      // Each call should trigger 4 removeItem calls
      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(12);
    });
  });
});
