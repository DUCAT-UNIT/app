/**
 * Tests for P2PK Verification (NUT-11)
 */

// Mock dependencies before imports
jest.mock('expo-crypto', () => ({
  digest: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

jest.mock('@noble/secp256k1', () => ({
  schnorr: {
    verify: jest.fn(),
  },
}));

jest.mock('../../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    cashu: jest.fn(),
  },
}));

// Mock the crypto module for hasP2PKProofs
jest.mock('../../crypto', () => ({
  decodeToken: jest.fn(),
  decodeTokenMetadata: jest.fn(),
}));

import * as crypto from 'expo-crypto';
import { schnorr } from '@noble/secp256k1';
import {
  isP2PKSecret,
  getP2PKRecipient,
  verifyP2PKWitness,
  isP2PKLocked,
  hasP2PKProofs,
} from '../p2pkVerification';
import { decodeToken, decodeTokenMetadata } from '../../crypto';

describe('p2pkVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (decodeTokenMetadata as jest.Mock).mockImplementation((token: string) => (decodeToken as jest.Mock)(token));
  });

  describe('isP2PKSecret', () => {
    it('should return true for valid P2PK secret', () => {
      const secret = JSON.stringify(['P2PK', { data: 'pubkey123', nonce: 'nonce123' }]);
      expect(isP2PKSecret(secret)).toBe(true);
    });

    it('should return false for non-P2PK secret', () => {
      const secret = JSON.stringify(['OTHER', { data: 'something' }]);
      expect(isP2PKSecret(secret)).toBe(false);
    });

    it('should return false for plain string secret', () => {
      const secret = 'just a plain secret string';
      expect(isP2PKSecret(secret)).toBe(false);
    });

    it('should return false for invalid JSON', () => {
      const secret = 'not valid json{';
      expect(isP2PKSecret(secret)).toBe(false);
    });

    it('should return false for non-array JSON', () => {
      const secret = JSON.stringify({ type: 'P2PK', data: 'pubkey' });
      expect(isP2PKSecret(secret)).toBe(false);
    });

    it('should return false for empty array', () => {
      const secret = JSON.stringify([]);
      expect(isP2PKSecret(secret)).toBe(false);
    });
  });

  describe('getP2PKRecipient', () => {
    it('should extract recipient pubkey from valid P2PK secret', () => {
      const pubkey = 'deadbeef'.repeat(8);
      const secret = JSON.stringify(['P2PK', { data: pubkey, nonce: 'nonce123' }]);

      expect(getP2PKRecipient(secret)).toBe(pubkey);
    });

    it('should return null for non-P2PK secret', () => {
      const secret = JSON.stringify(['OTHER', { data: 'pubkey' }]);
      expect(getP2PKRecipient(secret)).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const secret = 'invalid json{';
      expect(getP2PKRecipient(secret)).toBeNull();
    });

    it('should return null for non-array structure', () => {
      const secret = JSON.stringify({ data: 'pubkey' });
      expect(getP2PKRecipient(secret)).toBeNull();
    });

    it('should return null for P2PK without data field', () => {
      const secret = JSON.stringify(['P2PK', { nonce: 'nonce123' }]);
      expect(getP2PKRecipient(secret)).toBeNull();
    });
  });

  describe('verifyP2PKWitness', () => {
    const secret = JSON.stringify(['P2PK', { data: 'pubkey123' }]);
    const mockHash = new ArrayBuffer(32);

    beforeEach(() => {
      (crypto.digest as jest.Mock).mockResolvedValue(mockHash);
    });

    it('should return true for valid signature (64 char x-only pubkey)', async () => {
      const witness = JSON.stringify({ signatures: ['ab'.repeat(64)] }); // 128 hex chars = 64 bytes
      const publicKey = 'ab'.repeat(32); // 64 chars - x-only

      (schnorr.verify as jest.Mock).mockReturnValue(true);

      const result = await verifyP2PKWitness(secret, witness, publicKey);
      expect(result).toBe(true);
    });

    it('should return true for valid signature (66 char compressed pubkey)', async () => {
      const witness = JSON.stringify({ signatures: ['ab'.repeat(64)] });
      const publicKey = '02' + 'ab'.repeat(32); // 66 chars - compressed with prefix

      (schnorr.verify as jest.Mock).mockReturnValue(true);

      const result = await verifyP2PKWitness(secret, witness, publicKey);
      expect(result).toBe(true);
    });

    it('should return false for invalid signature', async () => {
      const witness = JSON.stringify({ signatures: ['invalid_sig'] });
      const publicKey = 'ab'.repeat(32);

      (schnorr.verify as jest.Mock).mockReturnValue(false);

      const result = await verifyP2PKWitness(secret, witness, publicKey);
      expect(result).toBe(false);
    });

    it('should return false when witness has no signatures', async () => {
      const witness = JSON.stringify({ signatures: [] });
      const publicKey = 'ab'.repeat(32);

      const result = await verifyP2PKWitness(secret, witness, publicKey);
      expect(result).toBe(false);
    });

    it('should return false when witness is missing signatures field', async () => {
      const witness = JSON.stringify({ other: 'data' });
      const publicKey = 'ab'.repeat(32);

      const result = await verifyP2PKWitness(secret, witness, publicKey);
      expect(result).toBe(false);
    });

    it('should return false for invalid pubkey length', async () => {
      const witness = JSON.stringify({ signatures: ['sig'.repeat(43)] });
      const publicKey = 'ab'.repeat(10); // Invalid length

      const result = await verifyP2PKWitness(secret, witness, publicKey);
      expect(result).toBe(false);
    });

    it('should return false when verification throws', async () => {
      const witness = JSON.stringify({ signatures: ['ab'.repeat(64)] });
      const publicKey = 'ab'.repeat(32);

      (schnorr.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Verification error');
      });

      const result = await verifyP2PKWitness(secret, witness, publicKey);
      expect(result).toBe(false);
    });

    it('should return false for invalid witness JSON', async () => {
      const witness = 'not valid json{';
      const publicKey = 'ab'.repeat(32);

      const result = await verifyP2PKWitness(secret, witness, publicKey);
      expect(result).toBe(false);
    });
  });

  describe('isP2PKLocked', () => {
    it('should return true for P2PK locked proof', () => {
      const proof = {
        amount: 100,
        secret: JSON.stringify(['P2PK', { data: 'pubkey123' }]),
        C: 'commitment',
        id: 'keysetId',
      };

      expect(isP2PKLocked(proof)).toBe(true);
    });

    it('should return false for non-P2PK proof', () => {
      const proof = {
        amount: 100,
        secret: 'regular_secret_string',
        C: 'commitment',
        id: 'keysetId',
      };

      expect(isP2PKLocked(proof)).toBe(false);
    });

    it('should return false for proof without secret', () => {
      const proof = {
        amount: 100,
        secret: '',
        C: 'commitment',
        id: 'keysetId',
      };

      expect(isP2PKLocked(proof)).toBe(false);
    });

    it('should return false for proof with null secret', () => {
      const proof = {
        amount: 100,
        secret: null as any,
        C: 'commitment',
        id: 'keysetId',
      };

      expect(isP2PKLocked(proof)).toBe(false);
    });
  });

  describe('hasP2PKProofs', () => {
    it('should return true for token with P2PK proofs', () => {
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: [
          { amount: 100, secret: JSON.stringify(['P2PK', { data: 'pubkey' }]), C: 'c1', id: 'id1' },
        ],
      });

      expect(hasP2PKProofs('cashuBbc123')).toBe(true);
    });

    it('should return false for token with no P2PK proofs', () => {
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: [
          { amount: 100, secret: 'regular_secret', C: 'c1', id: 'id1' },
        ],
      });

      expect(hasP2PKProofs('cashuBbc123')).toBe(false);
    });

    it('should return false for token with no proofs array', () => {
      (decodeToken as jest.Mock).mockReturnValue({});

      expect(hasP2PKProofs('cashuBbc123')).toBe(false);
    });

    it('should return false for token with non-array proofs', () => {
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: 'not an array',
      });

      expect(hasP2PKProofs('cashuBbc123')).toBe(false);
    });

    it('should return false when decodeToken throws', () => {
      (decodeToken as jest.Mock).mockImplementation(() => {
        throw new Error('Decode error');
      });

      expect(hasP2PKProofs('invalid_token')).toBe(false);
    });

    it('should return true for mixed proofs (some P2PK, some regular)', () => {
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: [
          { amount: 100, secret: JSON.stringify(['P2PK', { data: 'pubkey' }]), C: 'c1', id: 'id1' },
          { amount: 50, secret: 'regular_secret', C: 'c2', id: 'id2' },
        ],
      });

      expect(hasP2PKProofs('cashuBbc123')).toBe(true);
    });

    it('should handle proofs with invalid JSON secrets', () => {
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: [
          { amount: 100, secret: 'not valid json{', C: 'c1', id: 'id1' },
        ],
      });

      expect(hasP2PKProofs('cashuBbc123')).toBe(false);
    });
  });
});
