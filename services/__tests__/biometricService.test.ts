// @ts-nocheck
/**
 * Tests for Biometric Authentication Service
 */

import {
  checkBiometricLockout,
  recordBiometricAttempt,
  checkBiometricSupport,
  authenticateWithBiometrics,
  isBiometricEnabled,
  setBiometricEnabled,
} from '../biometricService';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

// Mock expo-secure-store
jest.mock('expo-secure-store');

// Mock expo-local-authentication
jest.mock('expo-local-authentication');

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock pinLockout
jest.mock('../pinLockout', () => ({
  resetPinAttempts: jest.fn().mockResolvedValue(undefined),
}));

// Typed mock references
const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;
const mockHasHardwareAsync = LocalAuthentication.hasHardwareAsync as jest.MockedFunction<typeof LocalAuthentication.hasHardwareAsync>;
const mockIsEnrolledAsync = LocalAuthentication.isEnrolledAsync as jest.MockedFunction<typeof LocalAuthentication.isEnrolledAsync>;
const mockAuthenticateAsync = LocalAuthentication.authenticateAsync as jest.MockedFunction<typeof LocalAuthentication.authenticateAsync>;

describe('BiometricService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkBiometricLockout', () => {
    it('should not throw when no lockout exists', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      await expect(checkBiometricLockout()).resolves.not.toThrow();
    });

    it('should throw error when lockout is active', async () => {
      // Lockout expires in 5 minutes from now
      const lockoutTime = 1000000 + (5 * 60 * 1000);
      mockGetItemAsync.mockResolvedValue(lockoutTime.toString());

      await expect(checkBiometricLockout()).rejects.toThrow(
        'Too many failed biometric attempts'
      );
    });

    it('should include remaining minutes in error message (singular)', async () => {
      // Lockout expires in 1 minute from now
      const lockoutTime = 1000000 + (1 * 60 * 1000);
      mockGetItemAsync.mockResolvedValue(lockoutTime.toString());

      await expect(checkBiometricLockout()).rejects.toThrow(
        'Please try again in 1 minute or use your PIN'
      );
    });

    it('should include remaining minutes in error message (plural)', async () => {
      // Lockout expires in 10 minutes from now
      const lockoutTime = 1000000 + (10 * 60 * 1000);
      mockGetItemAsync.mockResolvedValue(lockoutTime.toString());

      await expect(checkBiometricLockout()).rejects.toThrow(
        'Please try again in 10 minutes or use your PIN'
      );
    });

    it('should clear expired lockout', async () => {
      // Lockout expired 1 minute ago
      const lockoutTime = 1000000 - (1 * 60 * 1000);
      mockGetItemAsync.mockResolvedValue(lockoutTime.toString());
      mockDeleteItemAsync.mockResolvedValue();

      await expect(checkBiometricLockout()).resolves.not.toThrow();

      expect(mockDeleteItemAsync).toHaveBeenCalledWith('biometric_lockout_until_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('biometric_failed_attempts_v1');
    });

    it('should ceil remaining minutes correctly', async () => {
      // Lockout expires in 2.5 minutes (should ceil to 3)
      const lockoutTime = 1000000 + (2.5 * 60 * 1000);
      mockGetItemAsync.mockResolvedValue(lockoutTime.toString());

      await expect(checkBiometricLockout()).rejects.toThrow(
        'Please try again in 3 minutes or use your PIN'
      );
    });
  });

  describe('recordBiometricAttempt', () => {
    it('should clear failed attempts on success', async () => {
      mockDeleteItemAsync.mockResolvedValue();
      const { resetPinAttempts } = require('../pinLockout');

      await recordBiometricAttempt(true);

      expect(mockDeleteItemAsync).toHaveBeenCalledWith('biometric_failed_attempts_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('biometric_lockout_until_v1');
      expect(resetPinAttempts).toHaveBeenCalled();
    });

    it('should increment failed attempts on failure', async () => {
      mockGetItemAsync.mockResolvedValue('2');
      mockSetItemAsync.mockResolvedValue();

      await recordBiometricAttempt(false);

      expect(mockSetItemAsync).toHaveBeenCalledWith('biometric_failed_attempts_v1', '3');
    });

    it('should start from 1 when no previous attempts', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      mockSetItemAsync.mockResolvedValue();

      await recordBiometricAttempt(false);

      expect(mockSetItemAsync).toHaveBeenCalledWith('biometric_failed_attempts_v1', '1');
    });

    it('should trigger lockout after max attempts', async () => {
      mockGetItemAsync.mockResolvedValue('4'); // 4 failed attempts already
      mockSetItemAsync.mockResolvedValue();

      // This will be the 5th attempt (max)
      await expect(recordBiometricAttempt(false)).rejects.toThrow(
        'Too many failed biometric attempts (5/5)'
      );

      expect(mockSetItemAsync).toHaveBeenCalledWith('biometric_failed_attempts_v1', '5');
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'biometric_lockout_until_v1',
        expect.any(String)
      );
    });

    it('should set 15 minute lockout duration', async () => {
      const currentTime = 1000000;
      mockGetItemAsync.mockResolvedValue('4');
      mockSetItemAsync.mockResolvedValue();

      await expect(recordBiometricAttempt(false)).rejects.toThrow();

      // 15 minutes = 15 * 60 * 1000 = 900000
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'biometric_lockout_until_v1',
        (currentTime + 900000).toString()
      );
    });

    it('should not trigger lockout before max attempts', async () => {
      mockGetItemAsync.mockResolvedValue('3'); // 3 failed attempts
      mockSetItemAsync.mockResolvedValue();

      // 4th attempt - still below max (5)
      await expect(recordBiometricAttempt(false)).resolves.not.toThrow();

      expect(mockSetItemAsync).toHaveBeenCalledWith('biometric_failed_attempts_v1', '4');
      expect(mockSetItemAsync).not.toHaveBeenCalledWith('biometric_lockout_until_v1', expect.any(String));
    });
  });

  describe('checkBiometricSupport', () => {
    it('should return true when hardware exists and biometrics enrolled', async () => {
      mockHasHardwareAsync.mockResolvedValue(true);
      mockIsEnrolledAsync.mockResolvedValue(true);

      const result = await checkBiometricSupport();

      expect(result).toBe(true);
    });

    it('should return false when no hardware', async () => {
      mockHasHardwareAsync.mockResolvedValue(false);
      mockIsEnrolledAsync.mockResolvedValue(true);

      const result = await checkBiometricSupport();

      expect(result).toBe(false);
    });

    it('should return false when not enrolled', async () => {
      mockHasHardwareAsync.mockResolvedValue(true);
      mockIsEnrolledAsync.mockResolvedValue(false);

      const result = await checkBiometricSupport();

      expect(result).toBe(false);
    });

    it('should return false when both checks fail', async () => {
      mockHasHardwareAsync.mockResolvedValue(false);
      mockIsEnrolledAsync.mockResolvedValue(false);

      const result = await checkBiometricSupport();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockHasHardwareAsync.mockRejectedValue(new Error('Hardware check failed'));

      const result = await checkBiometricSupport();

      expect(result).toBe(false);
    });
  });

  describe('authenticateWithBiometrics', () => {
    it('should return success when authentication succeeds', async () => {
      mockGetItemAsync.mockResolvedValue(null); // No lockout
      mockAuthenticateAsync.mockResolvedValue({ success: true });
      mockDeleteItemAsync.mockResolvedValue();

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({
        success: true,
        error: undefined,
      });
    });

    it('should return failure with error when authentication fails', async () => {
      mockGetItemAsync.mockResolvedValue(null); // No lockout
      mockAuthenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_cancel',
      });
      mockSetItemAsync.mockResolvedValue();

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({
        success: false,
        error: 'user_cancel',
      });
    });

    it('should use custom prompt message', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      mockAuthenticateAsync.mockResolvedValue({ success: true });
      mockDeleteItemAsync.mockResolvedValue();

      await authenticateWithBiometrics('Custom prompt', 'Custom fallback');

      expect(mockAuthenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Custom prompt',
        fallbackLabel: 'Custom fallback',
        disableDeviceFallback: false,
      });
    });

    it('should use default prompt message', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      mockAuthenticateAsync.mockResolvedValue({ success: true });
      mockDeleteItemAsync.mockResolvedValue();

      await authenticateWithBiometrics();

      expect(mockAuthenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });
    });

    it('should handle lockout error from checkBiometricLockout', async () => {
      const lockoutTime = 1000000 + (5 * 60 * 1000);
      mockGetItemAsync.mockResolvedValue(lockoutTime.toString());

      const result = await authenticateWithBiometrics();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many failed');
    });

    it('should handle lockout error from recordBiometricAttempt', async () => {
      // First call (checkBiometricLockout) - no lockout
      // Second call (recordBiometricAttempt) - get failed attempts
      mockGetItemAsync
        .mockResolvedValueOnce(null) // checkBiometricLockout
        .mockResolvedValueOnce('4'); // recordBiometricAttempt
      mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'failed' });
      mockSetItemAsync.mockResolvedValue();

      const result = await authenticateWithBiometrics();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many failed');
    });

    it('should handle other errors gracefully', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      mockAuthenticateAsync.mockRejectedValue(new Error('Unknown error'));

      const result = await authenticateWithBiometrics();

      expect(result).toEqual({
        success: false,
        error: 'Unknown error',
      });
    });

    it('should propagate locked out errors', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      mockAuthenticateAsync.mockRejectedValue(new Error('locked out'));

      const result = await authenticateWithBiometrics();

      expect(result.success).toBe(false);
      expect(result.error).toBe('locked out');
    });
  });

  describe('isBiometricEnabled', () => {
    it('should return true when biometrics enabled', async () => {
      mockGetItemAsync.mockResolvedValue('true');

      const result = await isBiometricEnabled();

      expect(result).toBe(true);
    });

    it('should return false when biometrics not enabled', async () => {
      mockGetItemAsync.mockResolvedValue('false');

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });

    it('should return false when no value stored', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockGetItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });

    it('should check correct storage key', async () => {
      mockGetItemAsync.mockResolvedValue('true');

      await isBiometricEnabled();

      expect(mockGetItemAsync).toHaveBeenCalledWith('wallet_biometric_enabled_v1');
    });
  });

  describe('setBiometricEnabled', () => {
    it('should save true when enabling', async () => {
      mockSetItemAsync.mockResolvedValue();

      const result = await setBiometricEnabled(true);

      expect(result).toBe(true);
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_biometric_enabled_v1', 'true');
    });

    it('should save false when disabling', async () => {
      mockSetItemAsync.mockResolvedValue();

      const result = await setBiometricEnabled(false);

      expect(result).toBe(true);
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_biometric_enabled_v1', 'false');
    });

    it('should return false on error', async () => {
      mockSetItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await setBiometricEnabled(true);

      expect(result).toBe(false);
    });
  });
});
