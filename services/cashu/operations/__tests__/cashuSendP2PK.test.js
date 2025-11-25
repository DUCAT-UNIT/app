/**
 * Tests for cashuSendP2PK
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
  createBlindedMessage: jest.fn(),
  unblindSignatures: jest.fn(),
  splitAmount: jest.fn(),
  sumProofs: jest.fn(),
  selectProofsForAmount: jest.fn(),
  encodeToken: jest.fn(),
  generateSecret: jest.fn(),
}));

jest.mock('../../p2pk', () => ({
  createP2PKSecret: jest.fn(),
  isP2PKSecret: jest.fn(),
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

import { sendP2PKToken } from '../cashuSendP2PK';
import { MINT_URL, swapTokens } from '../../cashuMintClient';
import { createBlindedMessage, unblindSignatures, splitAmount, sumProofs, selectProofsForAmount, encodeToken, generateSecret } from '../../crypto';
import { createP2PKSecret, isP2PKSecret } from '../../p2pk';
import { getOrFetchKeys, getBalance } from '../../cashuBalanceService';
import { loadProofs, removeProofs, addProofs } from '../../cashuProofManager';

describe('cashuSendP2PK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendP2PKToken', () => {
    const mockProofs = [
      { amount: 64, secret: 'normal_secret1', C: 'C1' },
      { amount: 64, secret: 'normal_secret2', C: 'C2' },
    ];

    beforeEach(() => {
      loadProofs.mockResolvedValue(mockProofs);
      isP2PKSecret.mockReturnValue(false);
      selectProofsForAmount.mockReturnValue(mockProofs);
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      splitAmount.mockImplementation(amount => [amount]);
      createP2PKSecret.mockResolvedValue('[\"P2PK\",{\"data\":\"recipientpubkey\"}]');
      generateSecret.mockResolvedValue('change_secret');
      createBlindedMessage.mockResolvedValue({
        B_: 'blinded_point',
        r: 'blinding_factor',
      });
      swapTokens.mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"recipientpubkey\"}]' },
      ]);
      encodeToken.mockReturnValue('cashuAtoken...');
      getBalance.mockResolvedValue(64);
      sumProofs.mockReturnValue(64);
    });

    it('should send P2PK token successfully', async () => {
      const result = await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      expect(result.token).toBe('cashuAtoken...');
      expect(result.amount).toBe(64);
      expect(removeProofs).toHaveBeenCalled();
    });

    it('should handle legacy keys format (line 124)', async () => {
      getOrFetchKeys.mockResolvedValue({
        keys: { 1: 'key1', 2: 'key2' },
      });

      const result = await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      expect(result.token).toBe('cashuAtoken...');
    });

    it('should create change when selected amount exceeds requested (lines 143-149)', async () => {
      // Select more than needed
      selectProofsForAmount.mockReturnValue(mockProofs); // 128 total
      splitAmount
        .mockReturnValueOnce([64]) // send amounts
        .mockReturnValueOnce([64]); // change amounts

      unblindSignatures.mockReturnValue([
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"recipientpubkey\"}]' },
        { amount: 64, secret: 'change_secret' },
      ]);

      const result = await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      expect(generateSecret).toHaveBeenCalled();
      expect(addProofs).toHaveBeenCalled();
    });

    it('should throw error on amount mismatch (line 170)', async () => {
      // Mock splitAmount to return different totals causing mismatch
      splitAmount
        .mockReturnValueOnce([64]) // send amounts (correct)
        .mockReturnValueOnce([32]); // change amounts (wrong - should be 64)

      await expect(sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0')))
        .rejects.toThrow('Amount mismatch');
    });

    it('should call onProgress callback', async () => {
      const onProgress = jest.fn();

      await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'), {}, onProgress);

      expect(onProgress).toHaveBeenCalled();
    });

    it('should filter out P2PK locked proofs from available proofs', async () => {
      const mixedProofs = [
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"locked\"}]', C: 'C1' },
        { amount: 64, secret: 'normal_secret', C: 'C2' },
      ];
      loadProofs.mockResolvedValue(mixedProofs);
      isP2PKSecret.mockImplementation(secret => secret.startsWith('[\"P2PK\"'));
      selectProofsForAmount.mockReturnValue([mixedProofs[1]]); // Only unlocked

      await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      // Should filter to only unlocked proofs before selection
      expect(selectProofsForAmount).toHaveBeenCalledWith(
        [mixedProofs[1]],
        64
      );
    });

    it('should log change proof details when change is created (lines 234-235, 244-248)', async () => {
      const { logger } = require('../../../../utils/logger');

      // Ensure we get change
      selectProofsForAmount.mockReturnValue(mockProofs); // 128 total
      splitAmount
        .mockReturnValueOnce([64]) // send amounts
        .mockReturnValueOnce([64]); // change amounts

      unblindSignatures.mockReturnValue([
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"recipientpubkey\"}]' },
        { amount: 64, secret: 'change_secret' },
      ]);

      await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      // Check logger was called with change proof info
      expect(logger.info).toHaveBeenCalledWith(
        'Change proof secret types',
        expect.any(Object)
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Change proofs added back to wallet',
        expect.any(Object)
      );
    });

    it('should handle error during send', async () => {
      swapTokens.mockRejectedValue(new Error('Swap failed'));

      await expect(sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0')))
        .rejects.toThrow('Swap failed');
    });

    it('should pass options to createP2PKSecret', async () => {
      const options = { lockTime: 1234567890 };

      await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'), options);

      expect(createP2PKSecret).toHaveBeenCalledWith(
        'recipientpubkey123'.padEnd(64, '0'),
        options
      );
    });

    it('should handle keyset ID from first signature response', async () => {
      swapTokens.mockResolvedValue({
        signatures: [{ id: 'response_keyset' }, {}],
      });

      await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      expect(unblindSignatures).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        'response_keyset'
      );
    });
  });
});
