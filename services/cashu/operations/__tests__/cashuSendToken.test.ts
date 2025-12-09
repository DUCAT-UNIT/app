// @ts-nocheck
/**
 * Tests for cashuSendToken
 */

jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
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
  sumProofs: jest.fn(),
  selectProofsForAmount: jest.fn(),
  encodeToken: jest.fn(),
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

import { sendToken } from '../cashuSendToken';
import { MINT_URL, swapTokens } from '../../cashuMintClient';
import { createBlindedOutputs, unblindSignatures, splitAmount, sumProofs, selectProofsForAmount, encodeToken } from '../../crypto';
import { getOrFetchKeys, getBalance } from '../../cashuBalanceService';
import { loadProofs, removeProofs, addProofs } from '../../cashuProofManager';

describe('cashuSendToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendToken', () => {
    const mockProofs = [
      { amount: 64, secret: 's1', C: 'C1', id: 'id' },
      { amount: 32, secret: 's2', C: 'C2', id: 'id' },
    ];

    beforeEach(() => {
      (loadProofs as jest.Mock).mockResolvedValue(mockProofs);
      (selectProofsForAmount as jest.Mock).mockReturnValue(mockProofs);
      (sumProofs as jest.Mock).mockReturnValue(96);
      (encodeToken as jest.Mock).mockReturnValue('cashuAtoken...');
      (getBalance as jest.Mock).mockResolvedValue(0);
    });

    it('should send token without change (exact amount)', async () => {
      (sumProofs as jest.Mock).mockReturnValue(64);
      (selectProofsForAmount as jest.Mock).mockReturnValue([mockProofs[0 as any]]);

      const result = await sendToken(64, false);

      expect(result.token).toBe('cashuAtoken...');
      expect(removeProofs).toHaveBeenCalled();
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should send token with change using keyset format', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'id' },
        { amount: 32, secret: 'new2', C: 'C', id: 'id' },
      ]);

      const result = await sendToken(64, true);

      expect(result.token).toBe('cashuAtoken...');
      expect(addProofs).toHaveBeenCalled();
    });

    it('should handle legacy keys format (line 57)', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      // Legacy format - only keys property, no keysets array
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keys: { 1: 'key1', 2: 'key2' },
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{}, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'id' },
        { amount: 32, secret: 'new2', C: 'C', id: 'id' },
      ]);

      const result = await sendToken(64, true);

      expect(result.token).toBe('cashuAtoken...');
      // Should have used keys from legacy format
      expect(unblindSignatures).toHaveBeenCalled();
    });

    it('should throw error when no keys available', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      // Empty object - no keys, no keysets
      (getOrFetchKeys as jest.Mock).mockResolvedValue({});

      await expect(sendToken(64, true)).rejects.toThrow('No keys available from mint');
    });

    it('should not create change when returnChange is false', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);

      const result = await sendToken(64, false);

      expect(getOrFetchKeys).not.toHaveBeenCalled();
      expect(swapTokens).not.toHaveBeenCalled();
    });

    it('should not create change when exact amount selected', async () => {
      (sumProofs as jest.Mock).mockReturnValue(64);

      const result = await sendToken(64, true);

      // No swap needed when exact amount
      expect(swapTokens).not.toHaveBeenCalled();
    });

    it('should throw error on swap failure', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [],
        blindingData: [],
      });
      (swapTokens as jest.Mock).mockRejectedValue(new Error('Swap failed'));

      await expect(sendToken(64, true)).rejects.toThrow('Swap failed');
    });

    it('should use keyset ID from signature response when available', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'response_keyset' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64 },
        { amount: 32 },
      ]);

      await sendToken(64, true);

      expect(unblindSignatures).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        'response_keyset'
      );
    });

    it('should save change proofs when removeProofs fails after swap', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'id' },
        { amount: 32, secret: 'new2', C: 'C', id: 'id' },
      ]);

      // Make removeProofs fail, but addProofs should still be called in inner catch
      (removeProofs as jest.Mock).mockRejectedValue(new Error('removeProofs failed'));
      (addProofs as jest.Mock).mockResolvedValue(undefined);

      await expect(sendToken(64, true)).rejects.toThrow('removeProofs failed');

      // Should have attempted to save change proofs in inner catch block (line 123)
      expect(addProofs).toHaveBeenCalledTimes(1);
      expect(addProofs).toHaveBeenCalledWith([{ amount: 32, secret: 'new2', C: 'C', id: 'id' }]);
    });

    it('should throw critical error when both removeProofs and addProofs fail after swap', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'id' },
        { amount: 32, secret: 'new2', C: 'C', id: 'id' },
      ]);

      // Both removeProofs and addProofs fail - critical scenario
      (removeProofs as jest.Mock).mockRejectedValueOnce(new Error('removeProofs failed'));
      (addProofs as jest.Mock).mockRejectedValueOnce(new Error('addProofs critical failure'));

      await expect(sendToken(64, true)).rejects.toThrow('addProofs critical failure');

      // Should have attempted both operations
      expect(removeProofs).toHaveBeenCalled();
      expect(addProofs).toHaveBeenCalled();
    });

    it('should save change proofs in catch block when encodeToken fails after swap', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'id' },
        { amount: 32, secret: 'new2', C: 'C', id: 'id' },
      ]);

      // Proof operations succeed, but encodeToken fails
      (removeProofs as jest.Mock).mockResolvedValue(undefined);
      (addProofs as jest.Mock).mockResolvedValue(undefined);
      (encodeToken as jest.Mock).mockImplementation(() => {
        throw new Error('encodeToken failed');
      });

      await expect(sendToken(64, true)).rejects.toThrow('encodeToken failed');

      // Should have attempted to save change proofs in outer catch block
      expect(removeProofs).toHaveBeenCalledTimes(2); // Once in try, once in catch
      expect(addProofs).toHaveBeenCalledTimes(2); // Once in try, once in catch
    });

    it('should handle failure to save change proofs in outer catch block', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'id' },
        { amount: 32, secret: 'new2', C: 'C', id: 'id' },
      ]);

      // Successful first time, but encodeToken fails
      (removeProofs as jest.Mock).mockResolvedValueOnce(undefined);
      (addProofs as jest.Mock).mockResolvedValueOnce(undefined);
      (encodeToken as jest.Mock).mockImplementation(() => {
        throw new Error('encodeToken failed');
      });

      // In outer catch, second removeProofs fails
      (removeProofs as jest.Mock).mockRejectedValueOnce(new Error('second removeProofs failed'));

      await expect(sendToken(64, true)).rejects.toThrow('encodeToken failed');

      // Should still throw the original error even if recovery fails
      expect(removeProofs).toHaveBeenCalledTimes(2);
    });

    it('should not attempt to save change when swap never happened', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });

      // Swap itself fails before completing
      (swapTokens as jest.Mock).mockRejectedValue(new Error('Swap network error'));

      await expect(sendToken(64, true)).rejects.toThrow('Swap network error');

      // Should NOT attempt to save change proofs since swap never completed
      expect(removeProofs).not.toHaveBeenCalled();
      expect(addProofs).not.toHaveBeenCalled();
    });
  });
});
