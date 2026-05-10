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
    cashu: jest.fn(),
  },
}));

jest.mock('../../cashuMintClient', () => ({
  MINT_URL: 'https://mint.test.com',
  swapTokens: jest.fn(),
  mintRequiresDleqProofs: jest.fn(async () => false),
  checkProofsSpent: jest.fn(async (proofs: unknown[]) => ({
    states: proofs.map(() => ({ state: 'UNSPENT' })),
  })),
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
  getCurrentCashuAccount: jest.fn(() => 'tb1paccount'),
}));

const mockSavePendingSwap = jest.fn();
const mockUpdateSwapWithResponse = jest.fn();
const mockClearPendingSwap = jest.fn();
const mockPersistOutgoingSwapToken = jest.fn();

jest.mock('../../cashuSwapRecovery', () => ({
  savePendingSwap: (...args: unknown[]) => mockSavePendingSwap(...args),
  updateSwapWithResponse: (...args: unknown[]) => mockUpdateSwapWithResponse(...args),
  clearPendingSwap: (...args: unknown[]) => mockClearPendingSwap(...args),
  persistOutgoingSwapToken: (...args: unknown[]) => mockPersistOutgoingSwapToken(...args),
}));

import { sendToken } from '../cashuSendToken';
import { MINT_URL, checkProofsSpent, swapTokens } from '../../cashuMintClient';
import {
  createBlindedOutputs,
  unblindSignatures,
  splitAmount,
  sumProofs,
  selectProofsForAmount,
  encodeToken,
} from '../../crypto';
import { getOrFetchKeys, getBalance } from '../../cashuBalanceService';
import {
  loadProofs,
  removeProofs,
  addProofs,
  getCurrentCashuAccount,
} from '../../cashuProofManager';

