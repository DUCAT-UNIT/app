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

jest.mock('../../cashuMintQuoteRecovery', () => ({
  removeMintQuote: jest.fn(),
  saveMintQuote: jest.fn(),
  updateMintQuoteState: jest.fn(),
}));

jest.mock('../../cashuQuoteSigner', () => ({
  getMintQuoteSigningKey: jest.fn(),
  signMintQuoteOutputs: jest.fn(),
}));

import { requestMint, checkMintStatus, completeMint } from '../cashuMintOperations';
import { createMintQuote, checkMintQuote, mintTokens } from '../../cashuMintClient';
import { createBlindedOutputs, unblindSignatures, splitAmount } from '../../crypto';
import { getOrFetchKeys } from '../../cashuBalanceService';
import { addProofs } from '../../cashuProofManager';
import { getMintQuoteSigningKey, signMintQuoteOutputs } from '../../cashuQuoteSigner';

describe('cashuMintOperations', () => {
  const pubkey = '02' + 'a'.repeat(64);
  const privateKey = '1'.repeat(64);

  beforeEach(() => {
    jest.clearAllMocks();
    (getMintQuoteSigningKey as jest.Mock).mockResolvedValue({ pubkey, privateKey });
    (signMintQuoteOutputs as jest.Mock).mockReturnValue('quotesig');
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

      expect(createMintQuote).toHaveBeenCalledWith(pubkey);
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
        amountPaid: undefined,
        amountIssued: undefined,
        availableAmount: 0,
      });
    });

    it('should expose issued state without a mintable amount', async () => {
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'ISSUED',
      });

      const result = await checkMintStatus('quote123');

      expect(result.paid).toBe(true);
      expect(result.availableAmount).toBe(0);
    });

    it('should treat amount_paid minus amount_issued as mintable even without state', async () => {
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        amount_paid: 125,
        amount_issued: 25,
      });

      const result = await checkMintStatus('quote123');

      expect(result).toEqual({
        quoteId: 'quote123',
        state: 'PAID',
        paid: true,
        amountPaid: 125,
        amountIssued: 25,
        availableAmount: 100,
      });
    });

    it('should return unpaid status for UNPAID state', async () => {
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'UNPAID',
      });

      const result = await checkMintStatus('quote123');

      expect(result.paid).toBe(false);
      expect(result.availableAmount).toBe(0);
    });

    it('should throw error on failure', async () => {
      (checkMintQuote as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(checkMintStatus('quote123')).rejects.toThrow('Network error');
    });
  });

  describe('completeMint', () => {
    it('should complete mint with keyset format', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1', 2: 'key2', 4: 'key4', 32: 'key32', 64: 'key64' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 100,
        amount_issued: 0,
        pubkey,
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
      expect(signMintQuoteOutputs).toHaveBeenCalledWith(
        'quote123',
        [{ amount: 64 }, { amount: 32 }, { amount: 4 }],
        privateKey
      );
      expect(mintTokens).toHaveBeenCalledWith(
        'quote123',
        [{ amount: 64 }, { amount: 32 }, { amount: 4 }],
        'quotesig'
      );
      expect(addProofs).toHaveBeenCalled();
    });

    it('should mint only the paid amount that has not already been issued', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1', 2: 'key2', 8: 'key8' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 10,
        amount_issued: 2,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([8]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 8 }],
        blindingData: [{}],
      });
      (mintTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 8, secret: 's1', C: 'C', id: 'id' },
      ]);

      const result = await completeMint('quote123', 10);

      expect(result).toHaveLength(1);
      expect(splitAmount).toHaveBeenCalledWith(8);
    });

    it('should throw error if no active unit keyset is available', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({});
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 100,
        amount_issued: 0,
      });

      await expect(completeMint('quote123', 100)).rejects.toThrow('No active unit keyset available from mint');
    });

    it('should throw error on mint failure', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 64,
        amount_issued: 0,
        pubkey,
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
