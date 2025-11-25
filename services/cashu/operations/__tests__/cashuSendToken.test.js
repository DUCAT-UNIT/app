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
      { amount: 64, secret: 's1', C: 'C1' },
      { amount: 32, secret: 's2', C: 'C2' },
    ];

    beforeEach(() => {
      loadProofs.mockResolvedValue(mockProofs);
      selectProofsForAmount.mockReturnValue(mockProofs);
      sumProofs.mockReturnValue(96);
      encodeToken.mockReturnValue('cashuAtoken...');
      getBalance.mockResolvedValue(0);
    });

    it('should send token without change (exact amount)', async () => {
      sumProofs.mockReturnValue(64);
      selectProofsForAmount.mockReturnValue([mockProofs[0]]);

      const result = await sendToken(64, false);

      expect(result.token).toBe('cashuAtoken...');
      expect(removeProofs).toHaveBeenCalled();
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should send token with change using keyset format', async () => {
      sumProofs.mockReturnValue(96);
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      splitAmount.mockReturnValue([64]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64, secret: 'new1' },
        { amount: 32, secret: 'new2' },
      ]);

      const result = await sendToken(64, true);

      expect(result.token).toBe('cashuAtoken...');
      expect(addProofs).toHaveBeenCalled();
    });

    it('should handle legacy keys format (line 57)', async () => {
      sumProofs.mockReturnValue(96);
      // Legacy format - only keys property, no keysets array
      getOrFetchKeys.mockResolvedValue({
        keys: { 1: 'key1', 2: 'key2' },
      });
      splitAmount.mockReturnValue([64]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{}, {}],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64, secret: 'new1' },
        { amount: 32, secret: 'new2' },
      ]);

      const result = await sendToken(64, true);

      expect(result.token).toBe('cashuAtoken...');
      // Should have used keys from legacy format
      expect(unblindSignatures).toHaveBeenCalled();
    });

    it('should handle raw keys object format', async () => {
      sumProofs.mockReturnValue(96);
      // Raw keys object - no wrapper
      getOrFetchKeys.mockResolvedValue({ 1: 'key1', 2: 'key2' });
      splitAmount.mockReturnValue([64]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{}, {}],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64, secret: 'new1' },
        { amount: 32, secret: 'new2' },
      ]);

      const result = await sendToken(64, true);

      expect(result.token).toBe('cashuAtoken...');
    });

    it('should not create change when returnChange is false', async () => {
      sumProofs.mockReturnValue(96);

      const result = await sendToken(64, false);

      expect(getOrFetchKeys).not.toHaveBeenCalled();
      expect(swapTokens).not.toHaveBeenCalled();
    });

    it('should not create change when exact amount selected', async () => {
      sumProofs.mockReturnValue(64);

      const result = await sendToken(64, true);

      // No swap needed when exact amount
      expect(swapTokens).not.toHaveBeenCalled();
    });

    it('should throw error on swap failure', async () => {
      sumProofs.mockReturnValue(96);
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      splitAmount.mockReturnValue([64]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [],
        blindingData: [],
      });
      swapTokens.mockRejectedValue(new Error('Swap failed'));

      await expect(sendToken(64, true)).rejects.toThrow('Swap failed');
    });

    it('should use keyset ID from signature response when available', async () => {
      sumProofs.mockReturnValue(96);
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      splitAmount.mockReturnValue([64]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{ id: 'response_keyset' }, {}],
      });
      unblindSignatures.mockReturnValue([
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
  });
});
