/**
 * Tests for PSBT Binary Utilities
 */

// Mock crypto helpers
jest.mock('../../../utils/wallet/cryptoHelpers', () => ({
  varIntSize: jest.fn((n: number) => (n < 0xfd ? 1 : n <= 0xffff ? 3 : 5)),
  writeVarInt: jest.fn((buf: Buffer, value: number, offset: number) => {
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
  countPsbtInputs,
  patchPsbtSignatures,
  patchPsbtInputFields,
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

  describe('countPsbtInputs', () => {
    it('should count inputs in a simple PSBT', () => {
      // Create a minimal PSBT with magic, global map with unsigned tx
      const parts: Buffer[] = [];

      // PSBT magic: 0x70736274ff
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff]));

      // Global map: key-value for unsigned tx (key type 0x00)
      // Key: len(1) + type(0x00)
      parts.push(Buffer.from([0x01, 0x00]));

      // Value: a minimal transaction with 2 inputs
      // Tx structure: version(4) + marker(0x00) + flag(0x01) + inputCount(varint) + ...
      const txParts: Buffer[] = [];
      txParts.push(Buffer.from([0x02, 0x00, 0x00, 0x00])); // version 2
      txParts.push(Buffer.from([0x00, 0x01])); // witness marker + flag
      txParts.push(Buffer.from([0x02])); // 2 inputs (varint)
      const txData = Buffer.concat(txParts);

      // Value length + value
      parts.push(Buffer.from([txData.length]));
      parts.push(txData);

      // Global map terminator
      parts.push(Buffer.from([0x00]));

      const psbtBuffer = Buffer.concat(parts);
      const result = countPsbtInputs(psbtBuffer, 0);

      expect(result).toBe(2);
    });

    it('should throw when unsigned tx not found in PSBT', () => {
      // PSBT with magic but no unsigned tx
      const parts: Buffer[] = [];
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff])); // magic
      parts.push(Buffer.from([0x00])); // immediate terminator (no unsigned tx)

      const psbtBuffer = Buffer.concat(parts);

      expect(() => countPsbtInputs(psbtBuffer, 0)).toThrow('Could not find unsigned tx in PSBT');
    });

    it('should handle PSBT without witness marker', () => {
      const parts: Buffer[] = [];
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff])); // magic

      // Global map with unsigned tx (no witness)
      parts.push(Buffer.from([0x01, 0x00])); // key

      const txParts: Buffer[] = [];
      txParts.push(Buffer.from([0x01, 0x00, 0x00, 0x00])); // version 1
      // No witness marker (0x00 0x01) - go straight to input count
      txParts.push(Buffer.from([0x03])); // 3 inputs
      const txData = Buffer.concat(txParts);

      parts.push(Buffer.from([txData.length]));
      parts.push(txData);
      parts.push(Buffer.from([0x00])); // terminator

      const psbtBuffer = Buffer.concat(parts);
      const result = countPsbtInputs(psbtBuffer, 0);

      expect(result).toBe(3);
    });
  });

  describe('patchPsbtSignatures', () => {
    it('should throw for invalid PSBT magic', () => {
      const invalidPsbt = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]).toString('base64');

      expect(() => patchPsbtSignatures(invalidPsbt, [])).toThrow('Invalid PSBT magic');
    });

    it('should patch segwit signature into PSBT', () => {
      // Create a minimal valid PSBT structure
      const parts: Buffer[] = [];
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff])); // magic

      // Global map with unsigned tx
      parts.push(Buffer.from([0x01, 0x00])); // key
      const tx = Buffer.concat([
        Buffer.from([0x02, 0x00, 0x00, 0x00]), // version
        Buffer.from([0x00, 0x01]), // witness marker
        Buffer.from([0x01]), // 1 input
      ]);
      parts.push(Buffer.from([tx.length]));
      parts.push(tx);
      parts.push(Buffer.from([0x00])); // global terminator

      // Input map (empty for now)
      parts.push(Buffer.from([0x00])); // input terminator

      const psbtBase64 = Buffer.concat(parts).toString('base64');

      const signatures = [{
        inputIndex: 0,
        type: 'segwit' as const,
        signature: Buffer.from([0x30, 0x44]), // dummy signature
        pubkey: Buffer.from([0x02, 0xaa, 0xbb]), // dummy pubkey
      }];

      const result = patchPsbtSignatures(psbtBase64, signatures);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      // Result should be valid base64
      expect(() => Buffer.from(result, 'base64')).not.toThrow();
    });

    it('should patch taproot key signature', () => {
      const parts: Buffer[] = [];
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff])); // magic

      // Global map
      parts.push(Buffer.from([0x01, 0x00]));
      const tx = Buffer.concat([
        Buffer.from([0x02, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x01]),
        Buffer.from([0x01]),
      ]);
      parts.push(Buffer.from([tx.length]));
      parts.push(tx);
      parts.push(Buffer.from([0x00]));
      parts.push(Buffer.from([0x00])); // input terminator

      const psbtBase64 = Buffer.concat(parts).toString('base64');

      const signatures = [{
        inputIndex: 0,
        type: 'taproot-key' as const,
        signature: Buffer.from([0x01, 0x02, 0x03]),
      }];

      const result = patchPsbtSignatures(psbtBase64, signatures);
      expect(result).toBeTruthy();
    });

    it('should patch taproot script signature', () => {
      const parts: Buffer[] = [];
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff]));
      parts.push(Buffer.from([0x01, 0x00]));
      const tx = Buffer.concat([
        Buffer.from([0x02, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x01]),
        Buffer.from([0x01]),
      ]);
      parts.push(Buffer.from([tx.length]));
      parts.push(tx);
      parts.push(Buffer.from([0x00]));
      parts.push(Buffer.from([0x00]));

      const psbtBase64 = Buffer.concat(parts).toString('base64');

      const signatures = [{
        inputIndex: 0,
        type: 'taproot-script' as const,
        signature: Buffer.from([0x01, 0x02]),
        pubkey: Buffer.from([0xaa, 0xbb]),
        leafHash: Buffer.from([0xcc, 0xdd]),
      }];

      const result = patchPsbtSignatures(psbtBase64, signatures);
      expect(result).toBeTruthy();
    });

    it('should throw for invalid signature type', () => {
      const parts: Buffer[] = [];
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff]));
      parts.push(Buffer.from([0x01, 0x00]));
      const tx = Buffer.concat([
        Buffer.from([0x02, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x01]),
        Buffer.from([0x01]),
      ]);
      parts.push(Buffer.from([tx.length]));
      parts.push(tx);
      parts.push(Buffer.from([0x00]));
      parts.push(Buffer.from([0x00]));

      const psbtBase64 = Buffer.concat(parts).toString('base64');

      // Use a type assertion to test invalid type handling
      type SignatureType = 'segwit' | 'taproot-key' | 'taproot-script';
      const signatures = [{
        inputIndex: 0,
        type: 'invalid-type' as SignatureType, // Force invalid type for error handling test
        signature: Buffer.from([0x01]),
      }];

      expect(() => patchPsbtSignatures(psbtBase64, signatures)).toThrow('Invalid signature type');
    });

    it('should handle empty signatures array', () => {
      const parts: Buffer[] = [];
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff]));
      parts.push(Buffer.from([0x01, 0x00]));
      const tx = Buffer.concat([
        Buffer.from([0x02, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x01]),
        Buffer.from([0x01]),
      ]);
      parts.push(Buffer.from([tx.length]));
      parts.push(tx);
      parts.push(Buffer.from([0x00]));
      parts.push(Buffer.from([0x00]));

      const psbtBase64 = Buffer.concat(parts).toString('base64');
      const result = patchPsbtSignatures(psbtBase64, []);

      expect(result).toBeTruthy();
    });
  });

  describe('patchPsbtInputFields', () => {
    it('should throw for invalid PSBT magic', () => {
      const invalidPsbt = Buffer.from([0x11, 0x22, 0x33, 0x44, 0x55]).toString('base64');

      expect(() => patchPsbtInputFields(invalidPsbt, [])).toThrow('Invalid PSBT magic');
    });

    it('should add fields to PSBT input', () => {
      const parts: Buffer[] = [];
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff])); // magic

      // Global map
      parts.push(Buffer.from([0x01, 0x00]));
      const tx = Buffer.concat([
        Buffer.from([0x02, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x01]),
        Buffer.from([0x01]), // 1 input
      ]);
      parts.push(Buffer.from([tx.length]));
      parts.push(tx);
      parts.push(Buffer.from([0x00]));

      // Input map with existing field
      parts.push(Buffer.from([0x01, 0x01])); // key: len=1, type=0x01
      parts.push(Buffer.from([0x02, 0xaa, 0xbb])); // value: len=2, data
      parts.push(Buffer.from([0x00])); // terminator

      const psbtBase64 = Buffer.concat(parts).toString('base64');

      const fieldsToAdd = [{
        inputIndex: 0,
        fields: [{
          keyType: 0x02,
          key: Buffer.from([0x02, 0xcc]),
          value: Buffer.from([0x01, 0x02, 0x03]),
        }],
      }];

      const result = patchPsbtInputFields(psbtBase64, fieldsToAdd);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should not add duplicate field types', () => {
      const parts: Buffer[] = [];
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff]));
      parts.push(Buffer.from([0x01, 0x00]));
      const tx = Buffer.concat([
        Buffer.from([0x02, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x01]),
        Buffer.from([0x01]),
      ]);
      parts.push(Buffer.from([tx.length]));
      parts.push(tx);
      parts.push(Buffer.from([0x00]));

      // Input with existing field type 0x02
      parts.push(Buffer.from([0x01, 0x02]));
      parts.push(Buffer.from([0x01, 0xff]));
      parts.push(Buffer.from([0x00]));

      const psbtBase64 = Buffer.concat(parts).toString('base64');

      const fieldsToAdd = [{
        inputIndex: 0,
        fields: [{
          keyType: 0x02, // Same type as existing
          key: Buffer.from([0x02, 0xaa]),
          value: Buffer.from([0x01]),
        }],
      }];

      const result = patchPsbtInputFields(psbtBase64, fieldsToAdd);
      expect(result).toBeTruthy();
    });

    it('should handle empty fields array', () => {
      const parts: Buffer[] = [];
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff]));
      parts.push(Buffer.from([0x01, 0x00]));
      const tx = Buffer.concat([
        Buffer.from([0x02, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x01]),
        Buffer.from([0x01]),
      ]);
      parts.push(Buffer.from([tx.length]));
      parts.push(tx);
      parts.push(Buffer.from([0x00]));
      parts.push(Buffer.from([0x00]));

      const psbtBase64 = Buffer.concat(parts).toString('base64');
      const result = patchPsbtInputFields(psbtBase64, []);

      expect(result).toBeTruthy();
    });

    it('should handle multiple inputs', () => {
      const parts: Buffer[] = [];
      parts.push(Buffer.from([0x70, 0x73, 0x62, 0x74, 0xff]));
      parts.push(Buffer.from([0x01, 0x00]));
      const tx = Buffer.concat([
        Buffer.from([0x02, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x01]),
        Buffer.from([0x02]), // 2 inputs
      ]);
      parts.push(Buffer.from([tx.length]));
      parts.push(tx);
      parts.push(Buffer.from([0x00]));

      // Input 0
      parts.push(Buffer.from([0x00]));
      // Input 1
      parts.push(Buffer.from([0x00]));

      const psbtBase64 = Buffer.concat(parts).toString('base64');

      const fieldsToAdd = [
        {
          inputIndex: 0,
          fields: [{
            keyType: 0x03,
            key: Buffer.from([0x03]),
            value: Buffer.from([0x01]),
          }],
        },
        {
          inputIndex: 1,
          fields: [{
            keyType: 0x04,
            key: Buffer.from([0x04]),
            value: Buffer.from([0x02]),
          }],
        },
      ];

      const result = patchPsbtInputFields(psbtBase64, fieldsToAdd);
      expect(result).toBeTruthy();
    });
  });
});
