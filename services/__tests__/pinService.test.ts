// @ts-nocheck
/**
 * Tests for PIN Authentication Service
 */

import {
  savePinWithHash,
  savePin,
  savePinWithExistingSalt,
  verifyPin,
  hashPinForEncryption,
  checkPinLockout,
  resetPinAttempts,
  getRemainingPinAttempts,
} from '../pinService';
import * as SecureStore from 'expo-secure-store';

// Mock expo-secure-store
jest.mock('expo-secure-store');

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    security: jest.fn(),
  },
}));

// Mock pinLockout
const mockCheckPinLockout = jest.fn();
const mockResetPinAttempts = jest.fn();
const mockGetRemainingPinAttempts = jest.fn();
const mockRecordFailedAttempt = jest.fn();
const mockLoadLockoutState = jest.fn();
const mockGetMaxPinAttempts = jest.fn();

jest.mock('../pinLockout', () => ({
  checkPinLockout: (...args) => mockCheckPinLockout(...args),
  resetPinAttempts: (...args) => mockResetPinAttempts(...args),
  getRemainingPinAttempts: (...args) => mockGetRemainingPinAttempts(...args),
  recordFailedAttempt: (...args) => mockRecordFailedAttempt(...args),
  loadLockoutState: (...args) => mockLoadLockoutState(...args),
  getMaxPinAttempts: (...args) => mockGetMaxPinAttempts(...args),
}));

// Mock pinHashing
const mockGenerateSalt = jest.fn();
const mockHashPin = jest.fn();
const mockVerifyPinHash = jest.fn();
const mockGenerateSaltHmac = jest.fn();
const mockVerifySaltHmac = jest.fn();

jest.mock('../pinHashing', () => ({
  generateSalt: (...args) => mockGenerateSalt(...args),
  hashPin: (...args) => mockHashPin(...args),
  verifyPinHash: (...args) => mockVerifyPinHash(...args),
  generateSaltHmac: (...args) => mockGenerateSaltHmac(...args),
  verifySaltHmac: (...args) => mockVerifySaltHmac(...args),
}));

// Typed mock references
const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;