describe('cashuSendToken', () => {
  let blindedSecretCounter = 0;

  const mockCreateBlindedOutputsFromAmounts = () => {
    blindedSecretCounter = 0;
    (createBlindedOutputs as jest.Mock).mockImplementation(async (amounts: number[]) => ({
      outputs: amounts.map((amount) => ({ amount })),
      blindingData: amounts.map((amount) => ({
        amount,
        secret: `new${++blindedSecretCounter}`,
      })),
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSavePendingSwap.mockResolvedValue('swap-1');
    mockUpdateSwapWithResponse.mockResolvedValue(undefined);
    mockClearPendingSwap.mockResolvedValue(undefined);
    mockPersistOutgoingSwapToken.mockResolvedValue(undefined);
    mockCreateBlindedOutputsFromAmounts();
  });

  describe('sendToken', () => {
    const mockProofs: MockProof[] = [
      { amount: 64, secret: 's1', C: 'C1', id: 'keyset1' },
      { amount: 32, secret: 's2', C: 'C2', id: 'keyset1' },
    ];

    beforeEach(() => {
      (loadProofs as jest.Mock).mockResolvedValue(mockProofs);
      (selectProofsForAmount as jest.Mock).mockReturnValue(mockProofs);
      (sumProofs as jest.Mock).mockReturnValue(96);
      (encodeToken as jest.Mock).mockReturnValue('cashuBtoken...');
      (getCurrentCashuAccount as jest.Mock).mockReturnValue('tb1paccount');
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } }],
      });
      (getBalance as jest.Mock).mockResolvedValue(0);
    });

    it('should send token without change (exact amount)', async () => {
      (sumProofs as jest.Mock).mockReturnValue(64);
      (selectProofsForAmount as jest.Mock).mockReturnValue([mockProofs[0]]);

      const result = await sendToken(64, false);

      expect(result.token).toBe('cashuBtoken...');
      expect(mockPersistOutgoingSwapToken).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'cashuBtoken...',
          amount: 64,
          kind: 'send',
          taprootAddress: 'tb1paccount',
          proofsToRemove: [mockProofs[0]],
        })
      );
      expect(removeProofs).toHaveBeenCalled();
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should journal exact returned-change sends before removing local proofs', async () => {
      (sumProofs as jest.Mock).mockReturnValue(64);
      (selectProofsForAmount as jest.Mock).mockReturnValue([mockProofs[0]]);

      await sendToken(64, true);

      expect(swapTokens).not.toHaveBeenCalled();
      expect(mockPersistOutgoingSwapToken).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'cashuBtoken...',
          amount: 64,
          kind: 'send',
          sourceSwapId: expect.stringMatching(/^direct_send_/),
          proofsToRemove: [mockProofs[0]],
        })
      );
      expect(mockPersistOutgoingSwapToken.mock.invocationCallOrder[0]).toBeLessThan(
        (removeProofs as jest.Mock).mock.invocationCallOrder[0]
      );
    });

    it('should abort before proof mutation if the Cashu account changes mid-send', async () => {
      (getCurrentCashuAccount as jest.Mock)
        .mockReturnValueOnce('account-a')
        .mockReturnValueOnce('account-b');
      (sumProofs as jest.Mock).mockReturnValue(64);
      (selectProofsForAmount as jest.Mock).mockReturnValue([mockProofs[0]]);

      await expect(sendToken(64, false)).rejects.toThrow('Cashu account changed');

      expect(mockPersistOutgoingSwapToken).not.toHaveBeenCalled();
      expect(removeProofs).not.toHaveBeenCalled();
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should send token with change using keyset format', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [
          { id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } },
          { id: 'response_keyset', unit: 'unit', active: true, keys: { 1: 'response-key1' } },
        ],
      });
      // splitAmount is called twice: once for send amounts, once for change
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64]) // send amount
        .mockReturnValueOnce([32]); // change amount
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'keyset1' },
        { amount: 32, secret: 'new2', C: 'C', id: 'keyset1' },
      ]);

      const result = await sendToken(64, true);

      expect(result.token).toBe('cashuBtoken...');
      // Change proof (secret: new2) should be added back
      expect(addProofs).toHaveBeenCalledWith([
        { amount: 32, secret: 'new2', C: 'C', id: 'keyset1' },
      ]);
    });

    it('should preserve send/change labels when denominations interleave after sorting', async () => {
      const selectedProof = { amount: 8, secret: 's8', C: 'C8', id: 'keyset1' };
      (loadProofs as jest.Mock).mockResolvedValue([selectedProof]);
      (selectProofsForAmount as jest.Mock).mockReturnValue([selectedProof]);
      (sumProofs as jest.Mock).mockImplementation((proofs: MockProof[]) =>
        proofs.reduce((total, proof) => total + proof.amount, 0)
      );
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [
          {
            id: 'keyset1',
            unit: 'unit',
            active: true,
            keys: { 1: 'key1', 2: 'key2', 4: 'key4', 8: 'key8' },
          },
        ],
      });
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([1, 4]) // send amount
        .mockReturnValueOnce([1, 2]); // change amount
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}, {}, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 1, secret: 'new1', C: 'C1', id: 'keyset1' },
        { amount: 1, secret: 'new3', C: 'C3', id: 'keyset1' },
        { amount: 2, secret: 'new4', C: 'C4', id: 'keyset1' },
        { amount: 4, secret: 'new2', C: 'C2', id: 'keyset1' },
      ]);

      await sendToken(5, true);

      expect(mockSavePendingSwap).toHaveBeenCalledWith(
        expect.objectContaining({
          secretTypeMap: {
            new1: 'send',
            new2: 'send',
            new3: 'change',
            new4: 'change',
          },
        })
      );
      expect(encodeToken).toHaveBeenCalledWith(
        [
          { amount: 1, secret: 'new1', C: 'C1', id: 'keyset1' },
          { amount: 4, secret: 'new2', C: 'C2', id: 'keyset1' },
        ],
        MINT_URL,
        'unit'
      );
      expect(addProofs).toHaveBeenCalledWith([
        { amount: 1, secret: 'new3', C: 'C3', id: 'keyset1' },
        { amount: 2, secret: 'new4', C: 'C4', id: 'keyset1' },
      ]);
    });

    it('should use active unit keyset keys (line 57)', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1', 2: 'key2' } }],
      });
      (splitAmount as jest.Mock)
        .mockReturnValueOnce([64]) // send amount
        .mockReturnValueOnce([32]); // change amount
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{}, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'keyset1' },
        { amount: 32, secret: 'new2', C: 'C', id: 'keyset1' },
      ]);

      const result = await sendToken(64, true);

      expect(result.token).toBe('cashuBtoken...');
      expect(unblindSignatures).toHaveBeenCalled();
    });

    it('should send sat tokens from the sat proof store and journal sat recovery records', async () => {
      const satProofs: MockProof[] = [
        { amount: 64, secret: 'sat1', C: 'C1', id: 'satset1' },
        { amount: 32, secret: 'sat2', C: 'C2', id: 'satset1' },
      ];
      (loadProofs as jest.Mock).mockResolvedValue(satProofs);
      (selectProofsForAmount as jest.Mock).mockReturnValue(satProofs);
      (sumProofs as jest.Mock).mockImplementation((proofs: MockProof[]) =>
        proofs.reduce((total, proof) => total + proof.amount, 0)
      );
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [
          { id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } },
          { id: 'satset1', unit: 'sat', active: true, keys: { 1: 'satkey1' } },
        ],
      });
      (splitAmount as jest.Mock).mockReturnValueOnce([64]).mockReturnValueOnce([32]);
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'satset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'satset1' },
        { amount: 32, secret: 'new2', C: 'C', id: 'satset1' },
      ]);

      const result = await sendToken(64, true, 'sat');

      expect(result.token).toBe('cashuBtoken...');
      expect(loadProofs).toHaveBeenCalledWith('sat');
      expect(mockSavePendingSwap).toHaveBeenCalledWith(expect.objectContaining({ unit: 'sat' }));
      expect(mockPersistOutgoingSwapToken).toHaveBeenCalledWith(
        expect.objectContaining({ unit: 'sat', token: 'cashuBtoken...', kind: 'send' })
      );
      expect(addProofs).toHaveBeenCalledWith(
        [{ amount: 32, secret: 'new2', C: 'C', id: 'satset1' }],
        true,
        'sat'
      );
      expect(removeProofs).toHaveBeenCalledWith(satProofs, 'sat');
      expect(encodeToken).toHaveBeenCalledWith(
        [{ amount: 64, secret: 'new1', C: 'C', id: 'satset1' }],
        MINT_URL,
        'sat'
      );
      expect(getBalance).toHaveBeenCalledWith(true, 'sat');
    });

    it('should throw error when no keys available', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      // Empty object - no keys, no keysets
      (getOrFetchKeys as jest.Mock).mockResolvedValue({});

      await expect(sendToken(64, true)).rejects.toThrow(
        'No active unit keyset available from mint'
      );
    });

    it('should not create change when returnChange is false', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);

      const result = await sendToken(64, false);

      expect(getOrFetchKeys).toHaveBeenCalled();
      expect(swapTokens).not.toHaveBeenCalled();
    });

    it('should not select P2PK locked proofs for regular token sends', async () => {
      const lockedProof = {
        amount: 64,
        secret: JSON.stringify(['P2PK', { data: 'recipient-pubkey' }]),
        C: 'C-locked',
        id: 'keyset1',
      };
      const unlockedProof = { amount: 64, secret: 's-unlocked', C: 'C-unlocked', id: 'keyset1' };
      (loadProofs as jest.Mock).mockResolvedValue([lockedProof, unlockedProof]);
      (selectProofsForAmount as jest.Mock).mockReturnValue([unlockedProof]);
      (sumProofs as jest.Mock).mockReturnValue(64);

      await sendToken(64, false);

      expect(selectProofsForAmount).toHaveBeenCalledWith([unlockedProof], 64);
      expect(mockPersistOutgoingSwapToken).toHaveBeenCalledWith(
        expect.objectContaining({
          proofsToRemove: [unlockedProof],
        })
      );
      expect(removeProofs).toHaveBeenCalledWith([unlockedProof]);
    });

    it('should fail regular token sends when only P2PK locked proofs are stored', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([
        {
          amount: 64,
          secret: JSON.stringify(['P2PK', { data: 'recipient-pubkey' }]),
          C: 'C-locked',
          id: 'keyset1',
        },
      ]);

      await expect(sendToken(64, false)).rejects.toThrow('No unlocked funds available');

      expect(selectProofsForAmount).not.toHaveBeenCalled();
      expect(mockPersistOutgoingSwapToken).not.toHaveBeenCalled();
      expect(removeProofs).not.toHaveBeenCalled();
    });

    it('should not create change when exact amount selected', async () => {
      (sumProofs as jest.Mock).mockReturnValue(64);
      (selectProofsForAmount as jest.Mock).mockReturnValue([mockProofs[0]]);

      const result = await sendToken(64, true);

      // No swap needed when exact amount
      expect(swapTokens).not.toHaveBeenCalled();
    });

    it('should throw error on swap failure', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [
          { id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } },
          { id: 'response_keyset', unit: 'unit', active: true, keys: { 1: 'response-key1' } },
        ],
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);
      (swapTokens as jest.Mock).mockRejectedValue(new Error('Swap failed'));

      await expect(sendToken(64, true)).rejects.toThrow('Swap failed');
    });

    it('should not write a swap recovery record when selected proofs are not spendable', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValueOnce([64]).mockReturnValueOnce([32]);
      (checkProofsSpent as jest.Mock).mockResolvedValueOnce({
        states: [{ state: 'PENDING' }, { state: 'UNSPENT' }],
      });

      await expect(sendToken(64, true)).rejects.toThrow('Proofs are not spendable');

      expect(mockSavePendingSwap).not.toHaveBeenCalled();
      expect(swapTokens).not.toHaveBeenCalled();
    });

    it('should use keyset ID from signature response when available', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [
          { id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } },
          { id: 'response_keyset', unit: 'unit', active: true, keys: { 1: 'response-key1' } },
        ],
      });
      (splitAmount as jest.Mock).mockReturnValueOnce([64]).mockReturnValueOnce([32]);
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
        'response_keyset',
        { requireDleq: false }
      );
    });

    it('should save change proofs when removeProofs fails after swap', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValueOnce([64]).mockReturnValueOnce([32]);
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'keyset1' },
        { amount: 32, secret: 'new2', C: 'C', id: 'keyset1' },
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
      expect(addProofs).toHaveBeenCalledWith([
        { amount: 32, secret: 'new2', C: 'C', id: 'keyset1' },
      ]);
    });

    it('should throw critical error when both removeProofs and addProofs fail after swap', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValueOnce([64]).mockReturnValueOnce([32]);
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'keyset1' },
        { amount: 32, secret: 'new2', C: 'C', id: 'keyset1' },
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
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValueOnce([64]).mockReturnValueOnce([32]);
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'keyset1' },
        { amount: 32, secret: 'new2', C: 'C', id: 'keyset1' },
      ]);

      // encodeToken fails before local proof mutation
      (removeProofs as jest.Mock).mockResolvedValue(undefined);
      (addProofs as jest.Mock).mockResolvedValue(undefined);
      (encodeToken as jest.Mock).mockImplementation(() => {
        throw new Error('encodeToken failed');
      });

      await expect(sendToken(64, true)).rejects.toThrow('encodeToken failed');

      // Should save change proofs in the outer catch, without a prior proof mutation.
      expect(removeProofs).toHaveBeenCalledTimes(1);
      expect(addProofs).toHaveBeenCalledTimes(1);
    });

    it('should handle failure to save change proofs in outer catch block', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValueOnce([64]).mockReturnValueOnce([32]);
      (swapTokens as jest.Mock).mockResolvedValue({
        signatures: [{ id: 'keyset1' }, {}],
      });
      (unblindSignatures as jest.Mock).mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C', id: 'keyset1' },
        { amount: 32, secret: 'new2', C: 'C', id: 'keyset1' },
      ]);

      // encodeToken fails before local proof mutation; recovery then fails removing proofs.
      (addProofs as jest.Mock).mockResolvedValueOnce(undefined);
      (removeProofs as jest.Mock).mockRejectedValueOnce(new Error('removeProofs failed'));
      (encodeToken as jest.Mock).mockImplementation(() => {
        throw new Error('encodeToken failed');
      });

      await expect(sendToken(64, true)).rejects.toThrow('encodeToken failed');

      // Should still throw the original error even if recovery fails
      expect(removeProofs).toHaveBeenCalledTimes(1);
    });

    it('should not attempt to save change when swap never happened', async () => {
      (sumProofs as jest.Mock).mockReturnValue(96);
      (getOrFetchKeys as jest.Mock).mockResolvedValue({
        keysets: [{ id: 'keyset1', unit: 'unit', active: true, keys: { 1: 'key1' } }],
      });
      (splitAmount as jest.Mock).mockReturnValue([64]);

      // Swap itself fails before completing
      (swapTokens as jest.Mock).mockRejectedValue(new Error('Swap network error'));

      await expect(sendToken(64, true)).rejects.toThrow('Swap network error');

      // Should NOT attempt to save change proofs since swap never completed
      expect(removeProofs).not.toHaveBeenCalled();
      expect(addProofs).not.toHaveBeenCalled();
    });
  });
});
