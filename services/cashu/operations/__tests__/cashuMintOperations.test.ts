/**
 * Tests for cashuMintOperations
 */

jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../cashuMintClient', () => ({
  createMintQuote: jest.fn(),
  checkMintQuote: jest.fn(),
  mintTokens: jest.fn(),
  restoreSignatures: jest.fn(),
  mintRequiresDleqProofs: jest.fn(async () => false),
}));

jest.mock('../../crypto', () => ({
  createBlindedOutputs: jest.fn(),
  unblindSignatures: jest.fn(),
  splitAmount: jest.fn(),
  sumProofs: jest.fn((proofs: Array<{ amount: number }>) =>
    proofs.reduce((sum, proof) => sum + proof.amount, 0)
  ),
}));

jest.mock('../../cashuBalanceService', () => ({
  getOrFetchKeys: jest.fn(),
}));

jest.mock('../../cashuProofManager', () => ({
  addProofs: jest.fn(),
  getCurrentCashuAccount: jest.fn(() => 'tb1paccount'),
}));

jest.mock('../../cashuMintQuoteRecovery', () => ({
  ensureMintQuoteClaimCanBePersisted: jest.fn().mockResolvedValue(undefined),
  persistMintQuoteClaim: jest.fn(),
  removeMintQuote: jest.fn(),
  saveMintQuote: jest.fn(),
  updateMintQuoteState: jest.fn(),
}));

jest.mock('../../cashuProofRecoveryQueue', () => ({
  clearProofRecoveryRecord: jest.fn(),
  persistProofRecoveryRecord: jest.fn(),
}));

jest.mock('../../cashuQuoteSigner', () => ({
  getMintQuoteSigningKey: jest.fn(),
  signMintQuoteOutputs: jest.fn(),
}));

import { requestMint, checkMintStatus, completeMint } from '../cashuMintOperations';
import {
  createMintQuote,
  checkMintQuote,
  mintTokens,
  restoreSignatures,
} from '../../cashuMintClient';
import { createBlindedOutputs, unblindSignatures, splitAmount } from '../../crypto';
import { getOrFetchKeys } from '../../cashuBalanceService';
import { addProofs } from '../../cashuProofManager';
import { getMintQuoteSigningKey, signMintQuoteOutputs } from '../../cashuQuoteSigner';
import {
  ensureMintQuoteClaimCanBePersisted,
  persistMintQuoteClaim,
  removeMintQuote,
  updateMintQuoteState,
} from '../../cashuMintQuoteRecovery';
import {
  clearProofRecoveryRecord,
  persistProofRecoveryRecord,
} from '../../cashuProofRecoveryQueue';

