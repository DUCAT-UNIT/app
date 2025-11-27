// @ts-nocheck
/**
 * Tests for Passkey Core - Basic support checks and constants
 */

import { Passkey } from 'react-native-passkey';
import { logger } from '../../../utils/logger';

// Mock react-native-passkey
jest.mock('react-native-passkey', () => ({
  Passkey: {
    isSupported: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks
import {
  PASSKEY_KEYS,
  PASSKEY_STORAGE_KEYS,
  isPasskeySupported,
  toBase64Url,
  fromBase64Url,
} from '../core';

describe('Passkey Core', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PASSKEY_KEYS', () => {
    it('should have correct storage keys', () => {
      expect(PASSKEY_KEYS.ENABLED).toBe('passkey_enabled_v1');
      expect(PASSKEY_KEYS.CREDENTIAL_ID).toBe('passkey_credential_id_v1');
      expect(PASSKEY_KEYS.USER_HANDLE).toBe('passkey_user_handle_v1');
      expect(PASSKEY_KEYS.CREATION_METHOD).toBe('wallet_creation_method_v1');
      expect(PASSKEY_KEYS.ENCRYPTED_MNEMONIC).toBe('passkey_encrypted_mnemonic_v1');
      expect(PASSKEY_KEYS.ENCRYPTION_IV).toBe('passkey_encryption_iv_v1');
      expect(PASSKEY_KEYS.ENCRYPTION_TAG).toBe('passkey_encryption_tag_v1');
    });

    it('should export PASSKEY_STORAGE_KEYS as alias', () => {
      expect(PASSKEY_STORAGE_KEYS).toBe(PASSKEY_KEYS);
    });
  });

  describe('isPasskeySupported', () => {
    it('should return true when passkeys are supported', async () => {
      (Passkey.isSupported as jest.Mock).mockReturnValue(true);

      const result = await isPasskeySupported();

      expect(result).toBe(true);
      expect(Passkey.isSupported).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Passkey support check', { supported: true });
    });

    it('should return false when passkeys are not supported', async () => {
      (Passkey.isSupported as jest.Mock).mockReturnValue(false);

      const result = await isPasskeySupported();

      expect(result).toBe(false);
      expect(Passkey.isSupported).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Passkey support check', { supported: false });
    });

    it('should return false and log error when check throws', async () => {
      const error = new Error('Platform not supported');
      (Passkey.isSupported as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const result = await isPasskeySupported();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Failed to check passkey support', {
        error: 'Platform not supported',
      });
    });
  });

  describe('toBase64Url', () => {
    it('should convert Uint8Array to base64url string', () => {
      const input = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = toBase64Url(input);

      expect(result).toBe('SGVsbG8');
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).not.toContain('=');
    });

    it('should replace + with -', () => {
      // Create input that would produce + in base64
      const input = new Uint8Array([251, 239]); // produces "++" in standard base64
      const result = toBase64Url(input);

      expect(result).not.toContain('+');
    });

    it('should replace / with _', () => {
      // Create input that would produce / in base64
      const input = new Uint8Array([255, 255]); // produces "//" in standard base64
      const result = toBase64Url(input);

      expect(result).not.toContain('/');
    });

    it('should remove padding characters', () => {
      const input = new Uint8Array([1]); // Would have padding in standard base64
      const result = toBase64Url(input);

      expect(result).not.toContain('=');
    });

    it('should handle empty input', () => {
      const input = new Uint8Array([]);
      const result = toBase64Url(input);

      expect(result).toBe('');
    });

    it('should handle 32-byte challenge', () => {
      const input = new Uint8Array(32).fill(255);
      const result = toBase64Url(input);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).not.toContain('=');
    });
  });

  describe('fromBase64Url', () => {
    it('should convert base64url string to Buffer', () => {
      const input = 'SGVsbG8'; // "Hello" in base64url
      const result = fromBase64Url(input);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('Hello');
    });

    it('should handle - characters', () => {
      const input = '--__'; // Would be ++// in standard base64
      const result = fromBase64Url(input);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle _ characters', () => {
      const input = '____';
      const result = fromBase64Url(input);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should add padding when needed', () => {
      // Input without padding (would need 1 = in standard base64)
      const input = 'YQ'; // "a" in base64url without padding
      const result = fromBase64Url(input);

      expect(result.toString()).toBe('a');
    });

    it('should add two padding characters when needed', () => {
      // Input that needs 2 padding characters
      const input = 'YWI'; // "ab" in base64url without padding
      const result = fromBase64Url(input);

      expect(result.toString()).toBe('ab');
    });

    it('should handle empty string', () => {
      const result = fromBase64Url('');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should round-trip with toBase64Url', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const encoded = toBase64Url(original);
      const decoded = fromBase64Url(encoded);

      expect(Buffer.from(original)).toEqual(decoded);
    });

    it('should handle credential IDs correctly', () => {
      // Simulate a real credential ID
      const credentialId = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        credentialId[i] = i;
      }

      const encoded = toBase64Url(credentialId);
      const decoded = fromBase64Url(encoded);

      expect(decoded).toEqual(Buffer.from(credentialId));
    });
  });
});
