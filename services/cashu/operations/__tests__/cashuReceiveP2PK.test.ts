/**
 * Tests for cashuReceiveP2PK
 */

jest.mock('../../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    transaction: jest.fn(),
    security: jest.fn(),
    screen: jest.fn(),
    action: jest.fn(),
    wallet: jest.fn(),
    cashu: jest.fn(),
    api: jest.fn(),
    auth: jest.fn(),
    perf: jest.fn(),
    turbo: jest.fn(),
    vault: jest.fn(),
    onboarding: jest.fn(),
    startTransaction: jest.fn().mockReturnValue({ finish: jest.fn() }),
    setContext: jest.fn(),
    setTag: jest.fn(),
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
      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (isP2PKSecret as jest.Mock).mockReturnValue(true);
      (signP2PKSecret as jest.Mock).mockResolvedValue('{"signatures":["sig1"]}');
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 's1', C: 'C', id: 'id' },
        { amount: 32, secret: 's2', C: 'C', id: 'id' },
      ]);

      const result = await receiveP2PKToken('cashuAtoken...', 'privatekey123'.padEnd(64, '0'));

      expect(result.amount).toBe(96);
      expect(result.proofCount).toBe(2);
      expect(addProofs).toHaveBeenCalled();
    });

    it('should throw error for invalid token format (line 46)', async () => {
      (decodeToken as jest.Mock).mockReturnValue(null);

      await expect(receiveP2PKToken('invalid', 'privatekey')).rejects.toThrow('Invalid token format');
    });

    it('should throw error for invalid token with missing proofs', async () => {
      (decodeToken as jest.Mock).mockReturnValue({ mint: 'https://mint.test.com' });

      await expect(receiveP2PKToken('invalid', 'privatekey')).rejects.toThrow('Invalid token format');
    });

    it('should throw error for token from different mint (line 53)', async () => {
      (decodeToken as jest.Mock).mockReturnValue({
        mint: 'https://different.mint.com',
        proofs: mockP2PKProofs,
        amount: 96,
      });

      await expect(receiveP2PKToken('cashuAtoken...', 'privatekey')).rejects.toThrow(
        'Token from different mint: https://different.mint.com'
      );
    });

    it('should throw error if no P2PK proofs found', async () => {
      (decodeToken as jest.Mock).mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: [{ amount: 64, secret: 'regular_secret', C: 'C1', id: 'id' }],
        amount: 64,
      });
      (isP2PKSecret as jest.Mock).mockReturnValue(false);

      await expect(receiveP2PKToken('cashuAtoken...', 'privatekey')).rejects.toThrow(
        'Token does not contain P2PK locked proofs'
      );
    });

    it('should handle non-P2PK proofs in mixed token (line 79)', async () => {
      const mixedProofs = [
        { amount: 64, secret: '["P2PK",{"data":"pubkey123"}]', C: 'C1' },
        { amount: 32, secret: 'regular_secret', C: 'C2', id: 'id' },
      ];
      (decodeToken as jest.Mock).mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: mixedProofs,
        amount: 96,
      });
      (isP2PKSecret as jest.Mock).mockImplementation((secret: string) => secret.startsWith('["P2PK"'));
      (signP2PKSecret as jest.Mock).mockResolvedValue('{"signatures":["sig1"]}');
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{}, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 's1', C: 'C1', id: 'id1' },
        { amount: 32, secret: 's2', C: 'C2', id: 'id2' },
      ]);

      const result = await receiveP2PKToken('cashuAtoken...', 'privatekey123'.padEnd(64, '0'));

      expect(result.amount).toBe(96);
    });

    it('should handle legacy keys format (line 91)', async () => {
      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (isP2PKSecret as jest.Mock).mockReturnValue(true);
      (signP2PKSecret as jest.Mock).mockResolvedValue('{"signatures":["sig1"]}');
      // Legacy format
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keys: { 1: 'key1', 2: 'key2' },
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{}, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 's1', C: 'C1', id: 'id1' },
        { amount: 32, secret: 's2', C: 'C2', id: 'id2' },
      ]);

      const result = await receiveP2PKToken('cashuAtoken...', 'privatekey123'.padEnd(64, '0'));

      expect(result.amount).toBe(96);
    });

    it('should add diagnostics for missing private key (line 138)', async () => {
      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (isP2PKSecret as jest.Mock).mockReturnValue(true);
      (signP2PKSecret as jest.Mock).mockRejectedValue(new Error('P2PK verification failed'));

      // Test with empty string - cast needed to test error handling
      await expect(receiveP2PKToken('cashuAtoken...', '')).rejects.toThrow();
    });

    it('should add diagnostics for wrong private key type (line 140)', async () => {
      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (isP2PKSecret as jest.Mock).mockReturnValue(true);
      (signP2PKSecret as jest.Mock).mockRejectedValue(new Error('P2PK verification failed'));

      // Test with wrong type - cast needed to test error handling for invalid input
      await expect(receiveP2PKToken('cashuAtoken...', String(12345))).rejects.toThrow();
    });

    it('should add diagnostics for wrong private key length', async () => {
      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (isP2PKSecret as jest.Mock).mockReturnValue(true);
      (signP2PKSecret as jest.Mock).mockRejectedValue(new Error('P2PK verification failed'));

      await expect(receiveP2PKToken('cashuAtoken...', 'short')).rejects.toThrow();
    });

    it('should call onProgress callback', async () => {
      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (isP2PKSecret as jest.Mock).mockReturnValue(true);
      (signP2PKSecret as jest.Mock).mockResolvedValue('{"signatures":["sig1"]}');
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{}, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 's1', C: 'C1', id: 'id1' },
        { amount: 32, secret: 's2', C: 'C2', id: 'id2' },
      ]);

      const onProgress = jest.fn();
      await receiveP2PKToken('cashuAtoken...', 'privatekey123'.padEnd(64, '0'), onProgress);

      expect(onProgress).toHaveBeenCalled();
    });
  });
});