describe('cashuMintOperations', () => {
  const pubkey = '02' + 'a'.repeat(64);
  const privateKey = '1'.repeat(64);

  beforeEach(() => {
    jest.clearAllMocks();
    (getMintQuoteSigningKey as jest.Mock).mockResolvedValue({ pubkey, privateKey });
    (signMintQuoteOutputs as jest.Mock).mockReturnValue('quotesig');
    (ensureMintQuoteClaimCanBePersisted as jest.Mock).mockResolvedValue(undefined);
    (persistMintQuoteClaim as jest.Mock).mockResolvedValue(undefined);
    (persistProofRecoveryRecord as jest.Mock).mockResolvedValue('proof-recovery-1');
    (clearProofRecoveryRecord as jest.Mock).mockResolvedValue(undefined);
    (removeMintQuote as jest.Mock).mockResolvedValue(undefined);
    (addProofs as jest.Mock).mockResolvedValue(undefined);
    (restoreSignatures as jest.Mock).mockRejectedValue(new Error('Restore failed'));
  });

  describe('requestMint', () => {
    it('should request a mint quote successfully', async () => {
      (createMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        amount: 2355,
        request: 'tb1p...',
        expiry: 1234567890,
        state: 'UNPAID',
      });

      const result = await requestMint(100);

      expect(createMintQuote).toHaveBeenCalledWith(pubkey, 'unit', 100);
      expect(result).toEqual({
        quoteId: 'quote123',
        amount: 100,
        depositAddress: 'tb1p...',
        expiry: 1234567890,
        state: 'UNPAID',
      });
    });

    it('should keep sending an amount for sat onchain mint quotes', async () => {
      (createMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote-sat',
        request: 'tb1pbtc...',
        expiry: 1234567890,
        state: 'UNPAID',
        unit: 'sat',
      });

      await requestMint(1000, 'sat');

      expect(createMintQuote).toHaveBeenCalledWith(pubkey, 'sat', 1000);
    });

    it('should throw error on failure', async () => {
      (createMintQuote as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(requestMint(100)).rejects.toThrow('Network error');
    });
  });

  describe('checkMintStatus', () => {
    it('should return paid status for PAID state', async () => {
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
      });

      const result = await checkMintStatus('quote123');

      expect(result).toEqual({
        quoteId: 'quote123',
        state: 'PAID',
        paid: true,
        amountPaid: undefined,
        amountIssued: undefined,
        availableAmount: 0,
      });
    });

    it('should expose issued state without a mintable amount', async () => {
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'ISSUED',
      });

      const result = await checkMintStatus('quote123');

      expect(result.paid).toBe(true);
      expect(result.availableAmount).toBe(0);
    });

    it('should treat amount_paid minus amount_issued as mintable even without state', async () => {
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        amount_paid: 125,
        amount_issued: 25,
      });

      const result = await checkMintStatus('quote123');

      expect(result).toEqual({
        quoteId: 'quote123',
        state: 'PAID',
        paid: true,
        amountPaid: 125,
        amountIssued: 25,
        availableAmount: 100,
      });
    });

    it('should return unpaid status for UNPAID state', async () => {
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'UNPAID',
      });

      const result = await checkMintStatus('quote123');

      expect(result.paid).toBe(false);
      expect(result.availableAmount).toBe(0);
    });

    it('should throw error on failure', async () => {
      (checkMintQuote as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(checkMintStatus('quote123')).rejects.toThrow('Network error');
    });
  });

  describe('completeMint', () => {
    it('should complete mint with keyset format', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [
          {
            id: 'keyset1',
            unit: 'unit',
            active: true,
            keys: { 1: 'key1', 2: 'key2', 4: 'key4', 32: 'key32', 64: 'key64' },
          },
        ],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 100,
        amount_issued: 0,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32, 4]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }, { amount: 4 }],
        blindingData: [{}, {}, {}],
      });
      (mintTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 's1', C: 'C', id: 'id' },
        { amount: 32, secret: 's2', C: 'C', id: 'id' },
        { amount: 4, secret: 's3', C: 'C', id: 'id' },
      ]);

      const result = await completeMint('quote123', 100);

      expect(result).toHaveLength(3);
      expect((persistMintQuoteClaim as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        (mintTokens as jest.Mock).mock.invocationCallOrder[0]
      );
      expect((persistMintQuoteClaim as jest.Mock).mock.invocationCallOrder[1]).toBeLessThan(
        (unblindSignatures as jest.Mock).mock.invocationCallOrder[0]
      );
      expect(persistMintQuoteClaim).toHaveBeenNthCalledWith(
        1,
        'quote123',
        expect.objectContaining({
          amount: 100,
          keysetId: 'keyset1',
        })
      );
      expect((persistMintQuoteClaim as jest.Mock).mock.calls[0][1]).not.toHaveProperty(
        'signatures'
      );
      expect(signMintQuoteOutputs).toHaveBeenCalledWith(
        'quote123',
        [{ amount: 64 }, { amount: 32 }, { amount: 4 }],
        privateKey
      );
      expect(mintTokens).toHaveBeenCalledWith(
        'quote123',
        [{ amount: 64 }, { amount: 32 }, { amount: 4 }],
        'quotesig'
      );
      expect(addProofs).toHaveBeenCalled();
    });

    it('should mint only the paid amount that has not already been issued', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [
          { id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1', 2: 'key2', 8: 'key8' } },
        ],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 10,
        amount_issued: 2,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([8]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 8 }],
        blindingData: [{}],
      });
      (mintTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 8, secret: 's1', C: 'C', id: 'id' },
      ]);

      const result = await completeMint('quote123', 10);

      expect(result).toHaveLength(1);
      expect(splitAmount).toHaveBeenCalledWith(8);
    });

    it('should not claim more than the amount requested by the flow', async () => {
      const proofs = [
        { amount: 512, secret: 's1', C: 'C', id: 'id' },
        { amount: 256, secret: 's2', C: 'C', id: 'id' },
        { amount: 128, secret: 's3', C: 'C', id: 'id' },
        { amount: 64, secret: 's4', C: 'C', id: 'id' },
        { amount: 32, secret: 's5', C: 'C', id: 'id' },
        { amount: 8, secret: 's6', C: 'C', id: 'id' },
      ];
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [
          {
            id: 'keyset1',
            unit: 'unit',
            active: true,
            keys: {
              8: 'key8',
              32: 'key32',
              64: 'key64',
              128: 'key128',
              256: 'key256',
              512: 'key512',
            },
          },
        ],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 2355,
        amount_issued: 0,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([512, 256, 128, 64, 32, 8]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [
          { amount: 512 },
          { amount: 256 },
          { amount: 128 },
          { amount: 64 },
          { amount: 32 },
          { amount: 8 },
        ],
        blindingData: [{}, {}, {}, {}, {}, {}],
      });
      (mintTokens as jest.Mock).mockResolvedValue({
        signatures: [
          { id: 'keyset1' },
          { id: 'keyset1' },
          { id: 'keyset1' },
          { id: 'keyset1' },
          { id: 'keyset1' },
          { id: 'keyset1' },
        ],
      });
      (unblindSignatures as jest.Mock).mockReturnValue(proofs);

      const result = await completeMint('quote123', 1000);

      expect(result).toEqual(proofs);
      expect(splitAmount).toHaveBeenCalledWith(1000);
      expect(persistMintQuoteClaim).toHaveBeenCalledWith(
        'quote123',
        expect.objectContaining({ amount: 1000 })
      );
      expect(addProofs).toHaveBeenCalledWith(proofs);
    });

    it('rejects extra available amount when exact mint completion is required', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [
          {
            id: 'keyset1',
            unit: 'unit',
            active: true,
            keys: { 1: 'key1' },
          },
        ],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 2355,
        amount_issued: 0,
        pubkey,
      });

      await expect(
        completeMint('quote123', 1000, 'unit', { requireExactAmount: true })
      ).rejects.toThrow('Mint quote has 2355 available; expected exactly 1000');

      expect(splitAmount).not.toHaveBeenCalled();
      expect(mintTokens).not.toHaveBeenCalled();
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('can save minted proofs without notifying balance listeners', async () => {
      const proofs = [{ amount: 64, secret: 's1', C: 'C', id: 'id' }];
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 64: 'key64' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 64,
        amount_issued: 0,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }],
        blindingData: [{}],
      });
      (mintTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue(proofs);

      const result = await completeMint('quote123', 64, 'unit', { notifyProofChange: false });

      expect(result).toEqual(proofs);
      expect(addProofs).toHaveBeenCalledWith(proofs, true, 'unit', { notify: false });
      expect(removeMintQuote).toHaveBeenCalledWith('quote123');
    });

    it('should abort before asking the mint for signatures if quote recovery cannot be persisted', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 64: 'key64' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 64,
        amount_issued: 0,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }],
        blindingData: [{}],
      });
      (ensureMintQuoteClaimCanBePersisted as jest.Mock).mockRejectedValue(
        new Error('Mint quote recovery record missing')
      );

      await expect(completeMint('quote123', 64)).rejects.toThrow(
        'Mint quote recovery record missing'
      );

      expect(mintTokens).not.toHaveBeenCalled();
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should still save in-memory proofs if claim journaling fails after signatures return', async () => {
      const proofs = [{ amount: 64, secret: 's1', C: 'C', id: 'id' }];
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 64: 'key64' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 64,
        amount_issued: 0,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }],
        blindingData: [{}],
      });
      (mintTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue(proofs);
      (persistMintQuoteClaim as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('SecureStore full'));

      const result = await completeMint('quote123', 64);

      expect(result).toEqual(proofs);
      expect(persistProofRecoveryRecord).toHaveBeenCalledWith(
        proofs,
        64,
        'mint_claim',
        'SecureStore full'
      );
      expect(addProofs).toHaveBeenCalledWith(proofs);
      expect(clearProofRecoveryRecord).toHaveBeenCalledWith('proof-recovery-1');
      expect(removeMintQuote).toHaveBeenCalledWith('quote123');
    });

    it('keeps issued mint proofs recoverable if claim journaling and immediate proof save both fail', async () => {
      const proofs = [{ amount: 64, secret: 's1', C: 'C', id: 'id' }];
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 64: 'key64' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 64,
        amount_issued: 0,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }],
        blindingData: [{}],
      });
      (mintTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue(proofs);
      (persistMintQuoteClaim as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('SecureStore full'));
      (addProofs as jest.Mock).mockRejectedValue(new Error('proof write failed'));

      await expect(completeMint('quote123', 64)).rejects.toThrow('proof write failed');

      expect(persistProofRecoveryRecord).toHaveBeenCalledWith(
        proofs,
        64,
        'mint_claim',
        'SecureStore full'
      );
      expect(clearProofRecoveryRecord).not.toHaveBeenCalled();
      expect(removeMintQuote).not.toHaveBeenCalled();
      expect(updateMintQuoteState).toHaveBeenLastCalledWith('quote123', 'PENDING');
    });

    it('should leave a persisted claim recoverable if unblinding fails after signatures return', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 64: 'key64' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 64,
        amount_issued: 0,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }],
        blindingData: [{}],
      });
      (mintTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }],
      });
      (unblindSignatures as jest.Mock).mockImplementation(() => {
        throw new Error('Unblind failed');
      });

      await expect(completeMint('quote123', 64)).rejects.toThrow('Unblind failed');

      expect(persistMintQuoteClaim).toHaveBeenCalled();
      expect(updateMintQuoteState).toHaveBeenLastCalledWith('quote123', 'PENDING');
      expect(addProofs).not.toHaveBeenCalled();
      expect(removeMintQuote).not.toHaveBeenCalled();
    });

    it('should reject mint signatures that unblind to less than the claim amount', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'sat', active: true, keys: { 32: 'key32', 64: 'key64' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 96,
        amount_issued: 0,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([64, 32]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }, { amount: 32 }],
        blindingData: [{}, {}],
      });
      (mintTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, { id: 'keyset1' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 's1', C: 'C', id: 'keyset1' },
      ]);

      await expect(completeMint('quote123', 96, 'sat')).rejects.toThrow(
        'Mint verification failed: expected 96 but received 64'
      );

      expect(addProofs).not.toHaveBeenCalled();
      expect(removeMintQuote).not.toHaveBeenCalled();
      expect(updateMintQuoteState).toHaveBeenLastCalledWith('quote123', 'PENDING');
    });

    it('should reject a mint quote whose advertised unit does not match the claim unit', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 64: 'key64' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 64,
        amount_issued: 0,
        unit: 'sat',
        pubkey,
      });

      await expect(completeMint('quote123', 64, 'unit')).rejects.toThrow(
        'Mint quote unit mismatch: expected unit but mint returned sat'
      );

      expect(mintTokens).not.toHaveBeenCalled();
      expect(addProofs).not.toHaveBeenCalled();
      expect(updateMintQuoteState).toHaveBeenLastCalledWith('quote123', 'PAID');
    });

    it('should restore signatures when the mint claim fails after signing persisted outputs', async () => {
      const proofs = [{ amount: 64, secret: 's1', C: 'C', id: 'keyset1' }];
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 64: 'key64' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 64,
        amount_issued: 0,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64, B_: 'B_', id: 'keyset1' }],
        blindingData: [{ amount: 64, B_: 'B_', r: 'r', secret: 's1' }],
      });
      (mintTokens as jest.Mock).mockRejectedValue(new Error('Mint failed'));
      (restoreSignatures as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1', C_: 'sig' }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue(proofs);

      const result = await completeMint('quote123', 64);

      expect(result).toEqual(proofs);
      expect(restoreSignatures).toHaveBeenCalledWith([{ amount: 64, B_: 'B_', id: 'keyset1' }]);
      expect(persistMintQuoteClaim).toHaveBeenNthCalledWith(
        2,
        'quote123',
        expect.objectContaining({
          amount: 64,
          signatures: [{ id: 'keyset1', C_: 'sig' }],
          signedKeysetId: 'keyset1',
        })
      );
      expect(addProofs).toHaveBeenCalledWith(proofs);
      expect(removeMintQuote).toHaveBeenCalledWith('quote123');
    });

    it('should throw error if no active unit keyset is available', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({});
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 100,
        amount_issued: 0,
      });

      await expect(completeMint('quote123', 100)).rejects.toThrow(
        'No active unit keyset available from mint'
      );
    });

    it('should throw error on mint failure', async () => {
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } }],
      });
      (checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 64,
        amount_issued: 0,
        pubkey,
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: [{ amount: 64 }],
        blindingData: [{}],
      });
      (mintTokens as jest.Mock).mockRejectedValue(new Error('Mint failed'));

      await expect(completeMint('quote123', 64)).rejects.toThrow('Mint failed');
    });
  });
});
