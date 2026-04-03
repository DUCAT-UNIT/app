/**
 * Tests for cashuSendToken
 */

/**
 * Mock proof interface for testing
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
  MINT_URL: 'https://mint.test.com',
  swapTokens: jest.fn(),
  checkProofsSpent: jest.fn(async () => ({ states: [] })),
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
  getCurrentCashuAccount: jest.fn(() => null),
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
    const mockProofs: MockProof[] = [
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
      (selectProofsForAmount as jest.Mock).mockReturnValue([mockProofs[0]]);

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
      // splitAmount is called twice: once for send amounts, once for change
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64]) // send amount
        .mockReturnValueOnce([32]); // change amount
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [
          { secret: 'new1' }, // First is send (index 0 < sendAmounts.length=1)
          { secret: 'new2' }, // Second is change (index 1 >= sendAmounts.length=1)
        ],
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
      // Change proof (secret: new2) should be added back
      expect(addProofs).toHaveBeenCalledWith([{ amount: 32, secret: 'new2', C: 'C', id: 'id' }]);
    });

    it('should handle legacy keys format (line 57)', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      // Legacy format - only keys property, no keysets array
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keys: { 1: 'key1', 2: 'key2' },
      });
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64]) // send amount
        .mockReturnValueOnce([32]); // change amount
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [
          { secret: 'new1' },
          { secret: 'new2' },
        ],
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
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64])
        .mockReturnValueOnce([32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{ secret: 'new1' }, { secret: 'new2' }],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'response_keyset' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1' },
        { amount: 32, secret: 'new2' },
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
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64])
        .mockReturnValueOnce([32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{ secret: 'new1' }, { secret: 'new2' }],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'id' },
        { amount: 32, secret: 'new2', C: 'C', id: 'id' },
      ]);

      // addProofs is called 3x: try block, inner catch, outer catch
      (addProofs as jest.Mock)
        .mockResolvedValueOnce(undefined) // First call succeeds (try block line 138)
        .mockResolvedValueOnce(undefined) // Second call in inner catch block (line 156)
        .mockResolvedValueOnce(undefined); // Third call in outer catch block (line 197)
      (removeProofs as jest.Mock).mockRejectedValue(new Error('removeProofs failed'));

      await expect(sendToken(64, true)).rejects.toThrow('removeProofs failed');

      // addProofs is called 3 times: try block, inner catch block, outer catch block
      expect(addProofs).toHaveBeenCalledTimes(3);
      expect(addProofs).toHaveBeenCalledWith([{ amount: 32, secret: 'new2', C: 'C', id: 'id' }]);
    });

    it('should throw critical error when both removeProofs and addProofs fail after swap', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64])
        .mockReturnValueOnce([32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{ secret: 'new1' }, { secret: 'new2' }],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'id' },
        { amount: 32, secret: 'new2', C: 'C', id: 'id' },
      ]);

      // addProofs is called 3x: try block (succeeds), inner catch (succeeds), outer catch (fails)
      (addProofs as jest.Mock)
        .mockResolvedValueOnce(undefined) // First addProofs in try block
        .mockResolvedValueOnce(undefined) // Second addProofs in inner catch block
        .mockRejectedValueOnce(new Error('addProofs critical failure')); // Third addProofs in outer catch block
      (removeProofs as jest.Mock).mockRejectedValueOnce(new Error('removeProofs failed'));

      // Original error is thrown even when recovery fails (outer catch logs but doesn't re-throw)
      await expect(sendToken(64, true)).rejects.toThrow('removeProofs failed');

      // addProofs is called 3 times: try block, inner catch, outer catch (first 2 succeed, 3rd fails)
      expect(addProofs).toHaveBeenCalledTimes(3);
      expect(removeProofs).toHaveBeenCalled();
    });

    it('should save change proofs in catch block when encodeToken fails after swap', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64])
        .mockReturnValueOnce([32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{ secret: 'new1' }, { secret: 'new2' }],
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
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64])
        .mockReturnValueOnce([32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{ secret: 'new1' }, { secret: 'new2' }],
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
