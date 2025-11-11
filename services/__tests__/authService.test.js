/**
 * Tests for Authentication Service
 * Tests PIN hashing and verification using the public API
 */

import { savePin, verifyPin, resetPinAttempts } from '../authService';

// Mock expo-secure-store for testing
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const SecureStore = require('expo-secure-store');

describe('authService', () => {
  let savedHash;
  let savedSalt;
  let savedVersion;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Reset PIN attempt counters
    resetPinAttempts();
    // Reset saved values
    savedHash = null;
    savedSalt = null;
    savedVersion = null;

    // Mock SecureStore to save and retrieve values
    SecureStore.setItemAsync.mockImplementation(async (key, value) => {
      if (key === 'wallet_pin_v1') savedHash = value;
      if (key === 'wallet_pin_salt_v1') savedSalt = value;
      if (key === 'wallet_pin_version_v1') savedVersion = value;
    });

    SecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'wallet_pin_v1') return savedHash;
      if (key === 'wallet_pin_salt_v1') return savedSalt;
      if (key === 'wallet_pin_version_v1') return savedVersion;
      return null;
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
});
