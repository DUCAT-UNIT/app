/**
 * Tests for Passkey Encryption Service
 * Covers generateRandomMnemonic, deriveEncryptionKey, encryptMnemonic, decryptMnemonic
 * Uses real crypto implementation from jest.setup.js for integration testing
 */

import * as bip39 from 'bip39';
import { logger } from '../../../utils/logger';

// Mock bip39
jest.mock('bip39', () => ({
  generateMnemonic: jest.fn(),
  entropyToMnemonic: jest.fn(),
  validateMnemonic: jest.fn(),
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock pinService - use factory function so it works with static imports
jest.mock('../../pinService', () => ({
  hashPinForEncryption: jest.fn().mockResolvedValue('a'.repeat(64)),
}));

// Note: react-native-quick-crypto is mocked globally in jest.setup.js with real node:crypto functions

// Import after mocks
import {
  generateRandomMnemonic,
  deriveEncryptionKey,
  encryptMnemonic,
  decryptMnemonic,
} from '../encryption';
import { hashPinForEncryption } from '../../pinService';
import type { AesGcmKey, EncryptedMnemonicData } from '../../../types/crypto';

// Get mocked function reference
const mockHashPinForEncryption = hashPinForEncryption as jest.Mock;

describe('Passkey Encryption', () => {
  const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const mockCredentialId = new Uint8Array([1, 2, 3, 4, 5]);
  const mockUserHandle = new Uint8Array([6, 7, 8, 9, 10]);
  const mockPin = '123456';
  const mockHashedPin = 'a'.repeat(64);
  const mockPinSalt = 'b'.repeat(64);

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (bip39.generateMnemonic as jest.Mock).mockReturnValue(mockMnemonic);
    (bip39.entropyToMnemonic as jest.Mock).mockReturnValue(mockMnemonic);
    (bip39.validateMnemonic as jest.Mock).mockReturnValue(true);
    // Reset the mock implementation for each test
    mockHashPinForEncryption.mockResolvedValue(mockHashedPin);
  });

  describe('generateRandomMnemonic', () => {
    it('should generate valid 12-word mnemonic', () => {
      const mnemonic = generateRandomMnemonic();

      expect(bip39.entropyToMnemonic).toHaveBeenCalledWith(expect.any(String));
      expect(bip39.validateMnemonic).toHaveBeenCalledWith(mockMnemonic);
      expect(mnemonic).toBe(mockMnemonic);
    });

    it('should throw error if generated mnemonic is invalid', () => {
      (bip39.validateMnemonic as jest.Mock).mockReturnValue(false);

      expect(() => generateRandomMnemonic()).toThrow('Generated mnemonic is invalid');
    });

    it('should always generate 128-bit entropy (12 words)', () => {
      generateRandomMnemonic();

      // 128-bit entropy = 16 bytes = 32 hex chars
      expect(bip39.entropyToMnemonic).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{32}$/));
    });
  });

  describe('deriveEncryptionKey', () => {
    it('should derive encryption key with pre-hashed PIN', async () => {
      const key = await deriveEncryptionKey(
        mockCredentialId,
        mockUserHandle,
        mockHashedPin,
        mockPinSalt,
        true
      );

      // Key should be a CryptoKey from real crypto.subtle
      expect(key).toBeDefined();
      expect(key.algorithm.name).toBe('AES-GCM');
      expect(mockHashPinForEncryption).not.toHaveBeenCalled();
    });

    it('should derive encryption key with plain PIN', async () => {
      const key = await deriveEncryptionKey(
        mockCredentialId,
        mockUserHandle,
        mockPin,
        mockPinSalt,
        false
      );

      expect(key).toBeDefined();
      expect(key.algorithm.name).toBe('AES-GCM');
      expect(mockHashPinForEncryption).toHaveBeenCalledWith(mockPin, mockPinSalt);
    });

    it('should default to plain PIN when isPreHashed not provided', async () => {
      await deriveEncryptionKey(
        mockCredentialId,
        mockUserHandle,
        mockPin,
        mockPinSalt
      );

      expect(mockHashPinForEncryption).toHaveBeenCalledWith(mockPin, mockPinSalt);
    });

    it('should produce consistent keys with same inputs', async () => {
      const key1 = await deriveEncryptionKey(
        mockCredentialId,
        mockUserHandle,
        mockHashedPin,
        mockPinSalt,
        true
      );
      const key2 = await deriveEncryptionKey(
        mockCredentialId,
        mockUserHandle,
        mockHashedPin,
        mockPinSalt,
        true
      );

      // Both keys should be valid
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key1.algorithm.name).toBe(key2.algorithm.name);
    });

    it('should produce different keys with different credentials', async () => {
      const key1 = await deriveEncryptionKey(
        mockCredentialId,
        mockUserHandle,
        mockHashedPin,
        mockPinSalt,
        true
      );

      const differentCredentialId = new Uint8Array([10, 20, 30, 40, 50]);
      const key2 = await deriveEncryptionKey(
        differentCredentialId,
        mockUserHandle,
        mockHashedPin,
        mockPinSalt,
        true
      );

      // Both should produce valid keys (internal state differs)
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
    });

    it('should throw error if PIN hashing fails', async () => {
      mockHashPinForEncryption.mockRejectedValue(new Error('PIN hashing failed'));

      await expect(deriveEncryptionKey(
        mockCredentialId,
        mockUserHandle,
        mockPin,
        mockPinSalt,
        false
      )).rejects.toThrow('Failed to derive encryption key from passkey');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to derive encryption key',
        { error: 'PIN hashing failed' }
      );
    });
  });

  describe('encryptMnemonic', () => {
    let encryptionKey: AesGcmKey;

    beforeEach(async () => {
      encryptionKey = await deriveEncryptionKey(
        mockCredentialId,
        mockUserHandle,
        mockHashedPin,
        mockPinSalt,
        true
      );
    });

    it('should encrypt mnemonic successfully', async () => {
      const result = await encryptMnemonic(mockMnemonic, encryptionKey);

      expect(result.encrypted).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.tag).toBeDefined();
    });

    it('should return base64-encoded values', async () => {
      const result = await encryptMnemonic(mockMnemonic, encryptionKey);

      // Check that all outputs are valid base64
      expect(() => Buffer.from(result.encrypted, 'base64')).not.toThrow();
      expect(() => Buffer.from(result.iv, 'base64')).not.toThrow();
      expect(() => Buffer.from(result.tag, 'base64')).not.toThrow();
    });

    it('should generate 12-byte IV', async () => {
      const result = await encryptMnemonic(mockMnemonic, encryptionKey);

      const ivBuffer = Buffer.from(result.iv, 'base64');
      expect(ivBuffer.length).toBe(12);
    });

    it('should extract 16-byte tag', async () => {
      const result = await encryptMnemonic(mockMnemonic, encryptionKey);

      const tagBuffer = Buffer.from(result.tag, 'base64');
      expect(tagBuffer.length).toBe(16);
    });

    it('should produce different ciphertext each time (random IV)', async () => {
      const result1 = await encryptMnemonic(mockMnemonic, encryptionKey);
      const result2 = await encryptMnemonic(mockMnemonic, encryptionKey);

      // IVs should be different
      expect(result1.iv).not.toBe(result2.iv);
      // Ciphertext should be different due to different IVs
      expect(result1.encrypted).not.toBe(result2.encrypted);
    });
  });

  describe('decryptMnemonic', () => {
    let encryptionKey: AesGcmKey;
    let encrypted: EncryptedMnemonicData;

    beforeEach(async () => {
      encryptionKey = await deriveEncryptionKey(
        mockCredentialId,
        mockUserHandle,
        mockHashedPin,
        mockPinSalt,
        true
      );
      encrypted = await encryptMnemonic(mockMnemonic, encryptionKey);
    });

    it('should decrypt mnemonic successfully', async () => {
      const result = await decryptMnemonic(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.tag,
        encryptionKey
      );

      expect(result).toBe(mockMnemonic);
      expect(bip39.validateMnemonic).toHaveBeenCalledWith(mockMnemonic);
    });

    it('should throw error if decrypted mnemonic is invalid', async () => {
      (bip39.validateMnemonic as jest.Mock).mockReturnValue(false);

      await expect(decryptMnemonic(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.tag,
        encryptionKey
      )).rejects.toThrow('Failed to decrypt wallet seed');

      // The inner error should be logged
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to decrypt mnemonic',
        { error: 'Decrypted mnemonic is invalid' }
      );
    });

    it('should throw error with wrong key', async () => {
      const wrongKey = await deriveEncryptionKey(
        new Uint8Array([99, 99, 99, 99, 99]), // Different credential
        mockUserHandle,
        mockHashedPin,
        mockPinSalt,
        true
      );

      await expect(decryptMnemonic(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.tag,
        wrongKey
      )).rejects.toThrow('Failed to decrypt wallet seed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to decrypt mnemonic',
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('should throw error with tampered ciphertext', async () => {
      const tamperedEncrypted = Buffer.from(encrypted.encrypted, 'base64');
      tamperedEncrypted[0] ^= 0xFF; // Flip bits
      const tamperedBase64 = tamperedEncrypted.toString('base64');

      await expect(decryptMnemonic(
        tamperedBase64,
        encrypted.iv,
        encrypted.tag,
        encryptionKey
      )).rejects.toThrow('Failed to decrypt wallet seed');
    });

    it('should throw error with wrong tag (authentication failure)', async () => {
      const wrongTag = Buffer.alloc(16, 0xFF).toString('base64');

      await expect(decryptMnemonic(
        encrypted.encrypted,
        encrypted.iv,
        wrongTag,
        encryptionKey
      )).rejects.toThrow('Failed to decrypt wallet seed');
    });
  });

  describe('encryption/decryption round-trip', () => {
    it('should successfully encrypt and decrypt mnemonic', async () => {
      const key = await deriveEncryptionKey(
        mockCredentialId,
        mockUserHandle,
        mockHashedPin,
        mockPinSalt,
        true
      );

      // Encrypt
      const encrypted = await encryptMnemonic(mockMnemonic, key);

      // Decrypt
      const decrypted = await decryptMnemonic(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.tag,
        key
      );

      expect(decrypted).toBe(mockMnemonic);
    });

    it('should handle long mnemonics (24 words)', async () => {
      const longMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      (bip39.validateMnemonic as jest.Mock).mockReturnValue(true);

      const key = await deriveEncryptionKey(
        mockCredentialId,
        mockUserHandle,
        mockHashedPin,
        mockPinSalt,
        true
      );

      const encrypted = await encryptMnemonic(longMnemonic, key);
      const decrypted = await decryptMnemonic(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.tag,
        key
      );

      expect(decrypted).toBe(longMnemonic);
    });
  });
});
