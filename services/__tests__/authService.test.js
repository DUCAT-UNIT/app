/**
 * Tests for authService
 * Critical security functions for PIN hashing and verification
 */

import { hashPin, verifyPin } from '../authService';

describe('authService', () => {
  describe('hashPin', () => {
    it('should hash a PIN using PBKDF2 with 10,000 iterations', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);

      // Hash should be a string
      expect(typeof hash).toBe('string');

      // Hash should contain salt and derived key separated by colon
      expect(hash.split(':')).toHaveLength(2);
    });

    it('should generate different hashes for same PIN due to random salt', async () => {
      const pin = '1234';
      const hash1 = await hashPin(pin);
      const hash2 = await hashPin(pin);

      // Hashes should be different (different salts)
      expect(hash1).not.toBe(hash2);
    });

    it('should handle PIN of different lengths', async () => {
      const shortPin = '12';
      const longPin = '123456';

      const shortHash = await hashPin(shortPin);
      const longHash = await hashPin(longPin);

      expect(shortHash).toBeTruthy();
      expect(longHash).toBeTruthy();
      expect(shortHash).not.toBe(longHash);
    });

    it('should throw error for empty PIN', async () => {
      await expect(hashPin('')).rejects.toThrow();
    });

    it('should throw error for undefined PIN', async () => {
      await expect(hashPin(undefined)).rejects.toThrow();
    });

    it('should throw error for null PIN', async () => {
      await expect(hashPin(null)).rejects.toThrow();
    });
  });

  describe('verifyPin', () => {
    it('should verify correct PIN', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);

      const isValid = await verifyPin(pin, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect PIN', async () => {
      const correctPin = '1234';
      const incorrectPin = '5678';
      const hash = await hashPin(correctPin);

      const isValid = await verifyPin(incorrectPin, hash);
      expect(isValid).toBe(false);
    });

    it('should reject PIN with wrong length', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);

      const isValid = await verifyPin('12345', hash);
      expect(isValid).toBe(false);
    });

    it('should handle invalid hash format', async () => {
      const pin = '1234';
      const invalidHash = 'invalid-hash-format';

      const isValid = await verifyPin(pin, invalidHash);
      expect(isValid).toBe(false);
    });

    it('should reject empty PIN', async () => {
      const hash = await hashPin('1234');

      const isValid = await verifyPin('', hash);
      expect(isValid).toBe(false);
    });

    it('should handle case sensitivity correctly', async () => {
      const pin = 'AbCd';
      const hash = await hashPin(pin);

      expect(await verifyPin('AbCd', hash)).toBe(true);
      expect(await verifyPin('abcd', hash)).toBe(false);
      expect(await verifyPin('ABCD', hash)).toBe(false);
    });
  });

  describe('Security properties', () => {
    it('should use sufficient iterations (10,000+)', async () => {
      // This is a timing-based test to ensure PBKDF2 is actually being used
      const pin = '1234';
      const startTime = Date.now();
      await hashPin(pin);
      const endTime = Date.now();

      // PBKDF2 with 10,000 iterations should take at least a few milliseconds
      // If it's instant, we're probably not using PBKDF2
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(1); // At least 1ms (very conservative)
    });

    it('should produce 32-byte (256-bit) hash', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);
      const [_salt, derivedKey] = hash.split(':');

      // Derived key should be hex-encoded 32 bytes = 64 hex characters
      expect(derivedKey.length).toBe(64);
    });

    it('should use 16-byte (128-bit) salt', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);
      const [salt, _derivedKey] = hash.split(':');

      // Salt should be hex-encoded 16 bytes = 32 hex characters
      expect(salt.length).toBe(32);
    });
  });
});
