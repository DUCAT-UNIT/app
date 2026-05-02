/**
 * Tests for cashuSwapRecovery service
 */

import * as SecureStore from 'expo-secure-store';
import {
  savePendingSwap,
  updateSwapWithResponse,
  clearPendingSwap,
  loadPendingSwap,
  persistRecoveredSwapChangeProofs,
  recoverSwapProofsFromTransaction,
  recoverPendingSwap,
  checkAndRecoverSwaps,
  PendingSwapTransaction,
} from '../cashuSwapRecovery';

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

// Mock functions - prefixed with 'mock' to be accessible in jest.mock factory
const mockUnblindSignatures = jest.fn();
const mockAddProofs = jest.fn();
const mockLoadProofs = jest.fn();
const mockSaveProofs = jest.fn();
const mockWithProofLock = jest.fn(async (fn: () => Promise<unknown>) => fn());
const mockGetCurrentCashuAccount = jest.fn<string | null, []>(() => null);

// Use jest.mock with factory - mock-prefixed variables are allowed
jest.mock('../crypto', () => ({
  __esModule: true,
  unblindSignatures: (...args: unknown[]) => mockUnblindSignatures(...args),
}));

jest.mock('../cashuProofManager', () => ({
  __esModule: true,
  addProofs: (...args: unknown[]) => mockAddProofs(...args),
  loadProofs: (...args: unknown[]) => mockLoadProofs(...args),
  saveProofs: (...args: unknown[]) => mockSaveProofs(...args),
  withProofLock: (fn: () => Promise<unknown>) => mockWithProofLock(fn),
  getCurrentCashuAccount: () => mockGetCurrentCashuAccount(),
}));

