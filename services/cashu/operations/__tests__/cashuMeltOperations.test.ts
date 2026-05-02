/**
 * Tests for cashuMeltOperations
 */

interface MockProof {
  amount: number;
  secret: string;
  C: string;
  id: string;
}

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
}));

jest.mock('../../crypto', () => ({
  createBlindedOutputs: jest.fn(),
  unblindSignatures: jest.fn(),
  splitAmount: jest.fn(),
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

import {
  requestMelt,
  completeMelt,
  completeMeltWithoutCleanup,
  cleanupMeltProofs,
} from '../cashuMeltOperations';
import { createMeltQuote, meltTokens } from '../../cashuMintClient';
import {
  createBlindedOutputs,
  unblindSignatures,
  splitAmount,
  selectProofsForAmount,
} from '../../crypto';
import { getOrFetchKeys, getBalance } from '../../cashuBalanceService';
import { loadProofs, removeProofs, addProofs } from '../../cashuProofManager';

describe('cashuMeltOperations', () => {
  const unitKeyData = {
    keysets: [{
      id: 'keyset1',
      unit: 'unit',
      active: true,
      input_fee_ppk: 0,
      keys: {
        1: 'key1',
        2: 'key2',
        4: 'key4',
        8: 'key8',
        16: 'key16',
        32: 'key32',
        64: 'key64',
      },
    }],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (getOrFetchKeys as jest.Mock).mockResolvedValue(unitKeyData);
    (getBalance as jest.Mock).mockResolvedValue(0);
    (removeProofs as jest.Mock).mockResolvedValue(undefined);
    (addProofs as jest.Mock).mockResolvedValue(undefined);
    (meltTokens as jest.Mock).mockResolvedValue({
      paid: true,
      payment_preimage: 'txid123',
      fee_paid: 2,
    });
  });

  describe('requestMelt', () => {
    it('should request a melt quote successfully', async () => {
      (createMeltQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        amount: 100,
        fee: 5,
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
    const exactProof: MockProof = { amount: 100, secret: 's1', C: 'C1', id: 'keyset1' };
    const changeProofs: MockProof[] = [
      { amount: 64, secret: 's1', C: 'C1', id: 'keyset1' },
      { amount: 32, secret: 's2', C: 'C2', id: 'keyset1' },
      { amount: 16, secret: 's3', C: 'C3', id: 'keyset1' },
    ];

    it('should submit exact proofs without change outputs', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([exactProof]);
      (selectProofsForAmount as jest.Mock).mockReturnValue([exactProof]);

      const result = await completeMelt('quote123', 100);

      expect(result).toEqual({
        paid: true,
        txid: 'txid123',
        fee: 2,
        balance: 0,
      });
      expect(meltTokens).toHaveBeenCalledWith('quote123', [exactProof], []);
      expect(removeProofs).toHaveBeenCalledWith([exactProof]);
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should provide melt change outputs and save returned change proofs', async () => {
      (loadProofs as jest.Mock).mockResolvedValue(changeProofs);
      (selectProofsForAmount as jest.Mock).mockReturnValue(changeProofs);
      (splitAmount as jest.Mock).mockReturnValue([8, 4]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 8, B_: 'B8', id: 'keyset1' }, { amount: 4, B_: 'B4', id: 'keyset1' }],
        blindingData: [{ amount: 8 }, { amount: 4 }],
      });
      (meltTokens as jest.Mock).mockResolvedValue({
        paid: true,
        payment_preimage: 'txid123',
        fee_paid: 2,
        change: [{ id: 'keyset1', C_: 'C8' }, { id: 'keyset1', C_: 'C4' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 8, secret: 'new1', C: 'C8', id: 'keyset1' },
        { amount: 4, secret: 'new2', C: 'C4', id: 'keyset1' },
      ]);

      const result = await completeMelt('quote123', 100);

      expect(result.paid).toBe(true);
      expect(splitAmount).toHaveBeenCalledWith(12);
      expect(meltTokens).toHaveBeenCalledWith(
        'quote123',
        changeProofs,
        [{ amount: 8, B_: 'B8', id: 'keyset1' }, { amount: 4, B_: 'B4', id: 'keyset1' }]
      );
      expect(removeProofs).toHaveBeenCalledWith(changeProofs);
      expect(addProofs).toHaveBeenCalledWith([
        { amount: 8, secret: 'new1', C: 'C8', id: 'keyset1' },
        { amount: 4, secret: 'new2', C: 'C4', id: 'keyset1' },
      ]);
    });

    it('should subtract input_fee_ppk when calculating change outputs', async () => {
      const proof100 = { amount: 100, secret: 's1', C: 'C1', id: 'keyset1' };
      const proof2 = { amount: 2, secret: 's2', C: 'C2', id: 'keyset1' };
      const feeKeyData = {
        keysets: [{ ...unitKeyData.keysets[0], input_fee_ppk: 500 }],
      };
      (getOrFetchKeys as jest.Mock).mockResolvedValue(feeKeyData);
      (loadProofs as jest.Mock).mockResolvedValue([proof100, proof2]);
      (selectProofsForAmount as jest.Mock)
        .mockReturnValueOnce([proof100])
        .mockReturnValueOnce([proof100, proof2]);
      (splitAmount as jest.Mock).mockReturnValue([1]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 1, B_: 'B1', id: 'keyset1' }],
        blindingData: [{ amount: 1 }],
      });
      (meltTokens as jest.Mock).mockResolvedValue({
        paid: true,
        payment_preimage: 'txid123',
        change: [{ id: 'keyset1', C_: 'C1' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 1, secret: 'new1', C: 'C1', id: 'keyset1' },
      ]);

      await completeMelt('quote123', 100);

      expect(selectProofsForAmount).toHaveBeenNthCalledWith(1, [proof100, proof2], 100);
      expect(selectProofsForAmount).toHaveBeenNthCalledWith(2, [proof100, proof2], 101);
      expect(splitAmount).toHaveBeenCalledWith(1);
      expect(meltTokens).toHaveBeenCalledWith(
        'quote123',
        [proof100, proof2],
        [{ amount: 1, B_: 'B1', id: 'keyset1' }]
      );
    });

    it('should reject change when no active unit keyset is available', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'btc', active: true, keys: { 1: 'key1' } }],
      });
      (loadProofs as jest.Mock).mockResolvedValue(changeProofs);
      (selectProofsForAmount as jest.Mock).mockReturnValue(changeProofs);

      await expect(completeMelt('quote123', 100)).rejects.toThrow('No active unit keyset available from mint');
    });
  });

  describe('completeMeltWithoutCleanup', () => {
    it('should complete melt and return proofs to remove', async () => {
      const exactProof: MockProof = { amount: 100, secret: 's1', C: 'C1', id: 'keyset1' };
      (loadProofs as jest.Mock).mockResolvedValue([exactProof]);
      (selectProofsForAmount as jest.Mock).mockReturnValue([exactProof]);

      const result = await completeMeltWithoutCleanup('quote123', 100);

      expect(result.paid).toBe(true);
      expect(result.proofsToRemove).toEqual([exactProof]);
      expect(result.changeProofs).toBeNull();
      expect(removeProofs).not.toHaveBeenCalled();
      expect(addProofs).not.toHaveBeenCalled();
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
      const proofsToRemove: MockProof[] = [{ amount: 64, secret: 's1', C: 'C1', id: 'id1' }];

      await cleanupMeltProofs(proofsToRemove, null);

      expect(removeProofs).toHaveBeenCalledWith(proofsToRemove);
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should throw error on cleanup failure', async () => {
      (removeProofs as jest.Mock).mockRejectedValue(new Error('Cleanup failed'));

      const proofsToRemove: MockProof[] = [{ amount: 64, secret: 's1', C: 'C1', id: 'id1' }];
      await expect(cleanupMeltProofs(proofsToRemove, null)).rejects.toThrow('Cleanup failed');
    });
  });
});
