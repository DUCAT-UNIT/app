/**
 * Tests for cashuMintQuoteRecovery service
 */

import * as SecureStore from 'expo-secure-store';
import {
  saveMintQuote,
  removeMintQuote,
  loadMintQuotes,
  updateMintQuoteState,
  ensureMintQuoteClaimCanBePersisted,
  persistMintQuoteClaim,
  recoverUnclaimedMintQuotes,
  clearAllMintQuotes,
  PersistedMintQuote,
} from '../cashuMintQuoteRecovery';

// Mock dependencies
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../cashuMintClient', () => ({
  checkMintQuote: jest.fn(),
  restoreSignatures: jest.fn(),
}));

jest.mock('../operations/cashuMintOperations', () => ({
  completeMint: jest.fn(),
}));

jest.mock('../cashuProofManager', () => ({
  getCurrentCashuAccount: jest.fn(() => null),
  addProofs: jest.fn(),
}));

jest.mock('../crypto', () => ({
  unblindSignatures: jest.fn(),
  sumProofs: jest.fn((proofs: Array<{ amount: number }>) =>
    proofs.reduce((sum, proof) => sum + proof.amount, 0)
  ),
}));

jest.mock('../cashuBalanceService', () => ({
  getOrFetchKeys: jest.fn(),
}));

jest.mock('../cashuKeysetUtils', () => ({
  assertResponseSignaturesUseExpectedKeyset: jest.fn(
    (signatures: Array<{ id?: string }>, expectedKeysetId: string) =>
      signatures.find((signature) => signature.id)?.id ?? expectedKeysetId
  ),
}));

jest.mock('../../storagePolicy', () => ({
  DEVICE_ONLY: {},
}));

import { checkMintQuote, restoreSignatures } from '../cashuMintClient';
import { completeMint } from '../operations/cashuMintOperations';
import { addProofs, getCurrentCashuAccount } from '../cashuProofManager';
import { unblindSignatures } from '../crypto';

