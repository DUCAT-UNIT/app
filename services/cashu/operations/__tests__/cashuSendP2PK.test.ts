/**
 * Tests for cashuSendP2PK
 */

jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../cashuMintClient', () => ({
  MINT_URL: 'https://mint.test.com',
  checkProofsSpent: jest.fn(async (proofs: any[]) => ({
    states: proofs.map(() => ({ state: 'UNSPENT' })),
  })),
  swapTokens: jest.fn(),
  mintRequiresDleqProofs: jest.fn(async () => false),
}));

jest.mock('../../crypto', () => ({
  createBlindedMessage: jest.fn(),
  unblindSignatures: jest.fn(),
  splitAmount: jest.fn(),
  sumProofs: jest.fn((proofs: any[]) => proofs.reduce((sum: number, p: any) => sum + p.amount, 0)),
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
  getCurrentCashuAccount: jest.fn(() => 'tb1paccount'),
}));

import { sendP2PKToken } from '../cashuSendP2PK';
import { MINT_URL, checkProofsSpent, swapTokens } from '../../cashuMintClient';
import {
  createBlindedMessage,
  unblindSignatures,
  splitAmount,
  sumProofs,
  selectProofsForAmount,
  encodeToken,
  generateSecret,
} from '../../crypto';
import { createP2PKSecret, isP2PKSecret } from '../../p2pk';
import { getOrFetchKeys, getBalance } from '../../cashuBalanceService';
import { loadProofs, removeProofs, addProofs } from '../../cashuProofManager';

