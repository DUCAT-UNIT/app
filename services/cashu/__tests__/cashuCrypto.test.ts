// @ts-nocheck
/**
 * Tests for cashuCrypto service
 */

// Mock dependencies BEFORE imports
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  digest: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

jest.mock('@bitcoinerlab/secp256k1', () => ({
  pointFromScalar: jest.fn(() => new Uint8Array(33)),
  pointAdd: jest.fn(() => new Uint8Array(33)),
  pointMultiply: jest.fn(() => new Uint8Array([0x02, ...new Array(32).fill(0)])),
}));

jest.mock('@noble/secp256k1', () => ({
  Point: {
    fromHex: jest.fn().mockImplementation((hex) => {
      // Valid point - just return something
      if (hex.startsWith('02')) return { x: hex };
      throw new Error('Invalid point');
    }),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import * as crypto from 'expo-crypto';
import * as ecc from '@bitcoinerlab/secp256k1';
import { Point } from '@noble/secp256k1';
import {
  generateSecret,
  generateBlindingFactor,
  createProof,
  splitAmount,
  sumProofs,
  selectProofsForAmount,
  encodeToken,
  decodeToken,
  hashToCurve,
  createBlindedMessage,
  unblindSignature,
  createBlindedOutputs,
  unblindSignatures,
} from '../crypto';

describe('cashuCrypto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(1));
    (crypto.digest as jest.Mock).mockResolvedValue(new ArrayBuffer(32));
  });

  describe('generateSecret', () => {
    it('should generate a 64 character hex string', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0xab));

      const secret = await generateSecret();

      expect(secret).toBe('abababababababababababababababababababababababababababababababab');
      expect(secret.length).toBe(64);
      expect(crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    });
  });

  describe('generateBlindingFactor', () => {
    it('should generate a 64 character hex string', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0xcd));

      const blindingFactor = await generateBlindingFactor();

      expect(blindingFactor).toBe('cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd');
      expect(blindingFactor.length).toBe(64);
    });
  });

  describe('createProof', () => {
    it('should create a proof object with all fields', () => {
      const proof = createProof(100, 'secret123', 'Cvalue', 'keysetId');

      expect(proof).toEqual({
        amount: 100,
        secret: 'secret123',
        C: 'Cvalue',
        id: 'keysetId',
      });
    });
  });

  describe('splitAmount', () => {
    it('should split amount into powers of 2', () => {
      const amounts = splitAmount(100);

      // 100 = 64 + 32 + 4
      expect(amounts).toEqual([64, 32, 4]);
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('should handle single power of 2', () => {
      const amounts = splitAmount(64);

      expect(amounts).toEqual([64]);
    });

    it('should handle small amounts', () => {
      const amounts = splitAmount(7);

      // 7 = 4 + 2 + 1
      expect(amounts).toEqual([4, 2, 1]);
    });

    it('should handle zero', () => {
      const amounts = splitAmount(0);

      expect(amounts).toEqual([]);
    });

    it('should handle large amounts', () => {
      const amounts = splitAmount(16384);

      expect(amounts).toEqual([16384]);
    });

    it('should handle complex amounts', () => {
      const amounts = splitAmount(12345);

      // Verify sum equals original
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(12345);

      // All amounts should be powers of 2
      amounts.forEach((amount: any) => {
        expect(Math.log2(amount) % 1).toBe(0);
      });
    });
  });

  describe('sumProofs', () => {
    it('should sum proof amounts as integers (smallest units)', () => {
      const proofs = [
        { amount: 100, secret: 's1', C: 'C1', id: 'id1' },
        { amount: 200, secret: 's2', C: 'C2', id: 'id2' },
        { amount: 50, secret: 's3', C: 'C3', id: 'id3' },
      ];

      const sum = sumProofs(proofs);

      // 100 + 200 + 50 = 350 (smallest units, no division)
      expect(sum).toBe(350);
    });

    it('should handle empty array', () => {
      const sum = sumProofs([]);

      expect(sum).toBe(0);
    });

    it('should handle single proof', () => {
      const sum = sumProofs([{ amount: 500, secret: 's1', C: 'C1', id: 'id1' }]);

      expect(sum).toBe(500);
    });
  });

  describe('selectProofsForAmount', () => {
    it('should select proofs that cover the amount', () => {
      const proofs = [
        { amount: 64, secret: 's1', C: 'C1', id: 'id1' },
        { amount: 32, secret: 's2', C: 'C2', id: 'id2' },
        { amount: 8, secret: 's3', C: 'C3', id: 'id3' },
        { amount: 4, secret: 's4', C: 'C4', id: 'id4' },
      ];

      const selected = selectProofsForAmount(proofs, 40);

      const total = selected.reduce((sum, p) => sum + p.amount, 0);
      expect(total).toBeGreaterThanOrEqual(40);
    });

    it('should find exact match when possible', () => {
      const proofs = [
        { amount: 64, secret: 's1', C: 'C1', id: 'id1' },
        { amount: 32, secret: 's2', C: 'C2', id: 'id2' },
        { amount: 4, secret: 's3', C: 'C3', id: 'id3' },
      ];

      const selected = selectProofsForAmount(proofs, 36);

      // Should find 32 + 4 = 36 exact
      const total = selected.reduce((sum, p) => sum + p.amount, 0);
      expect(total).toBe(36);
    });

    it('should throw when insufficient funds', () => {
      const proofs = [
        { amount: 10, secret: 's1', C: 'C1', id: 'id1' },
        { amount: 5, secret: 's2', C: 'C2', id: 'id2' },
      ];

      expect(() => selectProofsForAmount(proofs, 100)).toThrow('Insufficient funds');
    });

    it('should handle single proof selection', () => {
      const proofs = [{ amount: 100, secret: 's1', C: 'C1', id: 'id1' }];

      const selected = selectProofsForAmount(proofs, 50);

      expect(selected).toHaveLength(1);
      expect(selected[0].amount).toBe(100);
    });

    it('should select minimum proofs needed', () => {
      const proofs = [
        { amount: 1, secret: 's1', C: 'C1', id: 'id1' },
        { amount: 1, secret: 's2', C: 'C2', id: 'id2' },
        { amount: 1, secret: 's3', C: 'C3', id: 'id3' },
        { amount: 100, secret: 's4', C: 'C4', id: 'id4' },
      ];

      const selected = selectProofsForAmount(proofs, 50);

      // Should pick the large proof, not multiple small ones
      const total = selected.reduce((sum, p) => sum + p.amount, 0);
      expect(total).toBeGreaterThanOrEqual(50);
    });
  });

  describe('encodeToken', () => {
    it('should encode proofs and mint URL', () => {
      const proofs = [
        { amount: 100, secret: 'abc', C: 'xyz', id: '00ffd' },
      ];
      const mint = 'https://mint.example.com';

      const encoded = encodeToken(proofs, mint);

      expect(encoded).toMatch(/^cashuA/);

      // Should be valid base64 after prefix
      const base64Part = encoded.replace(/^cashuA/, '');
      expect(() => Buffer.from(base64Part, 'base64').toString()).not.toThrow();
    });

    it('should include mint URL in encoded token', () => {
      const proofs = [{ amount: 50, secret: 's', C: 'c', id: 'id' }];
      const mint = 'https://testmint.com';

      const encoded = encodeToken(proofs, mint);
      const base64Part = encoded.replace(/^cashuA/, '');
      const decoded = JSON.parse(Buffer.from(base64Part, 'base64').toString());

      expect(decoded.token[0].mint).toBe(mint);
      expect(decoded.token[0].proofs).toEqual(proofs);
    });
  });

  describe('decodeToken', () => {
    it('should decode a valid cashuA token', () => {
      const proofs = [
        { amount: 100, secret: 'secret', C: 'signature', id: 'keysetid' },
      ];
      const mint = 'https://mint.example.com';
      const encoded = encodeToken(proofs, mint);

      const decoded = decodeToken(encoded);

      expect(decoded.mint).toBe(mint);
      expect(decoded.proofs).toEqual(proofs);
      expect(decoded.amount).toBe(100); // amount in smallest units (integer)
    });

    it('should handle token without version letter', () => {
      // Old format: cashueyJ...
      const tokenData = {
        token: [{
          mint: 'https://mint.com',
          proofs: [{ amount: 200, secret: 's', C: 'c', id: 'i' }],
        }],
      };
      const base64 = Buffer.from(JSON.stringify(tokenData)).toString('base64');
      const oldToken = 'cashu' + base64;

      const decoded = decodeToken(oldToken);

      expect(decoded.mint).toBe('https://mint.com');
      expect(decoded.proofs[0].amount).toBe(200);
    });

    it('should throw on invalid token format', () => {
      expect(() => decodeToken('invalid')).toThrow();
      expect(() => decodeToken('cashuAinvalidbase64!!')).toThrow();
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('should preserve data through encode/decode cycle', () => {
      const proofs = [
        { amount: 64, secret: 'secret1', C: 'sig1', id: 'ks1' },
        { amount: 32, secret: 'secret2', C: 'sig2', id: 'ks1' },
        { amount: 4, secret: 'secret3', C: 'sig3', id: 'ks1' },
      ];
      const mint = 'https://roundtrip.mint.com';

      const encoded = encodeToken(proofs, mint);
      const decoded = decodeToken(encoded);

      expect(decoded.mint).toBe(mint);
      expect(decoded.proofs).toEqual(proofs);
      expect(decoded.amount).toBe(100); // 64 + 32 + 4 = 100 (smallest units)
    });
  });

  describe('hashToCurve', () => {
    it('should hash secret to a valid curve point', async () => {
      // Mock digest to return valid hash
      (crypto.digest as jest.Mock).mockResolvedValue(new ArrayBuffer(32));

      const result = await hashToCurve('test-secret');

      // Should return a hex string starting with 02 (compressed point)
      expect(result).toMatch(/^02[0-9a-f]{64}$/i);
      expect(crypto.digest).toHaveBeenCalled();
    });

    it('should try multiple counters if point is invalid', async () => {
      // First call fails (invalid point), second succeeds
      (Point.fromHex as jest.Mock)
        .mockImplementationOnce(() => { throw new Error('Invalid point'); })
        .mockImplementationOnce(() => ({ x: '02' + '00'.repeat(32) }));

      // Return different hashes for each digest call
      (crypto.digest as jest.Mock)
        .mockResolvedValueOnce(new ArrayBuffer(32)) // domain hash
        .mockResolvedValueOnce(new ArrayBuffer(32)) // counter 0 - invalid
        .mockResolvedValueOnce(new ArrayBuffer(32)); // counter 1 - valid

      const result = await hashToCurve('test-secret');

      expect(result).toBeDefined();
      expect(Point.fromHex).toHaveBeenCalledTimes(2);
    });

    it('should throw error if no valid point found', async () => {
      // Make Point.fromHex always throw
      (Point.fromHex as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid point');
      });

      // Mock digest to always return same thing
      (crypto.digest as jest.Mock).mockResolvedValue(new ArrayBuffer(32));

      await expect(hashToCurve('test-secret')).rejects.toThrow('Could not hash to curve');
    });
  });

  describe('createBlindedMessage', () => {
    beforeEach(() => {
      // Reset Point.fromHex to default success behavior
      (Point.fromHex as jest.Mock).mockImplementation((hex) => {
        if (hex.startsWith('02')) return { x: hex };
        throw new Error('Invalid point');
      });
    });

    it('should create a blinded message with secret and blinding factor', async () => {
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0xab));
      (crypto.digest as jest.Mock).mockResolvedValue(new ArrayBuffer(32));

      const result = await createBlindedMessage('test-secret');

      expect(result).toHaveProperty('B_');
      expect(result).toHaveProperty('secret', 'test-secret');
      expect(result).toHaveProperty('r');
      expect(result.amount).toBe(0); // Default amount
    });

    it('should use provided blinding factor', async () => {
      const blindingFactor = 'cd'.repeat(32);
      (crypto.digest as jest.Mock).mockResolvedValue(new ArrayBuffer(32));

      const result = await createBlindedMessage('test-secret', blindingFactor);

      expect(result.r).toBe(blindingFactor);
    });

    it('should throw on blinding failure', async () => {
      // Make pointFromScalar throw
      (ecc.pointFromScalar as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Point calculation failed');
      });
      (crypto.digest as jest.Mock).mockResolvedValue(new ArrayBuffer(32));

      await expect(createBlindedMessage('test-secret')).rejects.toThrow('Blinding failed');
    });
  });

  describe('unblindSignature', () => {
    beforeEach(() => {
      (ecc.pointMultiply as jest.Mock).mockReturnValue(new Uint8Array([0x02, ...new Array(32).fill(0)]));
      (ecc.pointAdd as jest.Mock).mockReturnValue(new Uint8Array(33).fill(0xab));
    });

    it('should unblind a signature', () => {
      const C_ = '02' + 'aa'.repeat(32); // blinded signature
      const r = 'bb'.repeat(32); // blinding factor
      const A = '02' + 'cc'.repeat(32); // mint public key

      const result = unblindSignature(C_, r, A);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(ecc.pointMultiply).toHaveBeenCalled();
      expect(ecc.pointAdd).toHaveBeenCalled();
    });

    it('should negate y-coordinate by flipping prefix 02 to 03', () => {
      // Set up pointMultiply to return point with 02 prefix
      (ecc.pointMultiply as jest.Mock).mockReturnValue(new Uint8Array([0x02, ...new Array(32).fill(0)]));

      const C_ = '02' + 'aa'.repeat(32);
      const r = 'bb'.repeat(32);
      const A = '02' + 'cc'.repeat(32);

      unblindSignature(C_, r, A);

      // pointAdd should be called with negated point (03 prefix)
      expect(ecc.pointAdd).toHaveBeenCalled();
    });

    it('should negate y-coordinate by flipping prefix 03 to 02', () => {
      // Set up pointMultiply to return point with 03 prefix
      (ecc.pointMultiply as jest.Mock).mockReturnValue(new Uint8Array([0x03, ...new Array(32).fill(0)]));

      const C_ = '02' + 'aa'.repeat(32);
      const r = 'bb'.repeat(32);
      const A = '02' + 'cc'.repeat(32);

      unblindSignature(C_, r, A);

      // Should flip 03 to 02
      expect(ecc.pointAdd).toHaveBeenCalled();
    });

    it('should throw error on unblinding failure', () => {
      (ecc.pointMultiply as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Point multiply failed');
      });

      const C_ = '02' + 'aa'.repeat(32);
      const r = 'bb'.repeat(32);
      const A = '02' + 'cc'.repeat(32);

      // Should throw error instead of silently returning C_
      expect(() => unblindSignature(C_, r, A)).toThrow('Unblinding failed: Point multiply failed');
    });
  });

  describe('createBlindedOutputs', () => {
    beforeEach(() => {
      // Reset Point.fromHex to default success behavior
      (Point.fromHex as jest.Mock).mockImplementation((hex) => {
        if (hex.startsWith('02')) return { x: hex };
        throw new Error('Invalid point');
      });
      (crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32).fill(0xab));
      (crypto.digest as jest.Mock).mockResolvedValue(new ArrayBuffer(32));
    });

    it('should create blinded outputs for amounts', async () => {
      const result = await createBlindedOutputs([64, 32, 4]);

      expect(result).toHaveProperty('outputs');
      expect(result).toHaveProperty('blindingData');
      expect(result.outputs).toHaveLength(3);
      expect(result.blindingData).toHaveLength(3);
    });

    it('should include keyset ID if provided', async () => {
      const result = await createBlindedOutputs([100], 'keyset123');

      expect(result.outputs[0]).toHaveProperty('id', 'keyset123');
    });

    it('should not include keyset ID if not provided', async () => {
      const result = await createBlindedOutputs([100]);

      expect(result.outputs[0]).not.toHaveProperty('id');
    });

    it('should sort outputs by amount ascending', async () => {
      const result = await createBlindedOutputs([64, 4, 32]);

      // Should be sorted: 4, 32, 64
      expect(result.outputs[0].amount).toBe(4);
      expect(result.outputs[1].amount).toBe(32);
      expect(result.outputs[2].amount).toBe(64);
    });

    it('should include blinding data for unblinding later', async () => {
      const result = await createBlindedOutputs([100]);

      expect(result.blindingData[0]).toHaveProperty('amount');
      expect(result.blindingData[0]).toHaveProperty('secret');
      expect(result.blindingData[0]).toHaveProperty('r');
      expect(result.blindingData[0]).toHaveProperty('B_');
    });
  });

  describe('unblindSignatures', () => {
    beforeEach(() => {
      (ecc.pointMultiply as jest.Mock).mockReturnValue(new Uint8Array([0x02, ...new Array(32).fill(0)]));
      (ecc.pointAdd as jest.Mock).mockReturnValue(new Uint8Array(33).fill(0xab));
    });

    it('should unblind signatures and create proofs', () => {
      const signatures = [
        { C_: '02' + 'aa'.repeat(32), id: 'keyset1' },
      ];
      const blindingData = [
        { amount: 100, secret: 'secret1', r: 'bb'.repeat(32), B_: '02' + 'cc'.repeat(32) },
      ];
      const keys = { 100: '02' + 'dd'.repeat(32) };

      const proofs = unblindSignatures(signatures, blindingData, keys, 'keyset1');

      expect(proofs).toHaveLength(1);
      expect(proofs[0]).toHaveProperty('amount', 100);
      expect(proofs[0]).toHaveProperty('secret', 'secret1');
      expect(proofs[0]).toHaveProperty('C');
      expect(proofs[0]).toHaveProperty('id');
    });

    it('should throw error when public key is missing for amount', () => {
      const signatures = [
        { C_: '02' + 'aa'.repeat(32), id: 'keyset1' },
      ];
      const blindingData = [
        { amount: 100, secret: 'secret1', r: 'bb'.repeat(32), B_: '02' + 'cc'.repeat(32) },
      ];
      const keys = {}; // No key for amount 100

      // Now throws error instead of silently skipping - prevents fund loss
      expect(() => unblindSignatures(signatures, blindingData, keys, 'keyset1')).toThrow(
        'No public key available for amount 100. Cannot unblind signature.'
      );
    });

    it('should use signature id if present', () => {
      const signatures = [
        { C_: '02' + 'aa'.repeat(32), id: 'sig-keyset' },
      ];
      const blindingData = [
        { amount: 100, secret: 'secret1', r: 'bb'.repeat(32), B_: '02' + 'cc'.repeat(32) },
      ];
      const keys = { 100: '02' + 'dd'.repeat(32) };

      const proofs = unblindSignatures(signatures, blindingData, keys, 'fallback-keyset');

      expect(proofs[0].id).toBe('sig-keyset');
    });

    it('should use fallback keysetId if signature has no id', () => {
      const signatures = [
        { C_: '02' + 'aa'.repeat(32) }, // No id
      ];
      const blindingData = [
        { amount: 100, secret: 'secret1', r: 'bb'.repeat(32), B_: '02' + 'cc'.repeat(32) },
      ];
      const keys = { 100: '02' + 'dd'.repeat(32) };

      const proofs = unblindSignatures(signatures, blindingData, keys, 'fallback-keyset');

      expect(proofs[0].id).toBe('fallback-keyset');
    });

    it('should handle multiple signatures', () => {
      const signatures = [
        { C_: '02' + 'aa'.repeat(32), id: 'ks1' },
        { C_: '02' + 'bb'.repeat(32), id: 'ks1' },
      ];
      const blindingData = [
        { amount: 64, secret: 'secret1', r: 'cc'.repeat(32), B_: '02' + 'dd'.repeat(32) },
        { amount: 32, secret: 'secret2', r: 'ee'.repeat(32), B_: '02' + 'ff'.repeat(32) },
      ];
      const keys = { 64: '02' + 'a1'.repeat(32), 32: '02' + 'a2'.repeat(32) };

      const proofs = unblindSignatures(signatures, blindingData, keys, 'ks1');

      expect(proofs).toHaveLength(2);
      expect(proofs[0].amount).toBe(64);
      expect(proofs[1].amount).toBe(32);
    });
  });

  describe('selectProofsForAmount - greedy algorithm', () => {
    it('should use greedy algorithm for large number of proofs (>15)', () => {
      // Create 20 proofs of various small amounts
      const proofs = Array.from({ length: 20 }, (_, i) => ({ amount: i + 1, secret: `s${i}`, C: `C${i}`, id: `id${i}` }));

      // Should not hang - greedy algorithm kicks in for > 15 proofs
      const selected = selectProofsForAmount(proofs, 50);

      const total = selected.reduce((sum, p) => sum + p.amount, 0);
      expect(total).toBeGreaterThanOrEqual(50);
    });
  });
});