describe('PinService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMaxPinAttempts.mockReturnValue(10);
  });

  describe('hashPinForEncryption', () => {
    it('should be the hashPin function', async () => {
      // hashPinForEncryption is a direct export of hashPin
      mockHashPin.mockResolvedValue('test-hash');
      const result = await hashPinForEncryption('123456', 'salt');
      expect(mockHashPin).toHaveBeenCalledWith('123456', 'salt');
      expect(result).toBe('test-hash');
    });
  });

  describe('savePinWithHash', () => {
    it('should save PIN and return hash with salt', async () => {
      mockGenerateSalt.mockResolvedValue('test-salt-hex');
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockGenerateSaltHmac.mockReturnValue('test-hmac');
      mockSetItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('test-salt-hex');
        if (key === 'wallet_pin_v1') return Promise.resolve('hashed-pin-hex');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2');
        return Promise.resolve(null);
      });

      const result = await savePinWithHash('123456');

      expect(result).toEqual({
        hashedPin: 'hashed-pin-hex',
        salt: 'test-salt-hex',
      });
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_pin_v1', 'hashed-pin-hex');
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_pin_salt_v1', 'test-salt-hex');
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_pin_version_v1', '2');
    });

    it('should throw CRITICAL error when salt verification fails', async () => {
      mockGenerateSalt.mockResolvedValue('test-salt-hex');
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockGenerateSaltHmac.mockReturnValue('test-hmac');
      mockSetItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('different-salt');
        if (key === 'wallet_pin_v1') return Promise.resolve('hashed-pin-hex');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2');
        return Promise.resolve(null);
      });

      await expect(savePinWithHash('123456')).rejects.toThrow('CRITICAL: PIN salt verification failed');
    });

    it('should throw CRITICAL error when hash verification fails', async () => {
      mockGenerateSalt.mockResolvedValue('test-salt-hex');
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockGenerateSaltHmac.mockReturnValue('test-hmac');
      mockSetItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('test-salt-hex');
        if (key === 'wallet_pin_v1') return Promise.resolve('different-hash');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2');
        return Promise.resolve(null);
      });

      await expect(savePinWithHash('123456')).rejects.toThrow('CRITICAL: PIN hash verification failed');
    });

    it('should throw CRITICAL error when version verification fails', async () => {
      mockGenerateSalt.mockResolvedValue('test-salt-hex');
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockGenerateSaltHmac.mockReturnValue('test-hmac');
      mockSetItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('test-salt-hex');
        if (key === 'wallet_pin_v1') return Promise.resolve('hashed-pin-hex');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('wrong-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('1');
        return Promise.resolve(null);
      });

      await expect(savePinWithHash('123456')).rejects.toThrow('CRITICAL: PIN version verification failed');
    });

    it('should throw generic error on storage failure', async () => {
      mockGenerateSalt.mockResolvedValue('test-salt-hex');
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockSetItemAsync.mockRejectedValue(new Error('Storage full'));

      await expect(savePinWithHash('123456')).rejects.toThrow('Failed to save PIN');
    });

    it('should re-throw CRITICAL errors without wrapping', async () => {
      mockGenerateSalt.mockRejectedValue(new Error('CRITICAL: Some critical error'));

      await expect(savePinWithHash('123456')).rejects.toThrow('CRITICAL: Some critical error');
    });
  });

  describe('savePin', () => {
    it('should save PIN and return true on success', async () => {
      mockGenerateSalt.mockResolvedValue('test-salt-hex');
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockGenerateSaltHmac.mockReturnValue('test-hmac');
      mockSetItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('test-salt-hex');
        if (key === 'wallet_pin_v1') return Promise.resolve('hashed-pin-hex');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2');
        return Promise.resolve(null);
      });

      const result = await savePin('123456');

      expect(result).toBe(true);
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_pin_v1', 'hashed-pin-hex');
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_pin_salt_v1', 'test-salt-hex');
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_pin_version_v1', '2');
    });

    it('should throw CRITICAL error when salt verification fails', async () => {
      mockGenerateSalt.mockResolvedValue('test-salt-hex');
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockGenerateSaltHmac.mockReturnValue('test-hmac');
      mockSetItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('different-salt');
        if (key === 'wallet_pin_v1') return Promise.resolve('hashed-pin-hex');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2');
        return Promise.resolve(null);
      });

      await expect(savePin('123456')).rejects.toThrow('CRITICAL: PIN salt verification failed');
    });

    it('should throw CRITICAL error when hash verification fails', async () => {
      mockGenerateSalt.mockResolvedValue('test-salt-hex');
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockGenerateSaltHmac.mockReturnValue('test-hmac');
      mockSetItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('test-salt-hex');
        if (key === 'wallet_pin_v1') return Promise.resolve('different-hash');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2');
        return Promise.resolve(null);
      });

      await expect(savePin('123456')).rejects.toThrow('CRITICAL: PIN hash verification failed');
    });

    it('should throw CRITICAL error when version verification fails', async () => {
      mockGenerateSalt.mockResolvedValue('test-salt-hex');
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockGenerateSaltHmac.mockReturnValue('test-hmac');
      mockSetItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('test-salt-hex');
        if (key === 'wallet_pin_v1') return Promise.resolve('hashed-pin-hex');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('wrong-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('wrong-version');
        return Promise.resolve(null);
      });

      await expect(savePin('123456')).rejects.toThrow('CRITICAL: PIN version verification failed');
    });

    it('should return false on storage failure (non-critical)', async () => {
      mockGenerateSalt.mockResolvedValue('test-salt-hex');
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockSetItemAsync.mockRejectedValue(new Error('Storage full'));

      const result = await savePin('123456');

      expect(result).toBe(false);
    });

    it('should re-throw CRITICAL errors', async () => {
      mockGenerateSalt.mockRejectedValue(new Error('CRITICAL: Critical failure'));

      await expect(savePin('123456')).rejects.toThrow('CRITICAL: Critical failure');
    });
  });

  describe('savePinWithExistingSalt', () => {
    it('should save PIN using existing salt', async () => {
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockGenerateSaltHmac.mockReturnValue('test-hmac');
      mockSetItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_v1') return Promise.resolve('hashed-pin-hex');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2');
        return Promise.resolve(null);
      });

      const result = await savePinWithExistingSalt('123456', 'existing-salt');

      expect(result).toBe(true);
      expect(mockHashPin).toHaveBeenCalledWith('123456', 'existing-salt');
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_pin_v1', 'hashed-pin-hex');
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_pin_version_v1', '2');
    });

    it('should throw CRITICAL error when hash verification fails', async () => {
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockGenerateSaltHmac.mockReturnValue('test-hmac');
      mockSetItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_v1') return Promise.resolve('different-hash');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2');
        return Promise.resolve(null);
      });

      await expect(savePinWithExistingSalt('123456', 'existing-salt')).rejects.toThrow(
        'CRITICAL: PIN hash verification failed'
      );
    });

    it('should throw CRITICAL error when version verification fails', async () => {
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockGenerateSaltHmac.mockReturnValue('test-hmac');
      mockSetItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_v1') return Promise.resolve('hashed-pin-hex');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('wrong-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('wrong');
        return Promise.resolve(null);
      });

      await expect(savePinWithExistingSalt('123456', 'existing-salt')).rejects.toThrow(
        'CRITICAL: PIN version verification failed'
      );
    });

    it('should return false on storage failure (non-critical)', async () => {
      mockHashPin.mockResolvedValue('hashed-pin-hex');
      mockSetItemAsync.mockRejectedValue(new Error('Storage full'));

      const result = await savePinWithExistingSalt('123456', 'existing-salt');

      expect(result).toBe(false);
    });

    it('should re-throw CRITICAL errors', async () => {
      mockHashPin.mockRejectedValue(new Error('CRITICAL: Hashing critical error'));

      await expect(savePinWithExistingSalt('123456', 'salt')).rejects.toThrow(
        'CRITICAL: Hashing critical error'
      );
    });
  });

  describe('verifyPin', () => {
    it('should return success when PIN is correct', async () => {
      mockCheckPinLockout.mockResolvedValue({ isLocked: false });
      mockLoadLockoutState.mockResolvedValue({ failedAttempts: 0 });
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_v1') return Promise.resolve('stored-hash');
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('stored-salt');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2'); // Current version
        return Promise.resolve(null);
      });
      mockHashPin.mockResolvedValue('stored-hash');
      mockVerifyPinHash.mockReturnValue(true);
      mockVerifySaltHmac.mockReturnValue(true);
      mockResetPinAttempts.mockResolvedValue();
      mockSetItemAsync.mockResolvedValue(); // For migration

      const result = await verifyPin('123456');

      expect(result).toEqual({ success: true });
      expect(mockResetPinAttempts).toHaveBeenCalled();
    });

    it('should return failure when locked out', async () => {
      mockCheckPinLockout.mockResolvedValue({ isLocked: true, remainingTime: 15 });

      const result = await verifyPin('123456');

      expect(result).toEqual({
        success: false,
        error: 'Too many failed attempts. Try again in 15 minutes.',
        remainingAttempts: 0,
      });
    });

    it('should return failure when salt is missing', async () => {
      mockCheckPinLockout.mockResolvedValue({ isLocked: false });
      mockLoadLockoutState.mockResolvedValue({ failedAttempts: 0 });
      mockGetItemAsync.mockResolvedValue(null);

      const result = await verifyPin('123456');

      expect(result).toEqual({
        success: false,
        error: 'PIN authentication unavailable. Please restore wallet from seed phrase.',
        remainingAttempts: 0,
      });
    });

    it('should return failure with incorrect PIN', async () => {
      mockCheckPinLockout.mockResolvedValue({ isLocked: false });
      mockLoadLockoutState.mockResolvedValue({ failedAttempts: 2 });
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_v1') return Promise.resolve('stored-hash');
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('stored-salt');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2'); // Current version
        return Promise.resolve(null);
      });
      mockHashPin.mockResolvedValue('different-hash');
      mockVerifyPinHash.mockReturnValue(false);
      mockVerifySaltHmac.mockReturnValue(true);
      mockRecordFailedAttempt.mockResolvedValue({
        shouldLockout: false,
        newFailedAttempts: 3,
      });

      const result = await verifyPin('wrong-pin');

      expect(result).toEqual({
        success: false,
        error: 'Incorrect PIN. 7 attempts remaining.',
        remainingAttempts: 7, // 10 - 3
      });
    });

    it('should return lockout error when max attempts reached', async () => {
      mockCheckPinLockout.mockResolvedValue({ isLocked: false });
      mockLoadLockoutState.mockResolvedValue({ failedAttempts: 9 });
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_v1') return Promise.resolve('stored-hash');
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('stored-salt');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2'); // Current version
        return Promise.resolve(null);
      });
      mockHashPin.mockResolvedValue('different-hash');
      mockVerifyPinHash.mockReturnValue(false);
      mockVerifySaltHmac.mockReturnValue(true);
      mockRecordFailedAttempt.mockResolvedValue({
        shouldLockout: true,
        newFailedAttempts: 10,
        lockoutUntil: Date.now() + 1800000,
      });

      const result = await verifyPin('wrong-pin');

      expect(result).toEqual({
        success: false,
        error: 'Too many failed attempts. Account locked for 30 minutes.',
        remainingAttempts: 0,
      });
    });

    it('should handle rate limiting error gracefully', async () => {
      mockCheckPinLockout.mockResolvedValue({ isLocked: false });
      mockLoadLockoutState.mockResolvedValue({ failedAttempts: 2 });
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_v1') return Promise.resolve('stored-hash');
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('stored-salt');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2'); // Current version
        return Promise.resolve(null);
      });
      mockHashPin.mockResolvedValue('different-hash');
      mockVerifyPinHash.mockReturnValue(false);
      mockVerifySaltHmac.mockReturnValue(true);
      mockRecordFailedAttempt.mockRejectedValue(
        new Error('Unable to enforce rate limiting. Access denied for security.')
      );

      const result = await verifyPin('wrong-pin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unable to enforce rate limiting. Access denied for security.');
    });

    it('should handle generic verification errors', async () => {
      mockCheckPinLockout.mockRejectedValue(new Error('Unknown error'));

      const result = await verifyPin('123456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to verify PIN');
    });

    it('should use constant-time comparison', async () => {
      mockCheckPinLockout.mockResolvedValue({ isLocked: false });
      mockLoadLockoutState.mockResolvedValue({ failedAttempts: 0 });
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_v1') return Promise.resolve('stored-hash');
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('stored-salt');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2'); // Current version
        return Promise.resolve(null);
      });
      mockHashPin.mockResolvedValue('entered-hash');
      mockVerifyPinHash.mockReturnValue(true);
      mockVerifySaltHmac.mockReturnValue(true);
      mockResetPinAttempts.mockResolvedValue();
      mockSetItemAsync.mockResolvedValue(); // For migration

      await verifyPin('123456');

      expect(mockVerifyPinHash).toHaveBeenCalledWith('stored-hash', 'entered-hash');
    });

    it('should ensure remaining attempts never goes negative', async () => {
      mockCheckPinLockout.mockResolvedValue({ isLocked: false });
      mockLoadLockoutState.mockResolvedValue({ failedAttempts: 9 });
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_v1') return Promise.resolve('stored-hash');
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('stored-salt');
        if (key === 'wallet_pin_salt_hmac_v1') return Promise.resolve('test-hmac');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2'); // Current version
        return Promise.resolve(null);
      });
      mockHashPin.mockResolvedValue('different-hash');
      mockVerifyPinHash.mockReturnValue(false);
      mockVerifySaltHmac.mockReturnValue(true);
      mockRecordFailedAttempt.mockResolvedValue({
        shouldLockout: false,
        newFailedAttempts: 15, // More than max
      });

      const result = await verifyPin('wrong-pin');

      expect(result.remainingAttempts).toBe(0); // Math.max(0, 10-15) = 0
    });

    it('should handle empty stored hash', async () => {
      mockCheckPinLockout.mockResolvedValue({ isLocked: false });
      mockLoadLockoutState.mockResolvedValue({ failedAttempts: 0 });
      mockGetItemAsync.mockImplementation((key) => {
        if (key === 'wallet_pin_v1') return Promise.resolve(null);
        if (key === 'wallet_pin_salt_v1') return Promise.resolve('stored-salt');
        if (key === 'wallet_pin_version_v1') return Promise.resolve('2'); // Current version
        return Promise.resolve(null);
      });
      mockHashPin.mockResolvedValue('entered-hash');

      const result = await verifyPin('123456');

      // Should return error when PIN hash is not configured
      expect(result.success).toBe(false);
      expect(result.error).toBe('PIN not configured. Please set up authentication.');
      expect(result.remainingAttempts).toBe(0);
      // verifyPinHash should not be called when there's no stored hash
      expect(mockVerifyPinHash).not.toHaveBeenCalled();
    });
  });

  describe('Re-exported functions', () => {
    it('should re-export checkPinLockout', async () => {
      mockCheckPinLockout.mockResolvedValue({ isLocked: false });

      const result = await checkPinLockout();

      expect(result).toEqual({ isLocked: false });
      expect(mockCheckPinLockout).toHaveBeenCalled();
    });

    it('should re-export resetPinAttempts', async () => {
      mockResetPinAttempts.mockResolvedValue();

      await resetPinAttempts();

      expect(mockResetPinAttempts).toHaveBeenCalled();
    });

    it('should re-export getRemainingPinAttempts', async () => {
      mockGetRemainingPinAttempts.mockResolvedValue(7);

      const result = await getRemainingPinAttempts();

      expect(result).toBe(7);
      expect(mockGetRemainingPinAttempts).toHaveBeenCalled();
    });
  });
});
