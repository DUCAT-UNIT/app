// @ts-nocheck
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
      { amount: 64, secret: 's1', C: 'C1', id: 'id' },
      { amount: 32, secret: 's2', C: 'C2', id: 'id' },
    ];

    const mockToken = {
      mint: 'https://mint.test.com',
      proofs: mockProofs,
      amount: 96,
    };

    it('should receive token successfully', async () => {
      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (isP2PKLocked as jest.Mock).mockReturnValue(false);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
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

      const result = await receiveToken('cashuAtoken...');

      expect(result.amount).toBe(96);
      expect(result.proofCount).toBe(2);
      expect(addProofs).toHaveBeenCalled();
    });

    it('should throw error for invalid token format', async () => {
      (decodeToken as jest.Mock).mockReturnValue(null);

      await expect(receiveToken('invalid')).rejects.toThrow('Invalid token format');
    });

    it('should throw error for token from different mint', async () => {
      (decodeToken as jest.Mock).mockReturnValue({
        mint: 'https://different.mint.com',
        proofs: mockProofs,
        amount: 96,
      });

      await expect(receiveToken('cashuAtoken...')).rejects.toThrow(
        'Token from different mint: https://different.mint.com'
      );
    });

    it('should throw error for duplicate token', async () => {
      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (loadProofs as jest.Mock).mockResolvedValue([{ secret: 's1' }]); // Already have this proof

      await expect(receiveToken('cashuAtoken...')).rejects.toThrow('Token already received');
    });

    it('should throw error when P2PK token has no matching account (line 94-95)', async () => {
      const p2pkProofs = [
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey123\"}]', C: 'C1' },
      ];
      (decodeToken as jest.Mock).mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: p2pkProofs,
        amount: 64,
      });
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (isP2PKLocked as jest.Mock).mockReturnValue(true);
      (getP2PKRecipient as jest.Mock).mockReturnValue('pubkey123');
      (getCurrentAccount as jest.Mock).mockResolvedValue(0);
      (findAccountForP2PKToken as jest.Mock).mockResolvedValue(null); // No matching account

      await expect(receiveToken('cashuAtoken...')).rejects.toThrow(
        'This token is not locked to any of your accounts'
      );
    });

    it('should throw error when P2PK token belongs to different account', async () => {
      const p2pkProofs = [
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey123\"}]', C: 'C1' },
      ];
      (decodeToken as jest.Mock).mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: p2pkProofs,
        amount: 64,
      });
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (isP2PKLocked as jest.Mock).mockReturnValue(true);
      (getP2PKRecipient as jest.Mock).mockReturnValue('pubkey123');
      (getCurrentAccount as jest.Mock).mockResolvedValue(0);
      (findAccountForP2PKToken as jest.Mock).mockResolvedValue({ accountIndex: 2 }); // Different account

      await expect(receiveToken('cashuAtoken...')).rejects.toThrow(
        'This proof belongs to account 3. Please switch to that account to claim this token.'
      );
    });

    it('should warn when recipient pubkey cannot be extracted (line 108)', async () => {
      const p2pkProofs = [
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey123\"}]', C: 'C1' },
      ];
      (decodeToken as jest.Mock).mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: p2pkProofs,
        amount: 64,
      });
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (isP2PKLocked as jest.Mock).mockReturnValue(true);
      (getP2PKRecipient as jest.Mock).mockReturnValue(null); // Cannot extract pubkey
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (getP2PKPrivateKey as jest.Mock).mockResolvedValue('privatekey123');
      (signP2PKProofs as jest.Mock).mockResolvedValue(p2pkProofs);
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }],
        blindingData: [{}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 's1', C: 'C1', id: 'id1' },
      ]);

      const { logger } = require('../../../../utils/logger');

      const result = await receiveToken('cashuAtoken...');

      expect(result.amount).toBe(64);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not extract recipient pubkey')
      );
    });

    it('should handle legacy keys format (line 144)', async () => {
      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (isP2PKLocked as jest.Mock).mockReturnValue(false);
      // Legacy format
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keys: { 1: 'key1', 2: 'key2' },
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

      const result = await receiveToken('cashuAtoken...');

      expect(result.amount).toBe(96);
    });

    it('should handle P2PK token successfully with correct account', async () => {
      const p2pkProofs = [
        { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey123\"}]', C: 'C1' },
      ];
      (decodeToken as jest.Mock).mockReturnValue({
        mint: 'https://mint.test.com',
        proofs: p2pkProofs,
        amount: 64,
      });
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (isP2PKLocked as jest.Mock).mockReturnValue(true);
      (getP2PKRecipient as jest.Mock).mockReturnValue('pubkey123');
      (getCurrentAccount as jest.Mock).mockResolvedValue(0);
      (findAccountForP2PKToken as jest.Mock).mockResolvedValue({ accountIndex: 0 }); // Same account
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (getP2PKPrivateKey as jest.Mock).mockResolvedValue('privatekey123');
      (signP2PKProofs as jest.Mock).mockResolvedValue(p2pkProofs);
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }],
        blindingData: [{}],
      });
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 's1', C: 'C1', id: 'id1' },
      ]);

      const result = await receiveToken('cashuAtoken...');

      expect(result.amount).toBe(64);
      expect(signP2PKProofs).toHaveBeenCalledWith(p2pkProofs, 'privatekey123');
    });

    it('should throw error when no keys available from mint (line 196)', async () => {
      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (isP2PKLocked as jest.Mock).mockReturnValue(false);
      // No keysets and no keys
      (getOrFetchKeys as jest.Mock).mockResolvedValue({});

      await expect(receiveToken('cashuAtoken...')).rejects.toThrow('No keys available from mint');
    });

    it('should retry saving proofs and succeed on second attempt (lines 250-259)', async () => {
      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (isP2PKLocked as jest.Mock).mockReturnValue(false);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
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

      // Fail first, succeed second
      (addProofs as jest.Mock)
        .mockRejectedValueOnce(new Error('Storage error'))
        .mockResolvedValueOnce(undefined);

      const { logger } = require('../../../../utils/logger');

      const result = await receiveToken('cashuAtoken...');

      expect(result.amount).toBe(96);
      expect(addProofs).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save proofs'),
        expect.objectContaining({ error: 'Storage error' })
      );
    });

    it('should fail after all retry attempts and store in recovery queue (lines 267-294)', async () => {
      const mockSetItemAsync = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(require('expo-secure-store'), 'setItemAsync').mockImplementation(mockSetItemAsync);

      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (isP2PKLocked as jest.Mock).mockReturnValue(false);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
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

      // Fail all attempts
      (addProofs as jest.Mock).mockRejectedValue(new Error('Persistent storage error'));

      const { logger } = require('../../../../utils/logger');

      await expect(receiveToken('cashuAtoken...')).rejects.toThrow(
        'Critical error: Received proofs from mint but failed to save locally'
      );

      expect(addProofs).toHaveBeenCalledTimes(3); // MAX_RETRIES = 3
      expect(logger.error).toHaveBeenCalledWith(
        'CRITICAL: Failed to save received proofs after all retries - FUND LOSS RISK',
        expect.objectContaining({
          error: 'Persistent storage error',
          proofCount: 2,
          amount: 96,
        })
      );
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        expect.stringContaining('cashu_failed_proofs_'),
        expect.stringContaining('new1')
      );
    });

    it('should handle recovery queue storage failure (lines 287-291)', async () => {
      const mockSetItemAsync = jest.fn().mockRejectedValue(new Error('SecureStore full'));
      jest.spyOn(require('expo-secure-store'), 'setItemAsync').mockImplementation(mockSetItemAsync);

      (decodeToken as jest.Mock).mockReturnValue(mockToken);
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (isP2PKLocked as jest.Mock).mockReturnValue(false);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
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
      (addProofs as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { logger } = require('../../../../utils/logger');

      await expect(receiveToken('cashuAtoken...')).rejects.toThrow('Critical error');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to store proofs in recovery queue',
        expect.objectContaining({ error: 'SecureStore full' })
      );
    });
  });
});
