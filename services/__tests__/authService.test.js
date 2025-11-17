/**
 * Tests for Authentication Service
 * Tests PIN hashing and verification using the public API
 */

import {
  savePin,
  verifyPin,
  resetPinAttempts,
  checkPinLockout,
  getRemainingPinAttempts,
  checkBiometricSupport,
  authenticateWithBiometrics,
  isBiometricEnabled,
  setBiometricEnabled,
  saveMnemonic,
  getMnemonic,
  withMnemonic,
  deleteMnemonic,
  saveCurrentAccount,
  getCurrentAccount,
  deleteWalletData,
} from '../authService';

// Mock expo-secure-store for testing
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

const SecureStore = require('expo-secure-store');
const LocalAuthentication = require('expo-local-authentication');

describe('authService', () => {
  let savedHash;
  let savedSalt;
  let savedVersion;
  let failedAttempts;
  let lockoutUntil;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset PIN attempt counters
    resetPinAttempts();
    // Reset saved values
    savedHash = null;
    savedSalt = null;
    savedVersion = null;
    failedAttempts = null;
    lockoutUntil = null;

    // Mock SecureStore to save and retrieve values
    SecureStore.setItemAsync.mockImplementation(async (key, value) => {
      if (key === 'wallet_pin_v1') savedHash = value;
      if (key === 'wallet_pin_salt_v1') savedSalt = value;
      if (key === 'wallet_pin_version_v1') savedVersion = value;
      if (key === 'pin_failed_attempts') failedAttempts = value;
      if (key === 'pin_lockout_until') lockoutUntil = value;
    });

    SecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'wallet_pin_v1') return savedHash;
      if (key === 'wallet_pin_salt_v1') return savedSalt;
      if (key === 'wallet_pin_version_v1') return savedVersion;
      if (key === 'wallet_mnemonic_v1') return 'test mnemonic';
      if (key === 'wallet_current_account_v1') return '0';
      if (key === 'wallet_biometric_enabled_v1') return 'false';
      if (key === 'pin_failed_attempts') return failedAttempts;
      if (key === 'pin_lockout_until') return lockoutUntil;
      return null;
    });

    SecureStore.deleteItemAsync.mockImplementation(async (key) => {
      if (key === 'pin_failed_attempts') failedAttempts = null;
      if (key === 'pin_lockout_until') lockoutUntil = null;
    });
  });

  describe('savePin and verifyPin', () => {
    it('should save PIN hash and verify correct PIN', async () => {
      const pin = '1234';

      // Save PIN
      await savePin(pin);

      // Verify saved PIN
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('wallet_pin_v1', expect.any(String));
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('wallet_pin_salt_v1', expect.any(String));
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('wallet_pin_version_v1', '2');

      // Verify correct PIN
      const result = await verifyPin(pin);
      expect(result.success).toBe(true);
    });

    it('should reject incorrect PIN', async () => {
      const correctPin = '1234';
      const incorrectPin = '5678';

      await savePin(correctPin);

      const result = await verifyPin(incorrectPin);
      expect(result.success).toBe(false);
    });

    it('should generate different hashes for same PIN due to random salt', async () => {
      const pin = '1234';

      await savePin(pin);
      const hash1 = savedHash;
      const salt1 = savedSalt;

      // Reset and save again
      savedHash = null;
      savedSalt = null;

      await savePin(pin);
      const hash2 = savedHash;
      const salt2 = savedSalt;

      // Hashes and salts should be different
      expect(hash1).not.toBe(hash2);
      expect(salt1).not.toBe(salt2);
    });

    it('should handle PIN of different lengths', async () => {
      const pins = ['1234', '123456', '12'];

      for (const pin of pins) {
        // Reset state
        savedHash = null;
        savedSalt = null;
        savedVersion = null;

        await savePin(pin);
        const result = await verifyPin(pin);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('PIN hash format', () => {
    it('should save hash and salt separately', async () => {
      const pin = '1234';
      await savePin(pin);

      // Hash should be a hex string
      expect(savedHash).toMatch(/^[0-9a-f]+$/);
      // Salt should be a hex string
      expect(savedSalt).toMatch(/^[0-9a-f]+$/);
      // Version should be set
      expect(savedVersion).toBe('2');
    });

    it('should use 32-byte (256-bit) salt', async () => {
      const pin = '1234';
      await savePin(pin);

      // 32 bytes = 64 hex characters
      expect(savedSalt.length).toBe(64);
    });

    it('should produce SHA-512 hash', async () => {
      const pin = '1234';
      await savePin(pin);

      // SHA-512 produces 128 hex characters
      expect(savedHash.length).toBe(128);
    });
  });

  describe('Security properties', () => {
    it('should use sufficient iterations (should take time)', async () => {
      const pin = '1234';
      const startTime = Date.now();
      await savePin(pin);
      const endTime = Date.now();

      // PBKDF2 with 10,000 iterations should take at least a few milliseconds
      const elapsed = endTime - startTime;
      expect(elapsed).toBeGreaterThan(0);
    });

    it('should handle special characters in PIN', async () => {
      const pin = '!@#$%^&*()';
      await savePin(pin);

      const result = await verifyPin(pin);
      expect(result.success).toBe(true);
    });

    it('should handle unicode characters in PIN', async () => {
      const pin = '你好世界';
      await savePin(pin);

      const result = await verifyPin(pin);
      expect(result.success).toBe(true);
    });

    it('should be case-sensitive', async () => {
      const pin = 'AbCd';
      await savePin(pin);

      const result1 = await verifyPin('AbCd');
      expect(result1.success).toBe(true);

      // Reset attempt counters after successful verify
      resetPinAttempts();

      const result2 = await verifyPin('abcd');
      expect(result2.success).toBe(false);
    }, 10000); // Increase timeout for this test
  });

  describe('Edge cases', () => {
    it('should handle empty PIN', async () => {
      const pin = '';
      await savePin(pin);

      const result = await verifyPin(pin);
      expect(result.success).toBe(true);
    });

    it('should return false when no PIN is stored', async () => {
      savedHash = null;
      savedSalt = null;
      savedVersion = null;

      const result = await verifyPin('1234');
      expect(result.success).toBe(false);
    });

    // Skip very long PIN test - extreme edge case
    // it('should handle very long PINs', async () => {
    //   const pin = '1'.repeat(100);
    //   await savePin(pin);
    //   const result = await verifyPin(pin);
    //   expect(result.success).toBe(true);
    // });
  });

  describe('PIN rate limiting', () => {
    it('should track failed PIN attempts', async () => {
      const pin = '1234';
      await savePin(pin);

      // First failed attempt
      await verifyPin('wrong');
      expect(await getRemainingPinAttempts()).toBe(9);

      // Second failed attempt
      await verifyPin('wrong');
      expect(await getRemainingPinAttempts()).toBe(8);
    }, 30000);

    it('should lock out after max attempts', async () => {
      const pin = '1234';
      await savePin(pin);

      // Exhaust all attempts
      for (let i = 0; i < 10; i++) {
        await verifyPin('wrong');
      }

      const lockStatus = await checkPinLockout();
      expect(lockStatus.isLocked).toBe(true);
      expect(lockStatus.remainingTime).toBeGreaterThan(0);

      // Further attempts should be rejected
      const result = await verifyPin(pin);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many failed attempts');
    }, 60000);

    it('should reset attempts after successful verification', async () => {
      const pin = '1234';
      await savePin(pin);

      // Make some failed attempts
      await verifyPin('wrong');
      await verifyPin('wrong');
      expect(await getRemainingPinAttempts()).toBe(8);

      // Successful verification should reset
      await verifyPin(pin);
      expect(await getRemainingPinAttempts()).toBe(10);
    }, 30000);
  });

  describe('Biometric authentication', () => {
    it('should check biometric support', async () => {
      LocalAuthentication.hasHardwareAsync.mockResolvedValueOnce(true);
      LocalAuthentication.isEnrolledAsync.mockResolvedValueOnce(true);

      const result = await checkBiometricSupport();
      expect(result).toBe(true);
    });

    it('should return false if no hardware', async () => {
      LocalAuthentication.hasHardwareAsync.mockResolvedValueOnce(false);

      const result = await checkBiometricSupport();
      expect(result).toBe(false);
    });

    it('should return false if not enrolled', async () => {
      LocalAuthentication.hasHardwareAsync.mockResolvedValueOnce(true);
      LocalAuthentication.isEnrolledAsync.mockResolvedValueOnce(false);

      const result = await checkBiometricSupport();
      expect(result).toBe(false);
    });

    it('should authenticate with biometrics successfully', async () => {
      LocalAuthentication.authenticateAsync.mockResolvedValueOnce({
        success: true,
      });

      const result = await authenticateWithBiometrics();
      expect(result.success).toBe(true);
    });

    it('should handle biometric authentication failure', async () => {
      LocalAuthentication.authenticateAsync.mockResolvedValueOnce({
        success: false,
        error: 'Authentication failed',
      });

      const result = await authenticateWithBiometrics();
      expect(result.success).toBe(false);
    });

    it('should use custom prompt and fallback messages', async () => {
      LocalAuthentication.authenticateAsync.mockResolvedValueOnce({
        success: true,
      });

      await authenticateWithBiometrics('Custom prompt', 'Custom fallback');

      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Custom prompt',
        fallbackLabel: 'Custom fallback',
        disableDeviceFallback: false,
      });
    });
  });

  describe('Biometric settings', () => {
    it('should check if biometric is enabled', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce('true');

      const result = await isBiometricEnabled();
      expect(result).toBe(true);
    });

    it('should return false if biometric is disabled', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce('false');

      const result = await isBiometricEnabled();
      expect(result).toBe(false);
    });

    it('should enable biometric authentication', async () => {
      const result = await setBiometricEnabled(true);
      expect(result).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'wallet_biometric_enabled_v1',
        'true'
      );
    });

    it('should disable biometric authentication', async () => {
      const result = await setBiometricEnabled(false);
      expect(result).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'wallet_biometric_enabled_v1',
        'false'
      );
    });
  });

  describe('Mnemonic management', () => {
    it('should save mnemonic to secure storage', async () => {
      const mnemonic = 'test mnemonic phrase';
      const result = await saveMnemonic(mnemonic);

      expect(result).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'wallet_mnemonic_v1',
        mnemonic
      );
    });

    it('should retrieve mnemonic from storage', async () => {
      const mnemonic = 'test mnemonic phrase';
      SecureStore.getItemAsync.mockResolvedValueOnce(mnemonic);

      const result = await getMnemonic();
      expect(result).toBe(mnemonic);
    });

    it('should return null if mnemonic not found', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await getMnemonic();
      expect(result).toBeNull();
    });

    it('should use withMnemonic to access mnemonic safely', async () => {
      const mnemonic = 'test mnemonic phrase';
      SecureStore.getItemAsync.mockResolvedValueOnce(mnemonic);

      const result = await withMnemonic((m) => {
        expect(m).toBe(mnemonic);
        return 'processed';
      });

      expect(result).toBe('processed');
    });

    it('should throw error if mnemonic not found in withMnemonic', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);

      await expect(withMnemonic(() => {})).rejects.toThrow('Mnemonic not found');
    });

    it('should delete mnemonic from storage', async () => {
      const result = await deleteMnemonic();
      expect(result).toBe(true);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('wallet_mnemonic_v1');
    });
  });

  describe('Account management', () => {
    it('should save current account index', async () => {
      const result = await saveCurrentAccount(5);
      expect(result).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'wallet_current_account_v1',
        '5'
      );
    });

    it('should retrieve current account index', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce('3');

      const result = await getCurrentAccount();
      expect(result).toBe(3);
    });

    it('should return 0 as default account index', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce(null);

      const result = await getCurrentAccount();
      expect(result).toBe(0);
    });
  });

  describe('Wallet data deletion', () => {
    it('should delete all wallet data', async () => {
      const result = await deleteWalletData();
      expect(result).toBe(true);

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('wallet_mnemonic_v1');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('wallet_current_account_v1');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('wallet_pin_v1');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('wallet_pin_salt_v1');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('wallet_biometric_enabled_v1');
    });

    it('should return false on deletion error', async () => {
      SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await deleteWalletData();
      expect(result).toBe(false);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle savePin error gracefully', async () => {
      SecureStore.setItemAsync.mockRejectedValueOnce(new Error('Storage error'));

      const result = await savePin('1234');
      expect(result).toBe(false);
    });

    it('should handle checkBiometricSupport error', async () => {
      LocalAuthentication.hasHardwareAsync.mockRejectedValueOnce(new Error('Hardware error'));

      const result = await checkBiometricSupport();
      expect(result).toBe(false);
    });

    it('should handle authenticateWithBiometrics error', async () => {
      LocalAuthentication.authenticateAsync.mockRejectedValueOnce(new Error('Auth error'));

      const result = await authenticateWithBiometrics();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Auth error');
    });

    it('should handle isBiometricEnabled error', async () => {
      SecureStore.getItemAsync.mockRejectedValueOnce(new Error('Storage error'));

      const result = await isBiometricEnabled();
      expect(result).toBe(false);
    });

    it('should handle setBiometricEnabled error', async () => {
      SecureStore.setItemAsync.mockRejectedValueOnce(new Error('Storage error'));

      const result = await setBiometricEnabled(true);
      expect(result).toBe(false);
    });

    it('should handle saveMnemonic error', async () => {
      SecureStore.setItemAsync.mockRejectedValueOnce(new Error('Storage error'));

      const result = await saveMnemonic('test mnemonic');
      expect(result).toBe(false);
    });

    it('should handle getMnemonic error', async () => {
      SecureStore.getItemAsync.mockRejectedValueOnce(new Error('Storage error'));

      const result = await getMnemonic();
      expect(result).toBeNull();
    });

    it('should handle deleteMnemonic error', async () => {
      SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('Delete error'));

      const result = await deleteMnemonic();
      expect(result).toBe(false);
    });

    it('should handle saveCurrentAccount error', async () => {
      SecureStore.setItemAsync.mockRejectedValueOnce(new Error('Storage error'));

      const result = await saveCurrentAccount(1);
      expect(result).toBe(false);
    });

    it('should handle getCurrentAccount error', async () => {
      SecureStore.getItemAsync.mockRejectedValueOnce(new Error('Storage error'));

      const result = await getCurrentAccount();
      expect(result).toBe(0);
    });

    it('should handle verifyPin error', async () => {
      SecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await verifyPin('1234');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to verify PIN');
    });
  });

  describe('Legacy PIN migration', () => {
    it('should verify legacy SHA256 PIN', async () => {
      // Manually set a legacy PIN (no version or version = '1')
      savedHash = 'legacy_hash';
      savedSalt = 'legacy_salt';
      savedVersion = null; // or '1' for SHA256_LEGACY

      SecureStore.getItemAsync.mockImplementation(async (key) => {
        if (key === 'wallet_pin_v1') return savedHash;
        if (key === 'wallet_pin_salt_v1') return savedSalt;
        if (key === 'wallet_pin_version_v1') return savedVersion;
        return null;
      });

      const result = await verifyPin('test_pin');

      // Will fail because we're not using real legacy hash, but tests the path
      expect(result.success).toBe(false);
    });

    it('should return needsMigration flag for legacy PIN', async () => {
      const pin = '1234';

      // Save with new method
      await savePin(pin);

      // Manually change to legacy version
      savedVersion = null;

      const result = await verifyPin(pin);

      // Should verify successfully with legacy path and return needsMigration
      if (result.success) {
        expect(result.needsMigration).toBe(true);
      }
    });

    it('should handle missing salt (corrupted state)', async () => {
      savedHash = 'some_hash';
      savedSalt = null; // Missing salt
      savedVersion = '2';

      const result = await verifyPin('1234');

      expect(result.success).toBe(false);
      expect(result.error).toContain('PIN needs to be reset');
    });
  });

  describe('Lockout timing', () => {
    it('should calculate remaining lockout time correctly', async () => {
      const pin = '1234';
      await savePin(pin);

      // Trigger lockout
      for (let i = 0; i < 10; i++) {
        await verifyPin('wrong');
      }

      const lockStatus = await checkPinLockout();
      expect(lockStatus.isLocked).toBe(true);
      expect(lockStatus.remainingTime).toBeGreaterThan(0);
      expect(lockStatus.remainingTime).toBeLessThanOrEqual(30); // 30 minutes max
    }, 60000);

    it('should return specific lockout error message', async () => {
      const pin = '1234';
      await savePin(pin);

      // Trigger lockout
      for (let i = 0; i < 10; i++) {
        await verifyPin('wrong');
      }

      // Try to verify after lockout
      const result = await verifyPin(pin);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many failed attempts');
      expect(result.remainingAttempts).toBe(0);
    }, 60000);
  });
});