describe('cashuSendP2PK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendP2PKToken', () => {
    const mockProofs = [
      { amount: 64, secret: 'normal_secret1', C: 'C1', id: 'keyset1' },
      { amount: 64, secret: 'normal_secret2', C: 'C2', id: 'keyset1' },
    ];

    beforeEach(() => {
      (loadProofs as jest.Mock).mockResolvedValue(mockProofs);
      (isP2PKSecret as jest.Mock).mockReturnValue(false);
      (selectProofsForAmount as jest.Mock).mockReturnValue(mockProofs);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockImplementation((amount: any) => [amount]);
      (createP2PKSecret as jest.Mock).mockResolvedValue(
        '[\"P2PK\",{\"data\":\"recipientpubkey\"}]'
      );
      (generateSecret as jest.Mock).mockResolvedValue('change_secret');
      (createBlindedMessage as jest.Mock).mockResolvedValue({
        B_: 'blinded_point',
        r: 'blinding_factor',
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"recipientpubkey\"}]' },
        { amount: 64, secret: 'change_secret', C: 'C', id: 'keyset1' },
      ]);
      (encodeToken as jest.Mock).mockReturnValue('cashuBtoken...');
      (getBalance as jest.Mock).mockResolvedValue(64);
    });

    it('should send P2PK token successfully', async () => {
      const result = await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      expect(result.token).toBe('cashuBtoken...');
      expect(result.amount).toBe(64);
      expect(removeProofs).toHaveBeenCalled();
    });

    it('should use active unit keyset keys (line 124)', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1', 2: 'key2' } }],
      });

      const result = await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      expect(result.token).toBe('cashuBtoken...');
    });

    it('should send sat P2PK tokens from the sat proof store and encode a sat token', async () => {
      const satProofs = [
        { amount: 64, secret: 'sat_secret1', C: 'C1', id: 'satset1' },
        { amount: 32, secret: 'sat_secret2', C: 'C2', id: 'satset1' },
      ];
      (loadProofs as jest.Mock).mockResolvedValue(satProofs);
      (selectProofsForAmount as jest.Mock).mockReturnValue(satProofs);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [
          { id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } },
          { id: 'satset1', unit: 'sat', active: true, keys: { 1: 'satkey1' } },
        ],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'satset1' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"recipientpubkey\"}]', C: 'C', id: 'satset1' },
        { amount: 32, secret: 'change_secret', C: 'C', id: 'satset1' },
      ]);

      const result = await sendP2PKToken(
        64,
        'recipientpubkey123'.padEnd(64, '0'),
        {},
        undefined,
        'tb1precipient',
        'sat'
      );

      expect(result.token).toBe('cashuBtoken...');
      expect(loadProofs).toHaveBeenCalledWith('sat');
      expect(addProofs).toHaveBeenCalledWith(
        [{ amount: 32, secret: 'change_secret', C: 'C', id: 'satset1' }],
        true,
        'sat'
      );
      expect(removeProofs).toHaveBeenCalledWith(satProofs, 'sat');
      expect(encodeToken).toHaveBeenCalledWith(
        [
          {
            amount: 64,
            secret: '[\"P2PK\",{\"data\":\"recipientpubkey\"}]',
            C: 'C',
            id: 'satset1',
          },
        ],
        MINT_URL,
        'sat'
      );
      expect(getBalance).toHaveBeenCalledWith(true, 'sat');
    });

    it('should create change when selected amount exceeds requested (lines 143-149)', async () => {
      // Select more than needed
      (selectProofsForAmount as jest.Mock).mockReturnValue(mockProofs); // 128 total
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64]) // send (amounts as jest.Mock)
        .mockReturnValueOnce([64]); // change amounts

      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"recipientpubkey\"}]' },
        { amount: 64, secret: 'change_secret', C: 'C', id: 'keyset1' },
      ]);

      const result = await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      expect(generateSecret).toHaveBeenCalled();
      expect(addProofs).toHaveBeenCalled();
    });

    it('should throw error on amount mismatch (line 170)', async () => {
      // Mock splitAmount to return different totals causing mismatch
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64]) // send amounts (correct)
        .mockReturnValueOnce([32]); // change amounts (wrong - should be 64)

      await expect(sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'))).rejects.toThrow(
        'Amount mismatch'
      );
    });

    it('should call onProgress callback', async () => {
      const onProgress = jest.fn();

      await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'), {}, onProgress);

      expect(onProgress).toHaveBeenCalled();
    });

    it('should filter out P2PK locked proofs from available proofs', async () => {
      const mixedProofs = [
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"locked\"}]', C: 'C1', id: 'keyset1' },
        { amount: 64, secret: 'normal_secret', C: 'C2', id: 'keyset1' },
      ];
      (loadProofs as jest.Mock).mockResolvedValue(mixedProofs);
      (isP2PKSecret as jest.Mock).mockImplementation((secret: string) =>
        secret.startsWith('[\"P2PK\"')
      );
      (selectProofsForAmount as jest.Mock).mockReturnValue([mixedProofs[1]]); // Only unlocked
      // selectedAmount=64, send=64, no change => unblind must return proofs summing to 64
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"recipientpubkey\"}]' },
      ]);

      await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      // Should filter to only unlocked proofs before selection
      expect(selectProofsForAmount).toHaveBeenCalledWith([mixedProofs[1]], 64);
    });

    it('should log change proof details when change is created (lines 234-235, 244-248)', async () => {
      const { logger } = require('../../../../utils/logger');

      // Ensure we get change
      (selectProofsForAmount as jest.Mock).mockReturnValue(mockProofs); // 128 total
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64]) // send (amounts as jest.Mock)
        .mockReturnValueOnce([64]); // change amounts

      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"recipientpubkey\"}]' },
        { amount: 64, secret: 'change_secret', C: 'C', id: 'keyset1' },
      ]);

      await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      // Check logger was called with change proof info
      expect(logger.debug).toHaveBeenCalledWith(
        'P2PK change proof classification',
        expect.any(Object)
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Change proofs added back to wallet',
        expect.any(Object)
      );
    });

    it('should handle error during send', async () => {
      (swapTokens as jest.Mock).mockRejectedValue(new Error('Swap failed'));

      await expect(sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'))).rejects.toThrow(
        'Swap failed'
      );
    });

    it('should abort before swap when selected proofs are not spendable', async () => {
      (checkProofsSpent as jest.Mock).mockResolvedValueOnce({
        states: [{ state: 'PENDING' }, { state: 'UNSPENT' }],
      });

      await expect(sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'))).rejects.toThrow(
        'Proofs are not spendable'
      );

      expect(swapTokens).not.toHaveBeenCalled();
      expect(removeProofs).not.toHaveBeenCalled();
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should pass options to createP2PKSecret', async () => {
      const options = { locktime: 1234567890 };

      await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'), options);

      expect(createP2PKSecret).toHaveBeenCalledWith('recipientpubkey123'.padEnd(64, '0'), options);
    });

    it('should handle keyset ID from first signature response', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [
          { id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } },
          { id: 'response_keyset', unit: 'unit', active: true, keys: { 1: 'response-key1' } },
        ],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'response_keyset' }, {}],
      });

      await sendP2PKToken(64, 'recipientpubkey123'.padEnd(64, '0'));

      expect(unblindSignatures).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.any(Object),
        'response_keyset',
        { requireDleq: false }
      );
    });
  });
});
