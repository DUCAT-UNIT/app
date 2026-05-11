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
  persistRecoveredSwapSendProofs,
  loadRecoveredOutgoingSwapTokens,
  clearRecoveredOutgoingSwapToken,
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
const mockEncodeToken = jest.fn((_proofs?: unknown, _mintUrl?: unknown) => 'cashuA_mock_token');
const mockSumProofs = jest.fn((proofs: Array<{ amount: number }>) =>
  proofs.reduce((sum, proof) => sum + proof.amount, 0)
);
const mockAddProofs = jest.fn();
const mockLoadProofs = jest.fn();
const mockSaveProofs = jest.fn();
const mockWithProofLock = jest.fn(
  async (fn: (context: { account: string; storageKey: string }) => Promise<unknown>) =>
    fn({ account: 'tb1ptest', storageKey: 'cashu_proofs_tb1ptest' })
);
const mockGetCurrentCashuAccount = jest.fn<string | null, []>(() => null);
const mockRestoreSignatures = jest.fn();
const mockCheckProofsSpent = jest.fn();

// Use jest.mock with factory - mock-prefixed variables are allowed
jest.mock('../crypto', () => ({
  __esModule: true,
  unblindSignatures: (...args: unknown[]) => mockUnblindSignatures(...args),
  encodeToken: (proofs: unknown, mintUrl: unknown) => mockEncodeToken(proofs, mintUrl),
  sumProofs: (proofs: Array<{ amount: number }>) => mockSumProofs(proofs),
}));

jest.mock('../cashuProofManager', () => ({
  __esModule: true,
  addProofs: (...args: unknown[]) => mockAddProofs(...args),
  loadProofs: (...args: unknown[]) => mockLoadProofs(...args),
  loadProofsForStorageKey: (...args: unknown[]) => mockLoadProofs(...args),
  saveProofs: (...args: unknown[]) => mockSaveProofs(...args),
  saveProofsForStorageKey: (proofs: unknown) => mockSaveProofs(proofs),
  withProofLock: (fn: (context: { account: string; storageKey: string }) => Promise<unknown>) =>
    mockWithProofLock(fn),
  getCurrentCashuAccount: () => mockGetCurrentCashuAccount(),
}));

