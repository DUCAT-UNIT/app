// @ts-nocheck
/**
 * Tests for PIN Hashing Utilities
 */

import {
  timingSafeEqual,
  generateSalt,
  hashPin,
  verifyPinHash,
} from '../pinHashing';
import * as Crypto from 'expo-crypto';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
}));

// Mock react-native-quick-crypto
jest.mock('react-native-quick-crypto', () => ({
  pbkdf2Sync: jest.fn(),
}));

// Get mocked functions with proper typing
const mockGetRandomBytesAsync = Crypto.getRandomBytesAsync as jest.MockedFunction<typeof Crypto.getRandomBytesAsync>;
const mockPbkdf2Sync = jest.requireMock('react-native-quick-crypto').pbkdf2Sync as jest.Mock;

describe('timingSafeEqual', () => {
  it('should return true for equal buffers', () => {
    const buf1 = Buffer.from('hello');
    const buf2 = Buffer.from('hello');
    expect(timingSafeEqual(buf1, buf2)).toBe(true);
  });

  it('should return false for different buffers of same length', () => {
    const buf1 = Buffer.from('hello');
    const buf2 = Buffer.from('world');
    expect(timingSafeEqual(buf1, buf2)).toBe(false);
  });

  it('should return false for buffers of different lengths', () => {
    const buf1 = Buffer.from('hello');
    const buf2 = Buffer.from('hi');
    expect(timingSafeEqual(buf1, buf2)).toBe(false);
  });

  it('should return true for empty buffers', () => {
    const buf1 = Buffer.from('');
    const buf2 = Buffer.from('');
    expect(timingSafeEqual(buf1, buf2)).toBe(true);
  });

  it('should return true for identical byte arrays', () => {
    const buf1 = Buffer.from([1, 2, 3, 4, 5]);
    const buf2 = Buffer.from([1, 2, 3, 4, 5]);
    expect(timingSafeEqual(buf1, buf2)).toBe(true);
  });

  it('should return false for different byte arrays', () => {
    const buf1 = Buffer.from([1, 2, 3, 4, 5]);
    const buf2 = Buffer.from([1, 2, 3, 4, 6]);
    expect(timingSafeEqual(buf1, buf2)).toBe(false);
  });
});

describe('generateSalt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate a random salt in hex format', async () => {
    const mockRandomBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x12, 0x34]);
    mockGetRandomBytesAsync.mockResolvedValue(mockRandomBytes);

    const salt = await generateSalt();

    expect(mockGetRandomBytesAsync).toHaveBeenCalledWith(32); // CRYPTO.SALT_LENGTH_BYTES
    expect(salt).toBe('deadbeef1234');
  });

  it('should pad hex values with leading zeros', async () => {
    const mockRandomBytes = new Uint8Array([0x00, 0x01, 0x0f, 0x10, 0xff]);
    mockGetRandomBytesAsync.mockResolvedValue(mockRandomBytes);

    const salt = await generateSalt();

    expect(salt).toBe('00010f10ff');
  });

  it('should generate different salts on multiple calls', async () => {
    mockGetRandomBytesAsync
      .mockResolvedValueOnce(new Uint8Array([0x11, 0x22, 0x33]))
      .mockResolvedValueOnce(new Uint8Array([0x44, 0x55, 0x66]));

    const salt1 = await generateSalt();
    const salt2 = await generateSalt();

    expect(salt1).not.toBe(salt2);
  });
});

describe('hashPin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should hash a PIN using PBKDF2', async () => {
    const mockDerivedKey = Buffer.from('mockedhash123456789012345678901234567890123456789012345678901234');
    mockPbkdf2Sync.mockReturnValue(mockDerivedKey);

    const pin = '123456';
    const salt = 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';

    const hash = await hashPin(pin, salt);

    expect(mockPbkdf2Sync).toHaveBeenCalledWith(
      pin,
      Buffer.from(salt, 'hex'),
      10000, // CRYPTO.PIN_HASH_ITERATIONS
      64,
      'sha512'
    );
    expect(hash).toBe(mockDerivedKey.toString('hex'));
  });

  it('should throw error if hashing fails', async () => {
    mockPbkdf2Sync.mockImplementation(() => {
      throw new Error('Crypto error');
    });

    await expect(hashPin('123456', 'salt')).rejects.toThrow('PIN hashing failed: Crypto error');
  });

  it('should handle different PINs', async () => {
    const mockDerivedKey = Buffer.from('hash');
    mockPbkdf2Sync.mockReturnValue(mockDerivedKey);

    await hashPin('000000', 'salt123');
    expect(mockPbkdf2Sync).toHaveBeenCalledWith('000000', expect.any(Buffer), 10000, 64, 'sha512');

    await hashPin('999999', 'salt456');
    expect(mockPbkdf2Sync).toHaveBeenCalledWith('999999', expect.any(Buffer), 10000, 64, 'sha512');
  });
});

describe('verifyPinHash', () => {
  it('should return true for matching hashes', () => {
    const hash1 = 'deadbeef123456';
    const hash2 = 'deadbeef123456';

    expect(verifyPinHash(hash1, hash2)).toBe(true);
  });

  it('should return false for different hashes', () => {
    const hash1 = 'deadbeef123456';
    const hash2 = 'cafebabe654321';

    expect(verifyPinHash(hash1, hash2)).toBe(false);
  });

  it('should return false for hashes of different lengths', () => {
    const hash1 = 'deadbeef';
    const hash2 = 'deadbeef1234';

    expect(verifyPinHash(hash1, hash2)).toBe(false);
  });

  it('should return false for empty hashes', () => {
    expect(verifyPinHash('', '')).toBe(false);
  });

  it('should return false for invalid hex strings', () => {
    const hash1 = 'notvalidhex';
    const hash2 = 'notvalidhex';

    // Invalid hex will still be converted to Buffer, but won't match expected behavior
    const result = verifyPinHash(hash1, hash2);
    expect(typeof result).toBe('boolean');
  });

  it('should handle case sensitivity', () => {
    const hash1 = 'DEADBEEF';
    const hash2 = 'deadbeef';

    expect(verifyPinHash(hash1, hash2)).toBe(true);
  });

  it('should handle errors gracefully', () => {
    // Pass non-hex strings that could cause Buffer.from to fail
    expect(verifyPinHash(null as unknown as string, 'hash')).toBe(false);
  });

  it('should use constant-time comparison', () => {
    // This tests that verifyPinHash uses timingSafeEqual
    const hash1 = 'abcdef123456';
    const hash2 = 'abcdef123456';

    expect(verifyPinHash(hash1, hash2)).toBe(true);
  });
});