describe('cashuMintQuoteRecovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (getCurrentCashuAccount as jest.Mock).mockReturnValue(null);
    (restoreSignatures as jest.Mock).mockResolvedValue({ signatures: [] });
    (unblindSignatures as jest.Mock).mockReturnValue([]);
    (addProofs as jest.Mock).mockResolvedValue(undefined);
  });

  describe('saveMintQuote', () => {
    it('should save a new mint quote', async () => {
      const quote = {
        quoteId: 'quote123',
        amount: 1000,
        depositAddress: 'tb1ptest',
      };

      await saveMintQuote(quote);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'cashu_pending_mint_quotes',
        expect.stringContaining('quote123'),
        expect.any(Object)
      );
    });

    it('should not add duplicate quotes', async () => {
      const existingQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingQuotes));

      await saveMintQuote({
        quoteId: 'quote123',
        amount: 1000,
        depositAddress: 'tb1ptest',
      });

      // Should not call setItemAsync since quote already exists
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should reconcile an existing quote when the Cashu unit changes', async () => {
      const existingQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1pold',
          createdAt: 123,
          state: 'UNPAID',
          unit: 'unit',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingQuotes));
      (getCurrentCashuAccount as jest.Mock).mockReturnValue('tb1paccount');

      await saveMintQuote({
        quoteId: 'quote123',
        amount: 2000,
        depositAddress: 'tb1pnew',
        unit: 'sat',
      });

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        quoteId: 'quote123',
        amount: 2000,
        depositAddress: 'tb1pnew',
        createdAt: 123,
        state: 'UNPAID',
        unit: 'sat',
        taprootAddress: 'tb1paccount',
      });
    });

    it('should add quote with UNPAID state and timestamp', async () => {
      const beforeTime = Date.now();

      await saveMintQuote({
        quoteId: 'quote123',
        amount: 1000,
        depositAddress: 'tb1ptest',
      });

      const savedData = JSON.parse(
        (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]
      );
      expect(savedData[0].state).toBe('UNPAID');
      expect(savedData[0].createdAt).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should throw on save errors so callers do not continue without recovery', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(
        saveMintQuote({
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
        })
      ).rejects.toThrow('Storage error');
    });

    it('should not overwrite corrupt mint quote storage', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('{bad json');

      await expect(
        saveMintQuote({
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
        })
      ).rejects.toThrow('Mint quote recovery storage corrupted');

      expect((SecureStore.setItemAsync as jest.Mock).mock.calls.some(
        ([key]) => key === 'cashu_pending_mint_quotes',
      )).toBe(false);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^cashu_pending_mint_quotes_corrupt_/),
        '{bad json',
        expect.any(Object),
      );
    });
  });

  describe('removeMintQuote', () => {
    it('should remove a quote by ID', async () => {
      const existingQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
        {
          quoteId: 'quote456',
          amount: 2000,
          depositAddress: 'tb1ptest2',
          createdAt: Date.now(),
          state: 'PAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingQuotes));

      await removeMintQuote('quote123');

      const savedData = JSON.parse(
        (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]
      );
      expect(savedData.length).toBe(1);
      expect(savedData[0].quoteId).toBe('quote456');
    });

    it('should do nothing if quote not found', async () => {
      const existingQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingQuotes));

      await removeMintQuote('nonexistent');

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should preserve other account quotes when removing a current account quote', async () => {
      (getCurrentCashuAccount as jest.Mock).mockReturnValue('account_a');
      const existingQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote_a',
          amount: 1000,
          depositAddress: 'tb1ptest',
          taprootAddress: 'account_a',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
        {
          quoteId: 'quote_b',
          amount: 2000,
          depositAddress: 'tb1ptest2',
          taprootAddress: 'account_b',
          createdAt: Date.now(),
          state: 'PAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingQuotes));

      await removeMintQuote('quote_a');

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toEqual([{ ...existingQuotes[1], unit: 'unit' }]);
    });

    it('should handle errors gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(removeMintQuote('quote123')).resolves.not.toThrow();
    });

    it('should handle non-Error thrown gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue('string error');

      await expect(removeMintQuote('quote123')).resolves.not.toThrow();
    });
  });

  describe('loadMintQuotes', () => {
    it('should return empty array when no quotes stored', async () => {
      const quotes = await loadMintQuotes();

      expect(quotes).toEqual([]);
    });

    it('should return stored quotes', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));

      const quotes = await loadMintQuotes();

      expect(quotes).toEqual([{ ...storedQuotes[0], unit: 'unit' }]);
    });

    it('should not load account-tagged quotes before the current account is initialized', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote_tagged',
          amount: 1000,
          depositAddress: 'tb1ptest',
          taprootAddress: 'tb1paccount',
          createdAt: Date.now(),
          state: 'PAID',
        },
        {
          quoteId: 'quote_legacy',
          amount: 500,
          depositAddress: 'tb1plegacy',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));

      const quotes = await loadMintQuotes();

      expect(quotes).toEqual([{ ...storedQuotes[1], unit: 'unit' }]);
    });

    it('should keep expired quotes until recovery checks mint status', async () => {
      const now = Date.now();
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'old_quote',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: now - 25 * 60 * 60 * 1000, // 25 hours ago
          state: 'UNPAID',
        },
        {
          quoteId: 'new_quote',
          amount: 2000,
          depositAddress: 'tb1ptest2',
          createdAt: now - 1 * 60 * 60 * 1000, // 1 hour ago
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));

      const quotes = await loadMintQuotes();

      expect(quotes).toEqual(storedQuotes.map((quote) => ({ ...quote, unit: 'unit' })));
    });

    it('should not clean expired quotes during load before checking the mint', async () => {
      const now = Date.now();
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'old_quote',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: now - 25 * 60 * 60 * 1000,
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));

      await loadMintQuotes();

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should keep expired quotes that have persisted claim data', async () => {
      const now = Date.now();
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'old_claim_quote',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: now - 25 * 60 * 60 * 1000,
          state: 'PENDING',
          claim: {
            amount: 1000,
            signatures: [],
            blindingData: [],
            keys: {},
            keysetId: 'keyset',
            signedKeysetId: 'signed-keyset',
            createdAt: now - 25 * 60 * 60 * 1000,
          },
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));

      const quotes = await loadMintQuotes();

      expect(quotes).toEqual(storedQuotes.map((quote) => ({ ...quote, unit: 'unit' })));
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should fail closed and quarantine corrupt quote storage', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('invalid json');

      await expect(loadMintQuotes()).rejects.toThrow('Mint quote recovery storage corrupted');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^cashu_pending_mint_quotes_corrupt_/),
        'invalid json',
        expect.any(Object),
      );
    });
  });

  describe('updateMintQuoteState', () => {
    it('should update quote state', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));

      await updateMintQuoteState('quote123', 'PAID');

      const savedData = JSON.parse(
        (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]
      );
      expect(savedData[0].state).toBe('PAID');
    });

    it('should do nothing if quote not found', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify([]));

      await updateMintQuoteState('nonexistent', 'PAID');

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(updateMintQuoteState('quote123', 'PAID')).resolves.not.toThrow();
    });

    it('should handle non-Error thrown gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue('string error');

      await expect(updateMintQuoteState('quote123', 'PAID')).resolves.not.toThrow();
    });
  });

  describe('claim persistence preconditions', () => {
    it('should throw if a mint claim has no durable quote record', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify([]));

      await expect(ensureMintQuoteClaimCanBePersisted('missing_quote')).rejects.toThrow(
        'Mint quote recovery record missing'
      );
    });

    it('should throw instead of silently ignoring a claim for a missing quote', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify([]));

      await expect(
        persistMintQuoteClaim('missing_quote', {
          amount: 1000,
          signatures: [],
          blindingData: [],
          keys: {},
          keysetId: 'keyset',
          signedKeysetId: 'keyset',
        })
      ).rejects.toThrow('Mint quote recovery record missing');
    });
  });

  describe('recoverUnclaimedMintQuotes', () => {
    it('should return empty result when no quotes', async () => {
      const result = await recoverUnclaimedMintQuotes();

      expect(result.checked).toBe(0);
      expect(result.recovered).toBe(0);
      expect(result.totalAmountRecovered).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should recover paid unclaimed quotes', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({ state: 'PAID' });
      (completeMint as jest.Mock).mockResolvedValue([{ amount: 1000 }]);

      const result = await recoverUnclaimedMintQuotes();

      expect(result.checked).toBe(1);
      expect(result.recovered).toBe(1);
      expect(result.totalAmountRecovered).toBe(1000);
      expect(completeMint).toHaveBeenCalledWith('quote123', 1000);
    });

    it('should not recover account-tagged quotes before the current account is initialized', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote_tagged',
          amount: 1000,
          depositAddress: 'tb1ptest',
          taprootAddress: 'tb1paccount',
          createdAt: Date.now(),
          state: 'PAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));

      const result = await recoverUnclaimedMintQuotes();

      expect(result.checked).toBe(0);
      expect(result.recovered).toBe(0);
      expect(checkMintQuote).not.toHaveBeenCalled();
      expect(completeMint).not.toHaveBeenCalled();
    });

    it('should recover expired BTC quotes if the mint reports them paid', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote_sat',
          amount: 2500,
          depositAddress: 'tb1ptest',
          createdAt: Date.now() - 25 * 60 * 60 * 1000,
          state: 'UNPAID',
          unit: 'sat',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({
        amount_paid: 2500,
        amount_issued: 0,
      });
      (completeMint as jest.Mock).mockResolvedValue([{ amount: 2500 }]);

      const result = await recoverUnclaimedMintQuotes();

      expect(result.recovered).toBe(1);
      expect(result.totalAmountRecovered).toBe(2500);
      expect(completeMint).toHaveBeenCalledWith('quote_sat', 2500, 'sat');
    });

    it('should recover quotes with available amount even when mint omits state', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({
        amount_paid: 1250,
        amount_issued: 250,
      });
      (completeMint as jest.Mock).mockResolvedValue([{ amount: 1000 }]);

      const result = await recoverUnclaimedMintQuotes();

      expect(result.recovered).toBe(1);
      expect(result.totalAmountRecovered).toBe(1000);
      expect(completeMint).toHaveBeenCalledWith('quote123', 1000);
    });

    it('should recover stale pending quotes instead of skipping them forever', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now() - 3 * 60 * 1000,
          state: 'PENDING',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({
        amount_paid: 1000,
        amount_issued: 0,
      });
      (completeMint as jest.Mock).mockResolvedValue([{ amount: 1000 }]);

      const result = await recoverUnclaimedMintQuotes();

      expect(result.recovered).toBe(1);
      expect(completeMint).toHaveBeenCalledWith('quote123', 1000);
    });

    it('should restore signatures for a persisted claim that was issued before the response was saved', async () => {
      const claimProofs = [{ amount: 1000, secret: 'secret', C: 'C', id: 'keyset1' }];
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now() - 3 * 60 * 1000,
          state: 'PENDING',
          claim: {
            amount: 1000,
            blindingData: [{ amount: 1000, B_: 'B_', r: 'r', secret: 'secret' }],
            keys: { 1000: 'pubkey' },
            keysetId: 'keyset1',
            createdAt: Date.now() - 3 * 60 * 1000,
          },
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({
        state: 'ISSUED',
        amount_paid: 1000,
        amount_issued: 1000,
      });
      (restoreSignatures as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1', C_: 'sig', amount: 1000 }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue(claimProofs);

      const result = await recoverUnclaimedMintQuotes();

      expect(result.recovered).toBe(1);
      expect(restoreSignatures).toHaveBeenCalledWith([
        { amount: 1000, B_: 'B_', id: 'keyset1' },
      ]);
      expect(addProofs).toHaveBeenCalledWith(claimProofs, true, 'unit');
      expect(completeMint).not.toHaveBeenCalled();
    });

    it('should not save a restored BTC claim if the proofs do not total the claim amount', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote_sat',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now() - 3 * 60 * 1000,
          state: 'PENDING',
          unit: 'sat',
          claim: {
            amount: 1000,
            blindingData: [{ amount: 1000, B_: 'B_', r: 'r', secret: 'secret' }],
            keys: { 1000: 'pubkey' },
            keysetId: 'sat-keyset',
            createdAt: Date.now() - 3 * 60 * 1000,
          },
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({
        state: 'ISSUED',
        amount_paid: 1000,
        amount_issued: 1000,
      });
      (restoreSignatures as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'sat-keyset', C_: 'sig', amount: 1000 }],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 500, secret: 'secret', C: 'C', id: 'sat-keyset' },
      ]);

      const result = await recoverUnclaimedMintQuotes();

      expect(result.recovered).toBe(0);
      expect(result.errors[0]).toContain(
        'Recovered mint claim verification failed: expected 1000 but received 500'
      );
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should remove already issued quotes', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({ state: 'ISSUED' });

      await recoverUnclaimedMintQuotes();

      // Should have called setItemAsync to remove the quote
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should update state for unpaid quotes', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'PAID', // Was marked paid but actually unpaid
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({ state: 'UNPAID' });

      await recoverUnclaimedMintQuotes();

      const savedData = JSON.parse(
        (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]
      );
      expect(savedData[0].state).toBe('UNPAID');
    });

    it('should keep expired unpaid quotes for late payment recovery', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'old_unpaid',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now() - 25 * 60 * 60 * 1000,
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({ state: 'UNPAID' });

      await recoverUnclaimedMintQuotes();

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should handle claim errors and increment fail count', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
          failCount: 0,
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({ state: 'PAID' });
      (completeMint as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await recoverUnclaimedMintQuotes();

      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Network error');
    });

    it('should remove quote after max consecutive failures', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
          failCount: 2, // Already failed twice
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({ state: 'PAID' });
      (completeMint as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await recoverUnclaimedMintQuotes();

      expect(result.errors[0]).toContain('REMOVED after 3 failures');
    });

    it('should remove quote on permanent failure (amount mismatch)', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({ state: 'PAID' });
      (completeMint as jest.Mock).mockRejectedValue(new Error('Amount mismatch from mint'));

      const result = await recoverUnclaimedMintQuotes();

      expect(result.errors[0]).toContain('REMOVED');
    });

    it('should remove quote if already claimed error', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockResolvedValue({ state: 'PAID' });
      (completeMint as jest.Mock).mockRejectedValue(new Error('Quote already ISSUED'));

      await recoverUnclaimedMintQuotes();

      // Quote should be removed
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should remove quote if not found error during check', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockRejectedValue(new Error('Quote not found'));

      await recoverUnclaimedMintQuotes();

      // Quote should be removed
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should handle multiple quotes', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote1',
          amount: 1000,
          depositAddress: 'tb1ptest1',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
        {
          quoteId: 'quote2',
          amount: 2000,
          depositAddress: 'tb1ptest2',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock)
        .mockResolvedValueOnce({ state: 'PAID' })
        .mockResolvedValueOnce({ state: 'PAID' });
      (completeMint as jest.Mock)
        .mockResolvedValueOnce([{ amount: 1000 }])
        .mockResolvedValueOnce([{ amount: 2000 }]);

      const result = await recoverUnclaimedMintQuotes();

      expect(result.checked).toBe(2);
      expect(result.recovered).toBe(2);
      expect(result.totalAmountRecovered).toBe(3000);
    });

    it('should add error message to errors array when check fails', async () => {
      const storedQuotes: PersistedMintQuote[] = [
        {
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: 'tb1ptest',
          createdAt: Date.now(),
          state: 'UNPAID',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedQuotes));
      (checkMintQuote as jest.Mock).mockRejectedValue(new Error('Timeout error'));

      const result = await recoverUnclaimedMintQuotes();

      // Should have error in result.errors (line 321)
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('quote123');
      expect(result.errors[0]).toContain('Timeout error');
    });
  });

  describe('clearAllMintQuotes', () => {
    it('should delete all mint quotes', async () => {
      await clearAllMintQuotes();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cashu_pending_mint_quotes');
    });

    it('should handle delete errors gracefully', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('Delete error'));

      await expect(clearAllMintQuotes()).resolves.not.toThrow();
    });
  });
});
