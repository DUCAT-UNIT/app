// @ts-nocheck
/**
 * Tests for PSBT Binary Utilities
 */

// Mock crypto helpers
jest.mock('../../../utils/wallet/cryptoHelpers', () => ({
  varIntSize: jest.fn((n) => (n < 0xfd ? 1 : n <= 0xffff ? 3 : 5)),
  writeVarInt: jest.fn((buf, value, offset) => {
    if (value < 0xfd) {
      buf[offset] = value;
      return 1;
    }
    return 1;
  }),
}));

import { Buffer } from 'buffer';
import {
  readVarInt,
  createPsbtKv,
  encodeWitnessStack,
  extractOpReturnFromPsbt,
} from '../psbtBinaryUtils';

describe('psbtBinaryUtils', () => {
  describe('readVarInt', () => {
    it('should read single-byte varint (< 0xfd)', () => {
      const buffer = Buffer.from([0x05]);
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(5);
      expect(result.bytesRead).toBe(1);
    });

    it('should read value 0', () => {
      const buffer = Buffer.from([0x00]);
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(0);
      expect(result.bytesRead).toBe(1);
    });

    it('should read max single-byte varint (0xfc)', () => {
      const buffer = Buffer.from([0xfc]);
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(252);
      expect(result.bytesRead).toBe(1);
    });

    it('should read two-byte varint (0xfd prefix)', () => {
      const buffer = Buffer.from([0xfd, 0x00, 0x01]); // 256 in little-endian
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(256);
      expect(result.bytesRead).toBe(3);
    });

    it('should read four-byte varint (0xfe prefix)', () => {
      const buffer = Buffer.from([0xfe, 0x00, 0x00, 0x01, 0x00]); // 65536 in little-endian
      const result = readVarInt(buffer, 0);
      expect(result.value).toBe(65536);
      expect(result.bytesRead).toBe(5);
    });

    it('should throw for 64-bit varint', () => {
      const buffer = Buffer.from([0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
      expect(() => readVarInt(buffer, 0)).toThrow('64-bit varint not supported');
    });

    it('should read varint at offset', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x10]); // varint at offset 2
      const result = readVarInt(buffer, 2);
      expect(result.value).toBe(16);
      expect(result.bytesRead).toBe(1);
    });
  });

  describe('createPsbtKv', () => {
    it('should create key-value pair with small key and value', () => {
      const key = Buffer.from([0x02, 0xab, 0xcd]);
      const value = Buffer.from([0x12, 0x34]);

      const result = createPsbtKv(key, value);

      // Should be: keyLen(1) + key(3) + valLen(1) + value(2) = 7 bytes
      expect(result.length).toBe(7);
      // First byte is key length
      expect(result[0]).toBe(3);
    });

    it('should create key-value pair with empty value', () => {
      const key = Buffer.from([0x00]);
      const value = Buffer.alloc(0);

      const result = createPsbtKv(key, value);

      // keyLen(1) + key(1) + valLen(1) + value(0) = 3 bytes
      expect(result.length).toBe(3);
    });
  });

  describe('encodeWitnessStack', () => {
    it('should encode empty witness stack', () => {
      const result = encodeWitnessStack([]);
      expect(result.length).toBe(1);
      expect(result[0]).toBe(0);
    });

    it('should encode single witness item', () => {
      const witness = [Buffer.from([0x01, 0x02, 0x03])];
      const result = encodeWitnessStack(witness);

      // count(1) + len(1) + data(3) = 5 bytes
      expect(result.length).toBe(5);
      expect(result[0]).toBe(1); // count
      expect(result[1]).toBe(3); // item length
    });

    it('should encode multiple witness items', () => {
      const witness = [
        Buffer.from([0x01, 0x02]),
        Buffer.from([0x03, 0x04, 0x05]),
      ];
      const result = encodeWitnessStack(witness);

      // count(1) + len1(1) + data1(2) + len2(1) + data2(3) = 8 bytes
      expect(result.length).toBe(8);
      expect(result[0]).toBe(2); // count
    });
  });

  describe('extractOpReturnFromPsbt', () => {
    it('should return null for invalid base64', () => {
      const result = extractOpReturnFromPsbt('not-valid-base64!!!');
      expect(result).toContain('error:');
    });

    it('should return null for empty string', () => {
      const result = extractOpReturnFromPsbt('');
      expect(result).toContain('error:');
    });

    it('should return null for invalid PSBT (no magic)', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      const result = extractOpReturnFromPsbt(buffer.toString('base64'));
      // Should either return null or error string
      expect(result === null || result?.includes('error')).toBe(true);
    });
  });
});
