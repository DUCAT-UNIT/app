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
    removeProofs.mockResolvedValue(undefined);
    addProofs.mockResolvedValue(undefined);
  });

  describe('requestMelt', () => {
    it('should request a melt quote successfully', async () => {
      createMeltQuote.mockResolvedValue({
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
      createMeltQuote.mockRejectedValue(new Error('Network error'));

      await expect(requestMelt('tb1paddr...', 100)).rejects.toThrow('Network error');
    });
  });

  describe('completeMelt', () => {
    const mockProofs = [
      { amount: 64, secret: 's1', C: 'C1', id: 'keyset1' },
      { amount: 32, secret: 's2', C: 'C2', id: 'keyset1' },
    ];

    beforeEach(() => {
      loadProofs.mockResolvedValue(mockProofs);
      selectProofsForAmount.mockReturnValue(mockProofs);
      sumProofs.mockReturnValue(96);
      getBalance.mockResolvedValue(0);
    });

    it('should complete melt without change', async () => {
      sumProofs.mockReturnValue(100); // Exact amount, no change needed
      meltTokens.mockResolvedValue({
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
      sumProofs.mockReturnValue(150);
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      splitAmount.mockReturnValue([64, 32, 4]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }, { amount: 4 }],
        blindingData: [{}, {}, {}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}, {}],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64, secret: 'new1' },
        { amount: 32, secret: 'new2' },
        { amount: 4, secret: 'new3' },
      ]);
      meltTokens.mockResolvedValue({
        paid: true,
        payment_preimage: 'txid123',
      });

      const result = await completeMelt('quote123', 100);

      expect(result.paid).toBe(true);
      expect(addProofs).toHaveBeenCalled();
    });

    it('should handle legacy key format (line 90)', async () => {
      sumProofs.mockReturnValue(150);
      // Legacy format without keysets array
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
      meltTokens.mockResolvedValue({
        paid: true,
        payment_preimage: 'txid123',
      });

      const result = await completeMelt('quote123', 100);

      expect(result.paid).toBe(true);
    });

    it('should save change proofs when melt fails after swap (lines 156-170)', async () => {
      sumProofs.mockReturnValue(150);
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      splitAmount.mockReturnValue([64, 32, 4]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }, { amount: 4 }],
        blindingData: [{}, {}, {}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}, {}],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64 },
        { amount: 32 },
        { amount: 4 },
      ]);
      // Melt fails after swap
      meltTokens.mockRejectedValue(new Error('Melt failed'));

      await expect(completeMelt('quote123', 100)).rejects.toThrow('Melt failed');

      // Verify change proofs were saved
      expect(removeProofs).toHaveBeenCalled();
      expect(addProofs).toHaveBeenCalled();
    });

    it('should handle error saving change proofs after melt failure (lines 164-170)', async () => {
      sumProofs.mockReturnValue(150);
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
      meltTokens.mockRejectedValue(new Error('Melt failed'));
      removeProofs.mockRejectedValue(new Error('Storage error'));

      await expect(completeMelt('quote123', 100)).rejects.toThrow('Melt failed');
    });
  });

  describe('completeMeltWithoutCleanup', () => {
    const mockProofs = [
      { amount: 64, secret: 's1' },
      { amount: 32, secret: 's2' },
    ];

    beforeEach(() => {
      loadProofs.mockResolvedValue(mockProofs);
      selectProofsForAmount.mockReturnValue(mockProofs);
    });

    it('should complete melt and return proofs to remove', async () => {
      sumProofs.mockReturnValue(100);
      meltTokens.mockResolvedValue({
        paid: true,
        payment_preimage: 'txid123',
        fee_paid: 2,
      });

      const result = await completeMeltWithoutCleanup('quote123', 100);

      expect(result.paid).toBe(true);
      expect(result.proofsToRemove).toEqual(mockProofs);
      expect(result.changeProofs).toBeNull();
    });

    it('should handle legacy key format (line 210)', async () => {
      sumProofs.mockReturnValue(150);
      getOrFetchKeys.mockResolvedValue({
        keys: { 1: 'key1' }, // Legacy format
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
      meltTokens.mockResolvedValue({
        paid: true,
        payment_preimage: 'txid123',
      });

      const result = await completeMeltWithoutCleanup('quote123', 100);

      expect(result.paid).toBe(true);
    });

    it('should save change proofs on melt failure after swap (lines 255-271)', async () => {
      sumProofs.mockReturnValue(150);
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
      meltTokens.mockRejectedValue(new Error('Melt failed'));

      await expect(completeMeltWithoutCleanup('quote123', 100)).rejects.toThrow('Melt failed');

      expect(removeProofs).toHaveBeenCalled();
      expect(addProofs).toHaveBeenCalled();
    });

    it('should handle error saving change proofs (lines 264-268)', async () => {
      sumProofs.mockReturnValue(150);
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
      meltTokens.mockRejectedValue(new Error('Melt failed'));
      removeProofs.mockRejectedValue(new Error('Storage error'));

      await expect(completeMeltWithoutCleanup('quote123', 100)).rejects.toThrow('Melt failed');
    });
  });

  describe('cleanupMeltProofs', () => {
    it('should cleanup proofs with change', async () => {
      const proofsToRemove = [{ amount: 64 }];
      const changeProofs = [{ amount: 32 }];

      await cleanupMeltProofs(proofsToRemove, changeProofs);

      expect(removeProofs).toHaveBeenCalledWith(proofsToRemove);
      expect(addProofs).toHaveBeenCalledWith(changeProofs);
    });

    it('should cleanup proofs without change', async () => {
      const proofsToRemove = [{ amount: 64 }];

      await cleanupMeltProofs(proofsToRemove, null);

      expect(removeProofs).toHaveBeenCalledWith(proofsToRemove);
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should throw error on cleanup failure (lines 294-295)', async () => {
      removeProofs.mockRejectedValue(new Error('Cleanup failed'));

      await expect(cleanupMeltProofs([{ amount: 64 }], null)).rejects.toThrow('Cleanup failed');
    });
  });
});
