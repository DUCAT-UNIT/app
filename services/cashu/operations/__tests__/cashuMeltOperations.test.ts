// @ts-nocheck
/**
 * Tests for cashuMeltOperations
 */

// Mock dependencies
jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../cashuMintClient', () => ({
  createMeltQuote: jest.fn(),
  meltTokens: jest.fn(),
  swapTokens: jest.fn(),
}));

jest.mock('../../crypto', () => ({
  createBlindedOutputs: jest.fn(),
  unblindSignatures: jest.fn(),
  splitAmount: jest.fn(),
  sumProofs: jest.fn(),
  selectProofsForAmount: jest.fn(),
}));

jest.mock('../../cashuBalanceService', () => ({
  getOrFetchKeys: jest.fn(),
  getBalance: jest.fn(),
}));

jest.mock('../../cashuProofManager', () => ({
  loadProofs: jest.fn(),
  removeProofs: jest.fn(),
  addProofs: jest.fn(),
}));

import { requestMelt, completeMelt, completeMeltWithoutCleanup, cleanupMeltProofs } from '../cashuMeltOperations';
import { createMeltQuote, meltTokens, swapTokens } from '../../cashuMintClient';
import { createBlindedOutputs, unblindSignatures, splitAmount, sumProofs, selectProofsForAmount } from '../../crypto';
import { getOrFetchKeys, getBalance } from '../../cashuBalanceService';
import { loadProofs, removeProofs, addProofs } from '../../cashuProofManager';

