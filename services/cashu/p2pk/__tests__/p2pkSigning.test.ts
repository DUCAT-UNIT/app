/**
 * Tests for P2PK Signing (NUT-11)
 *
 * Note: This test file tests the signP2PKSecret and signP2PKProofs functions
 * using mocked crypto dependencies.
 */

// Mock all dependencies BEFORE any imports
jest.mock('react-native-quick-crypto', () => ({
  createHash: () => ({
    update: jest.fn().mockReturnThis(),
    digest: () => Buffer.alloc(32, 0xab),
  }),
}));

const mockSignSchnorr: jest.Mock = jest.fn(() => Buffer.alloc(64, 0xde));
const mockPointFromScalar: jest.Mock = jest.fn(() => Buffer.alloc(33, 0xef));

jest.mock('@bitcoinerlab/secp256k1', () => ({
  signSchnorr: (...args: any[]) => mockSignSchnorr(...(args as [any, any])),
  pointFromScalar: (...args: any[]) => mockPointFromScalar(...(args as [any])),
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

const mockIsP2PKLocked = jest.fn();
jest.mock('../p2pkVerification', () => ({
  isP2PKLocked: (...args: unknown[]) => mockIsP2PKLocked(...args),
}));

import { signP2PKSecret, signP2PKProofs } from '../p2pkSigning';

describe('p2pkSigning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignSchnorr.mockReturnValue(Buffer.alloc(64, 0xde));
    mockPointFromScalar.mockReturnValue(Buffer.alloc(33, 0xef));
    mockIsP2PKLocked.mockReset();
  });

  describe('signP2PKSecret', () => {
    const validPrivateKey = 'ab'.repeat(32); // 64 hex chars = 32 bytes
    const validSecret = JSON.stringify(['P2PK', { data: 'cd'.repeat(32), nonce: 'nonce123' }]);

    beforeEach(() => {
      // Mock successful signing (already set in outer beforeEach)
    });

    it('should create valid witness with Schnorr signature', async () => {
      const result = await signP2PKSecret(validSecret, validPrivateKey);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('signatures');
      expect(parsed.signatures).toHaveLength(1);
      expect(typeof parsed.signatures[0]).toBe('string');
    });

    it('should call signSchnorr with correct parameters', async () => {
      await signP2PKSecret(validSecret, validPrivateKey);

      expect(mockSignSchnorr).toHaveBeenCalledWith(
        expect.any(Buffer), // message hash
        expect.any(Buffer)  // private key
      );
    });

    it('should throw error for invalid private key length', async () => {
      const shortPrivateKey = 'ab'.repeat(16); // Too short

      await expect(signP2PKSecret(validSecret, shortPrivateKey))
        .rejects.toThrow('Invalid private key length');
    });

    it('should throw error when signSchnorr fails', async () => {
      mockSignSchnorr.mockImplementation(() => {
        throw new Error('Signing failed');
      });

      await expect(signP2PKSecret(validSecret, validPrivateKey))
        .rejects.toThrow('P2PK signing failed');
    });

    it('should handle non-P2PK secret format gracefully', async () => {
      const regularSecret = 'just a regular secret string';

      // Should still attempt to sign (mint decides validity)
      const result = await signP2PKSecret(regularSecret, validPrivateKey);
      expect(JSON.parse(result)).toHaveProperty('signatures');
    });

    it('should include diagnostics in error message on failure', async () => {
      mockSignSchnorr.mockImplementation(() => {
        throw new Error('Sign error');
      });

      try {
        await signP2PKSecret(validSecret, validPrivateKey);
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Secret length:');
        expect((error as Error).message).toContain('Private key length:');
      }
    });

    it('should handle null secret in error diagnostics', async () => {
      mockSignSchnorr.mockImplementation(() => {
        throw new Error('Sign error');
      });

      try {
        await signP2PKSecret(null as unknown as string, validPrivateKey);
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Secret is null/undefined');
      }
    });

    it('should handle null private key in error diagnostics', async () => {
      mockSignSchnorr.mockImplementation(() => {
        throw new Error('Sign error');
      });

      try {
        await signP2PKSecret(validSecret, null as unknown as string);
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Private key is null/undefined');
      }
    });

    it('should handle pointFromScalar failure gracefully', async () => {
      mockPointFromScalar.mockReturnValue(null);

      // Should still work, just without derived pubkey in logs
      const result = await signP2PKSecret(validSecret, validPrivateKey);
      expect(JSON.parse(result)).toHaveProperty('signatures');
    });

    it('should handle pointFromScalar throwing', async () => {
      mockPointFromScalar.mockImplementation(() => {
        throw new Error('Point derivation failed');
      });

      // Should still work
      const result = await signP2PKSecret(validSecret, validPrivateKey);
      expect(JSON.parse(result)).toHaveProperty('signatures');
    });
  });

  describe('signP2PKProofs', () => {
    const validPrivateKey = 'ab'.repeat(32);

    beforeEach(() => {
      // Mocks are already set in outer beforeEach
    });

    it('should sign all P2PK locked proofs', async () => {
      mockIsP2PKLocked.mockReturnValue(true);

      const proofs = [
        { amount: 100, secret: JSON.stringify(['P2PK', { data: 'pub1' }]), C: 'c1', id: 'id1' },
        { amount: 50, secret: JSON.stringify(['P2PK', { data: 'pub2' }]), C: 'c2', id: 'id2' },
      ];

      const result = await signP2PKProofs(proofs, validPrivateKey);

      expect(result).toHaveLength(2);
      expect(result[0].witness).toBeDefined();
      expect(result[1].witness).toBeDefined();
    });

    it('should not add witness to non-P2PK proofs', async () => {
      mockIsP2PKLocked.mockReturnValue(false);

      const proofs = [
        { amount: 100, secret: 'regular_secret', C: 'c1', id: 'id1' },
      ];

      const result = await signP2PKProofs(proofs, validPrivateKey);

      expect(result).toHaveLength(1);
      expect(result[0].witness).toBeUndefined();
    });

    it('should handle mixed proofs (P2PK and regular)', async () => {
      // Mock based on proof content
      mockIsP2PKLocked.mockImplementation((proof) => {
        return proof.secret.includes('P2PK');
      });

      const proofs = [
        { amount: 100, secret: JSON.stringify(['P2PK', { data: 'pub1' }]), C: 'c1', id: 'id1' },
        { amount: 50, secret: 'regular_secret', C: 'c2', id: 'id2' },
      ];

      const result = await signP2PKProofs(proofs, validPrivateKey);

      expect(result[0].witness).toBeDefined();
      expect(result[1].witness).toBeUndefined();
    });

    it('should preserve original proof properties', async () => {
      mockIsP2PKLocked.mockReturnValue(true);

      const proofs = [
        { amount: 100, secret: JSON.stringify(['P2PK', { data: 'pub1' }]), C: 'c1', id: 'id1' },
      ];

      const result = await signP2PKProofs(proofs, validPrivateKey);

      expect(result[0].amount).toBe(100);
      expect(result[0].C).toBe('c1');
      expect(result[0].id).toBe('id1');
    });

    it('should handle empty proofs array', async () => {
      const result = await signP2PKProofs([], validPrivateKey);
      expect(result).toEqual([]);
    });

    it('should sign proofs in parallel', async () => {
      mockIsP2PKLocked.mockReturnValue(true);

      const proofs = Array(10).fill(null).map((_, i) => ({
        amount: 100,
        secret: JSON.stringify(['P2PK', { data: `pub${i}` }]),
        C: `c${i}`,
        id: `id${i}`,
      }));

      const result = await signP2PKProofs(proofs, validPrivateKey);

      expect(result).toHaveLength(10);
      result.forEach(proof => {
        expect(proof.witness).toBeDefined();
      });
    });
  });
});