describe('cashuSwapRecovery', () => {
  const mockInputProofs = [
    { amount: 64, secret: 's1', C: 'C1', id: 'id1' },
    { amount: 32, secret: 's2', C: 'C2', id: 'id2' },
  ];

  const mockBlindingData = [
    { amount: 64, secret: 'new1', r: Buffer.from('r1').toString('hex'), B_: 'B1' },
    { amount: 32, secret: 'new2', r: Buffer.from('r2').toString('hex'), B_: 'B2' },
    { amount: 16, secret: 'new3', r: Buffer.from('r3').toString('hex'), B_: 'B3' },
  ];

  const mockKeys = { '1': 'key1', '2': 'key2' };

  const mockSecretTypeMap = {
    'new1': 'send' as const,
    'new2': 'change' as const,
    'new3': 'p2pk' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    mockGetCurrentCashuAccount.mockReturnValue(null);
  });

  describe('savePendingSwap', () => {
    it('should save pending swap transaction', async () => {
      const id = await savePendingSwap({
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
      });

      expect(id).toMatch(/^swap_\d+_/);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'cashu_pending_swap',
        expect.stringContaining('"status":"pending"'),
        expect.any(Object)
      );
    });

    it('should generate unique IDs', async () => {
      const id1 = await savePendingSwap({
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
      });

      jest.clearAllMocks();

      const id2 = await savePendingSwap({
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
      });

      // IDs should be different (different timestamps and random parts)
      expect(id1).not.toBe(id2);
    });

    it('should throw on storage error', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(
        savePendingSwap({
          inputProofs: mockInputProofs,
          blindingData: mockBlindingData,
          keys: mockKeys,
          keysetId: 'keyset1',
          secretTypeMap: mockSecretTypeMap,
        })
      ).rejects.toThrow('Storage error');
    });
  });

  describe('updateSwapWithResponse', () => {
    it('should update pending swap with response', async () => {
      const pendingTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'pending',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pendingTxn));

      const swapResponse = {
        signatures: [{ C_: 'sig1', id: 'keyset1', amount: 64 }],
      };

      await updateSwapWithResponse(swapResponse);

      const savedData = JSON.parse(
        (SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]
      );
      expect(savedData.status).toBe('swapped');
      expect(savedData.swapResponse).toEqual(swapResponse);
    });

    it('should do nothing if no pending swap', async () => {
      await updateSwapWithResponse({ signatures: [] });

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should not update a pending swap that belongs to a different Cashu account', async () => {
      mockGetCurrentCashuAccount.mockReturnValue('tb1pcurrent');
      const pendingTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'pending',
        taprootAddress: 'tb1pother',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pendingTxn));

      await updateSwapWithResponse({ signatures: [{ C_: 'sig1' }] });

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should throw on storage error', async () => {
      const pendingTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'pending',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pendingTxn));
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(
        updateSwapWithResponse({ signatures: [] })
      ).rejects.toThrow('Storage error');
    });
  });

  describe('clearPendingSwap', () => {
    it('should delete pending swap', async () => {
      await clearPendingSwap();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cashu_pending_swap');
    });

    it('should handle delete errors gracefully', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('Delete error'));

      await expect(clearPendingSwap()).resolves.not.toThrow();
    });
  });

  describe('loadPendingSwap', () => {
    it('should return null if no pending swap', async () => {
      const result = await loadPendingSwap();

      expect(result).toBeNull();
    });

    it('should return pending swap if exists', async () => {
      const pendingTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'pending',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pendingTxn));

      const result = await loadPendingSwap();

      // Note: Buffer objects are serialized to {type: 'Buffer', data: [...]} in JSON
      expect(result).not.toBeNull();
      expect(result?.id).toBe(pendingTxn.id);
      expect(result?.status).toBe(pendingTxn.status);
      expect(result?.inputProofs).toEqual(pendingTxn.inputProofs);
      expect(result?.keys).toEqual(pendingTxn.keys);
    });

    it('should clear and return null if swap is too old (> 1 hour)', async () => {
      const oldTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'pending',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(oldTxn));

      const result = await loadPendingSwap();

      expect(result).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should handle parse errors gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('invalid json');

      const result = await loadPendingSwap();

      expect(result).toBeNull();
    });
  });

  describe('recoverPendingSwap', () => {
    it('should return null if no pending swap', async () => {
      const result = await recoverPendingSwap();

      expect(result).toBeNull();
    });

    it('should clear and return null for pending status', async () => {
      const pendingTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'pending',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pendingTxn));

      const result = await recoverPendingSwap();

      expect(result).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should recover and split proofs from swapped status', () => {
      const swappedTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'swapped',
        swapResponse: {
          signatures: [
            { C_: 'sig1', id: 'keyset1', amount: 64 },
            { C_: 'sig2', id: 'keyset1', amount: 32 },
            { C_: 'sig3', id: 'keyset1', amount: 16 },
          ],
        },
      };
      mockUnblindSignatures.mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C1', id: 'keyset1' },
        { amount: 32, secret: 'new2', C: 'C2', id: 'keyset1' },
        { amount: 16, secret: 'new3', C: 'C3', id: 'keyset1' },
      ]);

      const result = recoverSwapProofsFromTransaction(swappedTxn, mockUnblindSignatures);

      expect(mockUnblindSignatures).toHaveBeenCalledWith(
        swappedTxn.swapResponse!.signatures,
        swappedTxn.blindingData,
        swappedTxn.keys,
        'keyset1',
      );
      expect(result).toEqual({
        recovered: true,
        changeProofs: [{ amount: 32, secret: 'new2', C: 'C2', id: 'keyset1' }],
        sendProofs: [
          { amount: 64, secret: 'new1', C: 'C1', id: 'keyset1' },
          { amount: 16, secret: 'new3', C: 'C3', id: 'keyset1' },
        ],
      });
    });

    it('should return null for swapped status without swapResponse', async () => {
      const swappedTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'swapped',
        // No swapResponse - shouldn't happen but handle gracefully
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(swappedTxn));

      const result = await recoverPendingSwap();

      // Without swapResponse, the 'swapped' && swapResponse condition fails
      // Falls through to the 'completed'/'failed' case which clears and returns null
      expect(result).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should clear and return null for completed status', async () => {
      const completedTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'completed',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(completedTxn));

      const result = await recoverPendingSwap();

      expect(result).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should clear and return null for failed status', async () => {
      const failedTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'failed',
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(failedTxn));

      const result = await recoverPendingSwap();

      expect(result).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should handle recovery errors gracefully', async () => {
      const swappedTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'swapped',
        swapResponse: { signatures: [] },
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(swappedTxn));

      mockUnblindSignatures.mockImplementation(() => {
        throw new Error('Unblind error');
      });

      const result = await recoverPendingSwap();

      expect(result).toBeNull();
    });

    it('should fall back to keysetId when the mint response signature lacks an id', () => {
      const swappedTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'fallback-keyset',
        secretTypeMap: { new2: 'change' },
        status: 'swapped',
        swapResponse: {
          signatures: [{ C_: 'sig1', amount: 32 }],
        },
      };
      mockUnblindSignatures.mockReturnValue([
        { amount: 32, secret: 'new2', C: 'C2', id: 'fallback-keyset' },
      ]);

      const result = recoverSwapProofsFromTransaction(swappedTxn, mockUnblindSignatures);

      expect(mockUnblindSignatures).toHaveBeenCalledWith(
        swappedTxn.swapResponse!.signatures,
        swappedTxn.blindingData,
        swappedTxn.keys,
        'fallback-keyset',
      );
      expect(result?.changeProofs).toEqual([
        { amount: 32, secret: 'new2', C: 'C2', id: 'fallback-keyset' },
      ]);
    });

    it('should reject non-swapped transactions in the pure recovery helper', () => {
      const pendingTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'pending',
      };

      expect(() => recoverSwapProofsFromTransaction(pendingTxn, mockUnblindSignatures)).toThrow(
        'Pending swap is not recoverable',
      );
    });
  });

  describe('persistRecoveredSwapChangeProofs', () => {
    it('should persist recovered non-duplicate change proofs to wallet', async () => {
      mockLoadProofs.mockResolvedValue([
        { amount: 10, secret: 'existing', C: 'Cold', id: 'keyset1' },
      ]);
      mockSaveProofs.mockResolvedValue(undefined);

      await persistRecoveredSwapChangeProofs({
        recovered: true,
        changeProofs: [{ amount: 64, secret: 'new1', C: 'C1', id: 'keyset1' }],
        sendProofs: [],
      });

      expect(mockWithProofLock).toHaveBeenCalled();
      expect(mockSaveProofs).toHaveBeenCalledWith([
        { amount: 10, secret: 'existing', C: 'Cold', id: 'keyset1' },
        { amount: 64, secret: 'new1', C: 'C1', id: 'keyset1' },
      ]);
    });

    it('should skip duplicate recovered change proofs', async () => {
      mockLoadProofs.mockResolvedValue([
        { amount: 64, secret: 'existing_secret', C: 'C1', id: 'keyset1' },
      ]);

      await persistRecoveredSwapChangeProofs({
        recovered: true,
        changeProofs: [{ amount: 64, secret: 'existing_secret', C: 'C1', id: 'keyset1' }],
        sendProofs: [],
      });

      expect(mockWithProofLock).toHaveBeenCalled();
      expect(mockSaveProofs).not.toHaveBeenCalled();
    });
  });

  describe('checkAndRecoverSwaps', () => {
    it('should do nothing if no recovery needed', async () => {
      await checkAndRecoverSwaps();

      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });

    it('should attempt recovery for swapped transactions', async () => {
      const swappedTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: { 'new1': 'change' },
        status: 'swapped',
        swapResponse: {
          signatures: [{ C_: 'sig1', id: 'keyset1', amount: 64 }],
        },
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(swappedTxn));
      mockUnblindSignatures.mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C1', id: 'keyset1' },
      ]);

      await checkAndRecoverSwaps();

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('cashu_pending_swap');
    });


    it('should handle errors gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(checkAndRecoverSwaps()).resolves.not.toThrow();
    });

    it('should absorb proof persistence errors during recovery check', async () => {
      const swappedTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: { new1: 'change' },
        status: 'swapped',
        swapResponse: {
          signatures: [{ C_: 'sig1', id: 'keyset1', amount: 64 }],
        },
      };
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(swappedTxn));
      mockUnblindSignatures.mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C1', id: 'keyset1' },
      ]);
      mockLoadProofs.mockResolvedValue([]);
      mockSaveProofs.mockRejectedValue(new Error('write failed'));

      await expect(checkAndRecoverSwaps()).resolves.not.toThrow();
    });
  });
});