describe('cashuMeltOperations', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Set default resolved values for mocks
    (removeProofs as jest.Mock).mockResolvedValue(undefined);
    (addProofs as jest.Mock).mockResolvedValue(undefined);
  });

  describe('requestMelt', () => {
    it('should request a melt quote successfully', async () => {
      (createMeltQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        amount: 100,
        fee_reserve: 5,
      });

      const result = await requestMelt('tb1paddr...', 100);

      expect(result).toEqual({
        quoteId: 'quote123',
        amount: 100,
        fee: 5,
        total: 105,
      });
    });

    it('should throw error on failure', async () => {
      (createMeltQuote as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(requestMelt('tb1paddr...', 100)).rejects.toThrow('Network error');
    });
  });

  describe('completeMelt', () => {
    const mockProofs = [
      { amount: 64, secret: 's1', C: 'C1', id: 'keyset1' },
      { amount: 32, secret: 's2', C: 'C2', id: 'keyset1' },
    ];

    beforeEach(() => {
      (loadProofs as jest.Mock).mockResolvedValue(mockProofs);
      (selectProofsForAmount as jest.Mock).mockReturnValue(mockProofs);
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getBalance as jest.Mock).mockResolvedValue(0);
    });

    it('should complete melt without change', async () => {
      (sumProofs as jest.Mock).mockReturnValue(100); // Exact amount, no change needed
      (meltTokens as jest.Mock).mockResolvedValue({
        paid: true,
        payment_preimage: 'txid123',
        fee_paid: 2,
      });

      const result = await completeMelt('quote123', 100);

      expect(result.paid).toBe(true);
      expect(result.txid).toBe('txid123');
      expect(removeProofs).toHaveBeenCalledWith(mockProofs);
    });

    it('should complete melt with change using keyset format', async () => {
      (sumProofs as jest.Mock).mockReturnValue(150);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32, 4]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }, { amount: 4 }],
        blindingData: [{}, {}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'id' },
        { amount: 32, secret: 'new2', C: 'C', id: 'id' },
        { amount: 4, secret: 'new3', C: 'C', id: 'id' },
      ]);
      (meltTokens as jest.Mock).mockResolvedValue({
        paid: true,
        payment_preimage: 'txid123',
      });

      const result = await completeMelt('quote123', 100);

      expect(result.paid).toBe(true);
      expect(addProofs).toHaveBeenCalled();
    });

    it('should throw error for legacy key format without keyset ID (line 90)', async () => {
      (sumProofs as jest.Mock).mockReturnValue(150);
      // Legacy format without keysets array - now rejected for security
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keys: { 1: 'key1', 2: 'key2' },
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });

      // Should throw error because legacy format without keyset ID is rejected
      await expect(completeMelt('quote123', 100)).rejects.toThrow('No keyset ID available from mint');
    });

    it('should save change proofs when melt fails after swap (lines 156-170)', async () => {
      (sumProofs as jest.Mock).mockReturnValue(150);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32, 4]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }, { amount: 4 }],
        blindingData: [{}, {}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 's1', C: 'C1', id: 'id1' },
        { amount: 32, secret: 's2', C: 'C2', id: 'id2' },
        { amount: 4, secret: 's3', C: 'C3', id: 'id3' },
      ]);
      // Melt fails after swap
      (meltTokens as jest.Mock).mockRejectedValue(new Error('Melt failed'));

      await expect(completeMelt('quote123', 100)).rejects.toThrow('Melt failed');

      // Verify change proofs were saved
      expect(removeProofs).toHaveBeenCalled();
      expect(addProofs).toHaveBeenCalled();
    });

    it('should handle error saving change proofs after melt failure (lines 164-170)', async () => {
      (sumProofs as jest.Mock).mockReturnValue(150);
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
      (meltTokens as jest.Mock).mockRejectedValue(new Error('Melt failed'));
      (removeProofs as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(completeMelt('quote123', 100)).rejects.toThrow('Melt failed');
    });
  });

  describe('completeMeltWithoutCleanup', () => {
    const mockProofs = [
      { amount: 64, secret: 's1', C: 'C', id: 'id' },
      { amount: 32, secret: 's2', C: 'C', id: 'id' },
    ];

    beforeEach(() => {
      (loadProofs as jest.Mock).mockResolvedValue(mockProofs);
      (selectProofsForAmount as jest.Mock).mockReturnValue(mockProofs);
    });

    it('should complete melt and return proofs to remove', async () => {
      (sumProofs as jest.Mock).mockReturnValue(100);
      (meltTokens as jest.Mock).mockResolvedValue({
        paid: true,
        payment_preimage: 'txid123',
        fee_paid: 2,
      });

      const result = await completeMeltWithoutCleanup('quote123', 100);

      expect(result.paid).toBe(true);
      expect(result.proofsToRemove).toEqual(mockProofs);
      expect(result.changeProofs).toBeNull();
    });

    it('should throw error for legacy key format without keyset ID (line 210)', async () => {
      (sumProofs as jest.Mock).mockReturnValue(150);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keys: { 1: 'key1' }, // Legacy format - now rejected for security
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });

      // Should throw error because legacy format without keyset ID is rejected
      await expect(completeMeltWithoutCleanup('quote123', 100)).rejects.toThrow('No keyset ID available from mint');
    });

    it('should save change proofs on melt failure after swap (lines 255-271)', async () => {
      (sumProofs as jest.Mock).mockReturnValue(150);
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
      (meltTokens as jest.Mock).mockRejectedValue(new Error('Melt failed'));

      await expect(completeMeltWithoutCleanup('quote123', 100)).rejects.toThrow('Melt failed');

      expect(removeProofs).toHaveBeenCalled();
      expect(addProofs).toHaveBeenCalled();
    });

    it('should handle error saving change proofs (lines 264-268)', async () => {
      (sumProofs as jest.Mock).mockReturnValue(150);
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
      (meltTokens as jest.Mock).mockRejectedValue(new Error('Melt failed'));
      (removeProofs as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(completeMeltWithoutCleanup('quote123', 100)).rejects.toThrow('Melt failed');
    });
  });

  describe('cleanupMeltProofs', () => {
    it('should cleanup proofs with change', async () => {
      const proofsToRemove = [{ amount: 64, secret: 's1', C: 'C1', id: 'id1' }];
      const changeProofs = [{ amount: 32, secret: 's2', C: 'C2', id: 'id2' }];

      await cleanupMeltProofs(proofsToRemove, changeProofs);

      expect(removeProofs).toHaveBeenCalledWith(proofsToRemove);
      expect(addProofs).toHaveBeenCalledWith(changeProofs);
    });

    it('should cleanup proofs without change', async () => {
      const proofsToRemove = [{ amount: 64, secret: 's1', C: 'C1', id: 'id1' }];

      await cleanupMeltProofs(proofsToRemove, '' as any);

      expect(removeProofs).toHaveBeenCalledWith(proofsToRemove);
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should throw error on cleanup failure (lines 294-295)', async () => {
      (removeProofs as jest.Mock).mockRejectedValue(new Error('Cleanup failed'));

      await expect(cleanupMeltProofs([{ amount: 64, secret: 's1', C: 'C1', id: 'id1' }], '' as any)).rejects.toThrow('Cleanup failed');
    });
  });
});
