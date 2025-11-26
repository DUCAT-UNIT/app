/**
 * Tests for cashuMintOperations
 */

jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../cashuMintClient', () => ({
  createMintQuote: jest.fn(),
  checkMintQuote: jest.fn(),
  mintTokens: jest.fn(),
}));

jest.mock('../../crypto', () => ({
  createBlindedOutputs: jest.fn(),
  unblindSignatures: jest.fn(),
  splitAmount: jest.fn(),
}));

jest.mock('../../cashuBalanceService', () => ({
  getOrFetchKeys: jest.fn(),
}));

jest.mock('../../cashuProofManager', () => ({
  addProofs: jest.fn(),
}));

import { requestMint, checkMintStatus, completeMint } from '../cashuMintOperations';
import { createMintQuote, checkMintQuote, mintTokens } from '../../cashuMintClient';
import { createBlindedOutputs, unblindSignatures, splitAmount } from '../../crypto';
import { getOrFetchKeys } from '../../cashuBalanceService';
import { addProofs } from '../../cashuProofManager';

describe('cashuMintOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestMint', () => {
    it('should request a mint quote successfully', async () => {
      (createMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        amount: 100,
        request: 'tb1p...',
        expiry: 1234567890,
        state: 'UNPAID',
      });

      const result = await requestMint(100);

      expect(result).toEqual({
        quoteId: 'quote123',
        amount: 100,
        depositAddress: 'tb1p...',
        expiry: 1234567890,
        state: 'UNPAID',
      });
    });

    it('should throw error on failure', async () => {
      (createMintQuote as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(requestMint(100)).rejects.toThrow('Network error');
    });
  });

  describe('checkMintStatus', () => {
    it('should return paid status for PAID state', async () => {
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
      });

      const result = await checkMintStatus('quote123');

      expect(result).toEqual({
        quoteId: 'quote123',
        state: 'PAID',
        paid: true,
      });
    });

    it('should return paid status for ISSUED state', async () => {
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'ISSUED',
      });

      const result = await checkMintStatus('quote123');

      expect(result.paid).toBe(true);
    });

    it('should return unpaid status for UNPAID state', async () => {
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'UNPAID',
      });

      const result = await checkMintStatus('quote123');

      expect(result.paid).toBe(false);
    });

    it('should throw error on failure', async () => {
      (checkMintQuote as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(checkMintStatus('quote123')).rejects.toThrow('Network error');
    });
  });

  describe('completeMint', () => {
    it('should complete mint with keyset format', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1', 2: 'key2' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32, 4]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }, { amount: 4 }],
        blindingData: [{}, {}, {}],
      });
      (mintTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 's1', C: 'C', id: 'id' },
        { amount: 32, secret: 's2', C: 'C', id: 'id' },
        { amount: 4, secret: 's3', C: 'C', id: 'id' },
      ]);

      const result = await completeMint('quote123', 100);

      expect(result).toHaveLength(3);
      expect(addProofs).toHaveBeenCalled();
    });

    it('should complete mint with legacy keys format (line 98)', async () => {
      // Legacy format with only keys property
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keys: { 1: 'key1', 2: 'key2' },
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (mintTokens as jest.Mock).mockResolvedValue({
        signatures: [{}, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 's1', C: 'C', id: 'id' },
        { amount: 32, secret: 's2', C: 'C', id: 'id' },
      ]);

      const result = await completeMint('quote123', 96);

      expect(result).toHaveLength(2);
    });

    it('should throw error if no keysets available', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({});

      await expect(completeMint('quote123', 100)).rejects.toThrow('No keysets available from mint');
    });

    it('should throw error on mint failure', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }],
        blindingData: [{}],
      });
      (mintTokens as jest.Mock).mockRejectedValue(new Error('Mint failed'));

      await expect(completeMint('quote123', 64)).rejects.toThrow('Mint failed');
    });
  });
});
