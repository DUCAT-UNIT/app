/**
 * Tests for cashuReceiveToken
 */

jest.mock('../../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    transaction: jest.fn(),
    security: jest.fn(),
    screen: jest.fn(),
    action: jest.fn(),
    wallet: jest.fn(),
    cashu: jest.fn(),
    api: jest.fn(),
    auth: jest.fn(),
    perf: jest.fn(),
    turbo: jest.fn(),
    vault: jest.fn(),
    onboarding: jest.fn(),
    startTransaction: jest.fn().mockReturnValue({ finish: jest.fn() }),
    setContext: jest.fn(),
    setTag: jest.fn(),
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
  decodeToken: jest.fn(),
}));

jest.mock('../../p2pk', () => ({
  isP2PKLocked: jest.fn(),
  getP2PKRecipient: jest.fn(),
  findAccountForP2PKToken: jest.fn(),
  getP2PKPrivateKey: jest.fn(),
  signP2PKProofs: jest.fn(),
}));

jest.mock('../../../secureStorageService', () => ({
  getCurrentAccount: jest.fn(),
}));

jest.mock('../../cashuBalanceService', () => ({
  getOrFetchKeys: jest.fn(),
}));

jest.mock('../../cashuProofManager', () => ({
  loadProofs: jest.fn(),
  addProofs: jest.fn(),
}));

import { receiveToken } from '../cashuReceiveToken';
import { MINT_URL, swapTokens } from '../../cashuMintClient';
import { createBlindedOutputs, unblindSignatures, splitAmount, sumProofs, decodeToken } from '../../crypto';
import { isP2PKLocked, getP2PKRecipient, findAccountForP2PKToken, getP2PKPrivateKey, signP2PKProofs } from '../../p2pk';
import { getCurrentAccount } from '../../../secureStorageService';
import { getOrFetchKeys } from '../../cashuBalanceService';
import { loadProofs, addProofs } from '../../cashuProofManager';

describe('cashuReceiveToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('receiveToken', () => {
    const mockProofs = [
      { amount: 64, secret: 's1', C: 'C1' },
      { amount: 32, secret: 's2', C: 'C2' },
    ];

    const mockToken = {
      mint: 'https://mint.test.com',
      proofs: mockProofs,
      amount: 96,
    };

    it('should receive token successfully', async () => {
      decodeToken.mockReturnValue(mockToken);
      loadProofs.mockResolvedValue([]);
      isP2PKLocked.mockReturnValue(false);
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      splitAmount.mockReturnValue([64, 32]);
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

      const result = await receiveToken('cashuAtoken...');

      expect(result.amount).toBe(96);
      expect(result.proofCount).toBe(2);
      expect(addProofs).toHaveBeenCalled();
    });

    it('should throw error for invalid token format', async () => {
      decodeToken.mockReturnValue(null);

      await expect(receiveToken('invalid')).rejects.toThrow('Invalid token format');
    });

    it('should throw error for token from different mint', async () => {
      decodeToken.mockReturnValue({
        mint: 'https://different.mint.com',
        proofs: mockProofs,
        amount: 96,
      });

      await expect(receiveToken('cashuAtoken...')).rejects.toThrow(
        'Token from different mint: https://different.mint.com'
      );
    });

    it('should throw error for duplicate token', async () => {
      decodeToken.mockReturnValue(mockToken);
      loadProofs.mockResolvedValue([{ secret: 's1' }]); // Already have this proof

      await expect(receiveToken('cashuAtoken...')).rejects.toThrow('Token already received');
    });

    it('should throw error when P2PK token has no matching account (line 94-95)', async () => {
      const p2pkProofs = [
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey123\"}]', C: 'C1' },
      ];
      decodeToken.mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: p2pkProofs,
        amount: 64,
      });
      loadProofs.mockResolvedValue([]);
      isP2PKLocked.mockReturnValue(true);
      getP2PKRecipient.mockReturnValue('pubkey123');
      getCurrentAccount.mockResolvedValue(0);
      findAccountForP2PKToken.mockResolvedValue(null); // No matching account

      await expect(receiveToken('cashuAtoken...')).rejects.toThrow(
        'This token is not locked to any of your accounts'
      );
    });

    it('should throw error when P2PK token belongs to different account', async () => {
      const p2pkProofs = [
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey123\"}]', C: 'C1' },
      ];
      decodeToken.mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: p2pkProofs,
        amount: 64,
      });
      loadProofs.mockResolvedValue([]);
      isP2PKLocked.mockReturnValue(true);
      getP2PKRecipient.mockReturnValue('pubkey123');
      getCurrentAccount.mockResolvedValue(0);
      findAccountForP2PKToken.mockResolvedValue({ accountIndex: 2 }); // Different account

      await expect(receiveToken('cashuAtoken...')).rejects.toThrow(
        'This proof belongs to account 3. Please switch to that account to claim this token.'
      );
    });

    it('should warn when recipient pubkey cannot be extracted (line 108)', async () => {
      const p2pkProofs = [
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey123\"}]', C: 'C1' },
      ];
      decodeToken.mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: p2pkProofs,
        amount: 64,
      });
      loadProofs.mockResolvedValue([]);
      isP2PKLocked.mockReturnValue(true);
      getP2PKRecipient.mockReturnValue(null); // Cannot extract pubkey
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      getP2PKPrivateKey.mockResolvedValue('privatekey123');
      signP2PKProofs.mockResolvedValue(p2pkProofs);
      splitAmount.mockReturnValue([64]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }],
        blindingData: [{}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64 },
      ]);

      const { logger } = require('../../../../utils/logger');

      const result = await receiveToken('cashuAtoken...');

      expect(result.amount).toBe(64);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not extract recipient pubkey')
      );
    });

    it('should handle legacy keys format (line 144)', async () => {
      decodeToken.mockReturnValue(mockToken);
      loadProofs.mockResolvedValue([]);
      isP2PKLocked.mockReturnValue(false);
      // Legacy format
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

      const result = await receiveToken('cashuAtoken...');

      expect(result.amount).toBe(96);
    });

    it('should handle P2PK token successfully with correct account', async () => {
      const p2pkProofs = [
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey123\"}]', C: 'C1' },
      ];
      decodeToken.mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: p2pkProofs,
        amount: 64,
      });
      loadProofs.mockResolvedValue([]);
      isP2PKLocked.mockReturnValue(true);
      getP2PKRecipient.mockReturnValue('pubkey123');
      getCurrentAccount.mockResolvedValue(0);
      findAccountForP2PKToken.mockResolvedValue({ accountIndex: 0 }); // Same account
      getOrFetchKeys.mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      getP2PKPrivateKey.mockResolvedValue('privatekey123');
      signP2PKProofs.mockResolvedValue(p2pkProofs);
      splitAmount.mockReturnValue([64]);
      createBlindedOutputs.mockResolvedValue({
        outputs: [{ amount: 64 }],
        blindingData: [{}],
      });
      swapTokens.mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      unblindSignatures.mockReturnValue([
        { amount: 64 },
      ]);

      const result = await receiveToken('cashuAtoken...');

      expect(result.amount).toBe(64);
      expect(signP2PKProofs).toHaveBeenCalledWith(p2pkProofs, 'privatekey123');
    });
  });
});