jest.mock('../cashuMintClient', () => ({
  __esModule: true,
  MINT_URL: 'https://mint.test',
  restoreSignatures: (...args: unknown[]) => mockRestoreSignatures(...args),
  checkProofsSpent: (...args: unknown[]) => mockCheckProofsSpent(...args),
  mintRequiresDleqProofs: jest.fn(async () => false),
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
    new1: 'send' as const,
    new2: 'change' as const,
    new3: 'p2pk' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    mockGetCurrentCashuAccount.mockReturnValue(null);
    mockRestoreSignatures.mockRejectedValue(new Error('restore unsupported'));
    mockCheckProofsSpent.mockResolvedValue({
      states: mockInputProofs.map((proof) => ({ Y: proof.secret, state: 'UNSPENT' })),
    });
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
        expect.stringMatching(/^cashu_pending_swap_swap_\d+_/),
        expect.stringContaining('"status":"pending"'),
        expect.any(Object)
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'cashu_pending_swaps_v1',
        expect.stringContaining(id),
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

    it('should not overwrite a corrupt swap registry and should write a legacy fallback', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_swaps_v1') {
          return Promise.resolve('{bad json');
        }
        return Promise.resolve(null);
      });

      const id = await savePendingSwap({
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
      });

      expect(id).toMatch(/^swap_\d+_/);
      expect(
        (SecureStore.setItemAsync as jest.Mock).mock.calls.some(
          ([key]) => key === 'cashu_pending_swaps_v1'
        )
      ).toBe(false);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^cashu_pending_swaps_v1_corrupt_/),
        '{bad json',
        expect.any(Object)
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'cashu_pending_swap',
        expect.stringContaining(id),
        expect.any(Object)
      );
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
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_swap') {
          return Promise.resolve(JSON.stringify(pendingTxn));
        }
        return Promise.resolve(null);
      });

      const swapResponse = {
        signatures: [{ C_: 'sig1', id: 'keyset1', amount: 64 }],
      };

      await updateSwapWithResponse(swapResponse);

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData.status).toBe('swapped');
      expect(savedData.swapResponse).toEqual(swapResponse);
    });

    it('persists the signed keyset needed for crash recovery', async () => {
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
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_swap') {
          return Promise.resolve(JSON.stringify(pendingTxn));
        }
        return Promise.resolve(null);
      });

      const swapResponse = {
        signatures: [{ C_: 'sig1', id: 'rotated-sat-keyset', amount: 64 }],
      };

      await updateSwapWithResponse(swapResponse, undefined, {
        keysetId: 'rotated-sat-keyset',
        keys: { 64: 'rotated-key' },
      });

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData.status).toBe('swapped');
      expect(savedData.keysetId).toBe('rotated-sat-keyset');
      expect(savedData.keys).toEqual({ 64: 'rotated-key' });
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
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_swap') {
          return Promise.resolve(JSON.stringify(pendingTxn));
        }
        return Promise.resolve(null);
      });

      await updateSwapWithResponse({ signatures: [{ C_: 'sig1' }] });

      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should not update an account-tagged pending swap before account initialization', async () => {
      const pendingTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'pending',
        taprootAddress: 'tb1pcurrent',
      };
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_swap') {
          return Promise.resolve(JSON.stringify(pendingTxn));
        }
        return Promise.resolve(null);
      });

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

      await expect(updateSwapWithResponse({ signatures: [] })).rejects.toThrow('Storage error');
    });

    it('keeps a recoverable legacy response if the primary swapped entry write fails', async () => {
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
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_swap_swap_123') {
          return Promise.resolve(JSON.stringify(pendingTxn));
        }
        return Promise.resolve(null);
      });
      (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_swap_swap_123') {
          return Promise.reject(new Error('Primary write failed'));
        }
        return Promise.resolve(undefined);
      });

      const swapResponse = { signatures: [{ C_: 'sig1', id: 'keyset1', amount: 64 }] };

      await expect(updateSwapWithResponse(swapResponse, 'swap_123')).resolves.toBeUndefined();

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'cashu_pending_swap',
        expect.stringContaining('"status":"swapped"'),
        expect.any(Object)
      );
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

    it('should load the latest legacy fallback when the swap registry is corrupt', async () => {
      const pendingTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'swapped',
        swapResponse: {
          signatures: [{ C_: 'sig1', id: 'keyset1', amount: 64 }],
        },
      };
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_swaps_v1') {
          return Promise.resolve('{bad json');
        }
        if (key === 'cashu_pending_swap') {
          return Promise.resolve(JSON.stringify(pendingTxn));
        }
        return Promise.resolve(null);
      });

      const result = await loadPendingSwap();

      expect(result?.id).toBe('swap_123');
      expect(result?.status).toBe('swapped');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^cashu_pending_swaps_v1_corrupt_/),
        '{bad json',
        expect.any(Object)
      );
    });

    it('should not load account-tagged swaps before the current account is initialized', async () => {
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
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_swaps_v1') {
          return Promise.resolve(JSON.stringify(['swap_123']));
        }
        if (key === 'cashu_pending_swap_swap_123') {
          return Promise.resolve(JSON.stringify(pendingTxn));
        }
        return Promise.resolve(null);
      });

      await expect(loadPendingSwap()).resolves.toBeNull();
    });

    it('should keep old pending swaps so recovery can inspect mint state', async () => {
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

      expect(result).not.toBeNull();
      expect(result?.id).toBe(oldTxn.id);
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
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

    it('should clear and return null for pending status when inputs are unspent', async () => {
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
      expect(mockRestoreSignatures).toHaveBeenCalled();
      expect(mockCheckProofsSpent).toHaveBeenCalledWith(mockInputProofs);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    });

    it('should restore an interrupted pending swap before recovering proofs', async () => {
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
      const restoredSignatures = [
        { C_: 'sig1', id: 'keyset1', amount: 64 },
        { C_: 'sig2', id: 'keyset1', amount: 32 },
        { C_: 'sig3', id: 'keyset1', amount: 16 },
      ];

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(pendingTxn));
      mockRestoreSignatures.mockResolvedValue({ signatures: restoredSignatures });
      mockUnblindSignatures.mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C1', id: 'keyset1' },
        { amount: 32, secret: 'new2', C: 'C2', id: 'keyset1' },
        { amount: 16, secret: 'new3', C: 'C3', id: 'keyset1' },
      ]);

      const result = await recoverPendingSwap();

      expect(mockRestoreSignatures).toHaveBeenCalledWith([
        { amount: 64, B_: 'B1', id: 'keyset1' },
        { amount: 32, B_: 'B2', id: 'keyset1' },
        { amount: 16, B_: 'B3', id: 'keyset1' },
      ]);
      expect(mockUnblindSignatures).toHaveBeenCalledWith(
        restoredSignatures,
        mockBlindingData,
        mockKeys,
        'keyset1',
        { requireDleq: false }
      );
      expect(result?.sendProofs).toHaveLength(2);
      expect(result?.changeProofs).toHaveLength(1);
    });

    it('should recover from a swapped legacy fallback when the primary entry is stale pending', async () => {
      const primaryPendingTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: mockBlindingData,
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: mockSecretTypeMap,
        status: 'pending',
      };
      const legacySwappedTxn: PendingSwapTransaction = {
        ...primaryPendingTxn,
        status: 'swapped',
        swapResponse: {
          signatures: [
            { C_: 'sig1', id: 'keyset1', amount: 64 },
            { C_: 'sig2', id: 'keyset1', amount: 32 },
            { C_: 'sig3', id: 'keyset1', amount: 16 },
          ],
        },
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'cashu_pending_swaps_v1') {
          return Promise.resolve(JSON.stringify(['swap_123']));
        }
        if (key === 'cashu_pending_swap_swap_123') {
          return Promise.resolve(JSON.stringify(primaryPendingTxn));
        }
        if (key === 'cashu_pending_swap') {
          return Promise.resolve(JSON.stringify(legacySwappedTxn));
        }
        return Promise.resolve(null);
      });
      mockUnblindSignatures.mockReturnValue([
        { amount: 64, secret: 'new1', C: 'C1', id: 'keyset1' },
        { amount: 32, secret: 'new2', C: 'C2', id: 'keyset1' },
        { amount: 16, secret: 'new3', C: 'C3', id: 'keyset1' },
      ]);

      const result = await recoverPendingSwap();

      expect(mockRestoreSignatures).not.toHaveBeenCalled();
      expect(mockUnblindSignatures).toHaveBeenCalledWith(
        legacySwappedTxn.swapResponse!.signatures,
        mockBlindingData,
        mockKeys,
        'keyset1',
        { requireDleq: false }
      );
      expect(result?.sendProofs).toHaveLength(2);
      expect(result?.changeProofs).toHaveLength(1);
    });

    it('should keep pending swap evidence when restore fails and inputs may be spent', async () => {
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
      mockCheckProofsSpent.mockResolvedValue({
        states: mockInputProofs.map((proof, index) => ({
          Y: proof.secret,
          state: index === 0 ? 'SPENT' : 'UNSPENT',
        })),
      });

      const result = await recoverPendingSwap();

      expect(result).toBeNull();
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
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
        'keyset1'
      );
      expect(result).toEqual({
        recovered: true,
        swapId: 'swap_123',
        taprootAddress: undefined,
        changeProofs: [{ amount: 32, secret: 'new2', C: 'C2', id: 'keyset1' }],
        sendProofs: [
          { amount: 64, secret: 'new1', C: 'C1', id: 'keyset1' },
          { amount: 16, secret: 'new3', C: 'C3', id: 'keyset1' },
        ],
        sendProofKind: 'mixed',
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
        blindingData: [
          { amount: 32, secret: 'new2', r: Buffer.from('r2').toString('hex'), B_: 'B2' },
        ],
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
        'fallback-keyset'
      );
      expect(result?.changeProofs).toEqual([
        { amount: 32, secret: 'new2', C: 'C2', id: 'fallback-keyset' },
      ]);
    });

    it('should reject recovered swaps with unclassified outputs', () => {
      const swappedTxn: PendingSwapTransaction = {
        id: 'swap_123',
        timestamp: Date.now(),
        inputProofs: mockInputProofs,
        blindingData: [
          { amount: 32, secret: 'new2', r: Buffer.from('r2').toString('hex'), B_: 'B2' },
        ],
        keys: mockKeys,
        keysetId: 'keyset1',
        secretTypeMap: {},
        status: 'swapped',
        swapResponse: {
          signatures: [{ C_: 'sig1', id: 'keyset1', amount: 32 }],
        },
      };
      mockUnblindSignatures.mockReturnValue([
        { amount: 32, secret: 'new2', C: 'C2', id: 'keyset1' },
      ]);

      expect(() => recoverSwapProofsFromTransaction(swappedTxn, mockUnblindSignatures)).toThrow(
        'Recovered swap has 1 unclassified outputs'
      );
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
        'Pending swap is not recoverable'
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
        swapId: 'swap_123',
        changeProofs: [{ amount: 64, secret: 'new1', C: 'C1', id: 'keyset1' }],
        sendProofs: [],
        sendProofKind: 'none',
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
        swapId: 'swap_123',
        changeProofs: [{ amount: 64, secret: 'existing_secret', C: 'C1', id: 'keyset1' }],
        sendProofs: [],
        sendProofKind: 'none',
      });

      expect(mockWithProofLock).toHaveBeenCalled();
      expect(mockSaveProofs).not.toHaveBeenCalled();
    });
  });

  describe('outgoing swap token recovery', () => {
    it('persists recovered recipient proofs as an outgoing token', async () => {
      await persistRecoveredSwapSendProofs({
        recovered: true,
        swapId: 'swap_123',
        taprootAddress: 'tb1paccount',
        changeProofs: [],
        sendProofs: [{ amount: 64, secret: 'send1', C: 'C1', id: 'keyset1' }],
        sendProofKind: 'send',
      });

      expect(mockEncodeToken).toHaveBeenCalledWith(
        [{ amount: 64, secret: 'send1', C: 'C1', id: 'keyset1' }],
        expect.any(String)
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'cashu_recovered_outgoing_swap_tokens_v1',
        expect.stringContaining('cashuA_mock_token'),
        expect.any(Object)
      );
    });

    it('loads and clears recovered outgoing tokens', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify([
          {
            id: 'swap_123:outgoing',
            token: 'cashuA_mock_token',
            amount: 64,
            kind: 'send',
            sourceSwapId: 'swap_123',
            createdAt: Date.now(),
          },
        ])
      );

      await expect(loadRecoveredOutgoingSwapTokens()).resolves.toHaveLength(1);
      await clearRecoveredOutgoingSwapToken('cashuA_mock_token');

      expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(
        'cashu_recovered_outgoing_swap_tokens_v1',
        '[]',
        expect.any(Object)
      );
    });

    it('does not load account-tagged outgoing token recovery before account initialization', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify([
          {
            id: 'swap_123:outgoing',
            token: 'cashuBotheraccount',
            amount: 64,
            kind: 'send',
            sourceSwapId: 'swap_123',
            taprootAddress: 'tb1pother',
            createdAt: Date.now(),
          },
          {
            id: 'swap_legacy:outgoing',
            token: 'cashuBlegacy',
            amount: 32,
            kind: 'send',
            sourceSwapId: 'swap_legacy',
            createdAt: Date.now(),
          },
        ])
      );

      await expect(loadRecoveredOutgoingSwapTokens()).resolves.toEqual([
        expect.objectContaining({ token: 'cashuBlegacy' }),
      ]);
    });

    it('quarantines corrupt recovered outgoing token records instead of hiding them', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('{bad json');

      await expect(loadRecoveredOutgoingSwapTokens()).rejects.toThrow();

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^cashu_recovered_outgoing_swap_tokens_v1_corrupt_/),
        '{bad json',
        expect.any(Object)
      );
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
