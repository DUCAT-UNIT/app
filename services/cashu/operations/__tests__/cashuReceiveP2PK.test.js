/**
 * Tests for cashuReceiveP2PK
 */

jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '17.0',
  },
}));

jest.mock('../../cashuMintClient', () => ({
  MINT_URL: 'https://mint.test.com',
  swapTokens: jest.fn(),
}));

jest.mock('../../crypto', () => ({
  createBlindedOutputs: jest.fn(),
  unblindSignatures: jest.fn(),
  splitAmount: jest.fn(),
  decodeToken: jest.fn(),
}));

jest.mock('../../p2pk', () => ({
  isP2PKSecret: jest.fn(),
  signP2PKSecret: jest.fn(),
}));

jest.mock('../../cashuBalanceService', () => ({
  getOrFetchKeys: jest.fn(),
}));

jest.mock('../../cashuProofManager', () => ({
  addProofs: jest.fn(),
}));

import { receiveP2PKToken } from '../cashuReceiveP2PK';
import { MINT_URL, swapTokens } from '../../cashuMintClient';
import { createBlindedOutputs, unblindSignatures, splitAmount, decodeToken } from '../../crypto';
import { isP2PKSecret, signP2PKSecret } from '../../p2pk';
import { getOrFetchKeys } from '../../cashuBalanceService';
import { addProofs } from '../../cashuProofManager';

describe('cashuReceiveP2PK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('receiveP2PKToken', () => {
    const mockP2PKProofs = [
      { amount: 64, secret: '["P2PK",{"data":"pubkey123"}]', C: 'C1' },
      { amount: 32, secret: '["P2PK",{"data":"pubkey123"}]', C: 'C2' },
    ];

    const mockToken = {
      mint: 'https://mint.test.com',
      proofs: mockP2PKProofs,
      amount: 96,
    };

    it('should receive P2PK token successfully', async () => {
      decodeToken.mockReturnValue(mockToken);
      isP2PKSecret.mockReturnValue(true);
      signP2PKSecret.mockResolvedValue('{"signatures":["sig1"]}');
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      splitAmount.mockReturnValue([64, 32]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64, secret: 's1' },
        { amount: 32, secret: 's2' },
      ]);

      const result = await receiveP2PKToken('cashuAtoken...', 'privatekey123'.padEnd(64, '0'));

      expect(result.amount).toBe(96);
      expect(result.proofCount).toBe(2);
      expect(addProofs).toHaveBeenCalled();
    });

    it('should throw error for invalid token format (line 46)', async () => {
      decodeToken.mockReturnValue(null);

      await expect(receiveP2PKToken('invalid', 'privatekey')).rejects.toThrow('Invalid token format');
    });

    it('should throw error for invalid token with missing proofs', async () => {
      decodeToken.mockReturnValue({ mint: 'https://mint.test.com' });

      await expect(receiveP2PKToken('invalid', 'privatekey')).rejects.toThrow('Invalid token format');
    });

    it('should throw error for token from different mint (line 53)', async () => {
      decodeToken.mockReturnValue({
        mint: 'https://different.mint.com',
        proofs: mockP2PKProofs,
        amount: 96,
      });

      await expect(receiveP2PKToken('cashuAtoken...', 'privatekey')).rejects.toThrow(
        'Token from different mint: https://different.mint.com'
      );
    });

    it('should throw error if no P2PK proofs found', async () => {
      decodeToken.mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: [{ amount: 64, secret: 'regular_secret', C: 'C1' }],
        amount: 64,
      });
      isP2PKSecret.mockReturnValue(false);

      await expect(receiveP2PKToken('cashuAtoken...', 'privatekey')).rejects.toThrow(
        'Token does not contain P2PK locked proofs'
      );
    });

    it('should handle non-P2PK proofs in mixed token (line 79)', async () => {
      const mixedProofs = [
        { amount: 64, secret: '["P2PK",{"data":"pubkey123"}]', C: 'C1' },
        { amount: 32, secret: 'regular_secret', C: 'C2' },
      ];
      decodeToken.mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: mixedProofs,
        amount: 96,
      });
      isP2PKSecret.mockImplementation(secret => secret.startsWith('["P2PK"'));
      signP2PKSecret.mockResolvedValue('{"signatures":["sig1"]}');
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      splitAmount.mockReturnValue([64, 32]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{}, {}],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64 },
        { amount: 32 },
      ]);

      const result = await receiveP2PKToken('cashuAtoken...', 'privatekey123'.padEnd(64, '0'));

      expect(result.amount).toBe(96);
    });

    it('should handle legacy keys format (line 91)', async () => {
      decodeToken.mockReturnValue(mockToken);
      isP2PKSecret.mockReturnValue(true);
      signP2PKSecret.mockResolvedValue('{"signatures":["sig1"]}');
      // Legacy format
      getOrFetchKeys.mockResolvedValue({
        keys: { 1: 'key1', 2: 'key2' },
      });
      splitAmount.mockReturnValue([64, 32]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{}, {}],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64 },
        { amount: 32 },
      ]);

      const result = await receiveP2PKToken('cashuAtoken...', 'privatekey123'.padEnd(64, '0'));

      expect(result.amount).toBe(96);
    });

    it('should add diagnostics for missing private key (line 138)', async () => {
      decodeToken.mockReturnValue(mockToken);
      isP2PKSecret.mockReturnValue(true);
      signP2PKSecret.mockRejectedValue(new Error('P2PK verification failed'));

      await expect(receiveP2PKToken('cashuAtoken...', null)).rejects.toThrow();
    });

    it('should add diagnostics for wrong private key type (line 140)', async () => {
      decodeToken.mockReturnValue(mockToken);
      isP2PKSecret.mockReturnValue(true);
      signP2PKSecret.mockRejectedValue(new Error('P2PK verification failed'));

      await expect(receiveP2PKToken('cashuAtoken...', 12345)).rejects.toThrow();
    });

    it('should add diagnostics for wrong private key length', async () => {
      decodeToken.mockReturnValue(mockToken);
      isP2PKSecret.mockReturnValue(true);
      signP2PKSecret.mockRejectedValue(new Error('P2PK verification failed'));

      await expect(receiveP2PKToken('cashuAtoken...', 'short')).rejects.toThrow();
    });

    it('should call onProgress callback', async () => {
      decodeToken.mockReturnValue(mockToken);
      isP2PKSecret.mockReturnValue(true);
      signP2PKSecret.mockResolvedValue('{"signatures":["sig1"]}');
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      splitAmount.mockReturnValue([64, 32]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{}, {}],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64 },
        { amount: 32 },
      ]);

      const onProgress = jest.fn();
      await receiveP2PKToken('cashuAtoken...', 'privatekey123'.padEnd(64, '0'), onProgress);

      expect(onProgress).toHaveBeenCalled();
    });
  });
});
