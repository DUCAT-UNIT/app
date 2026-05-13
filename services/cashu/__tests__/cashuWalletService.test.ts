/**
 * Comprehensive Tests for Cashu Wallet Service
 * Tests all wallet operations before refactoring
 *
 * NOTE: Some functions use dynamic imports (import()) which are difficult to mock in Jest
 * without experimental VM modules. These tests focus on the core logic that can be tested.
 * After refactoring, dynamic imports should be replaced with static imports for better testability.
 */
jest.setTimeout(20000);

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../../utils/logger';
import * as cashuMintClient from '../cashuMintClient';
import * as cashuCrypto from '../crypto';
import * as cashuWalletService from '../cashuWalletService';
import * as cashuP2PK from '../p2pk';
import * as cashuQuoteSigner from '../cashuQuoteSigner';
import * as secureStorageService from '../../secureStorageService';
import * as cashuLockedTokensService from '../cashuLockedTokensService';

// Mock all dependencies
jest.mock('expo-secure-store');
jest.mock('expo-crypto', () => ({
  digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
  getRandomBytes: jest.fn((size: number) => new Uint8Array(size)),
  getRandomBytesAsync: jest.fn(async (size: number) => new Uint8Array(size)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('../../../utils/logger', () => ({
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
jest.mock('../cashuMintClient');
jest.mock('../crypto');
jest.mock('../p2pk');
jest.mock('../cashuQuoteSigner');
jest.mock('../../secureStorageService');
jest.mock('../cashuLockedTokensService');

// Mock cashuCrypto functions that use dynamic imports
jest.mock('../crypto', () => ({
  generateSecret: jest.fn(async () => 'random_secret_' + Math.random()),
  createBlindedMessage: jest.fn(async (secret) => ({
    B_: 'blinded_' + secret,
    r: 'r_' + secret,
  })),
  createBlindedOutputs: jest.fn(),
  unblindSignatures: jest.fn(),
  splitAmount: jest.fn(),
  sumProofs: jest.fn(),
  selectProofsForAmount: jest.fn(),
  encodeToken: jest.fn(),
  decodeToken: jest.fn(),
  decodeTokenMetadata: jest.fn(),
}));

describe('cashuWalletService', () => {
  let mockSecureStorage: Record<string, string>;

  // Test data fixtures
  const mockProofs = [
    { amount: 1, secret: 'secret1', C: 'C1', id: 'keyset1' },
    { amount: 2, secret: 'secret2', C: 'C2', id: 'keyset1' },
    { amount: 4, secret: 'secret3', C: 'C3', id: 'keyset1' },
    { amount: 8, secret: 'secret4', C: 'C4', id: 'keyset1' },
  ];

  const mockP2PKProofs = [
    { amount: 1, secret: '["P2PK",{"nonce":"abc","data":"xyz"}]', C: 'C1', id: 'keyset1' },
    { amount: 2, secret: '["P2PK",{"nonce":"def","data":"uvw"}]', C: 'C2', id: 'keyset1' },
  ];

  const mockKeysetData = {
    keysets: [
      {
        id: 'keyset1',
        unit: 'unit',
        keys: {
          1: 'key1',
          2: 'key2',
          4: 'key4',
          8: 'key8',
        },
      },
    ],
  };

  const mockBlindingData = [
    { amount: 1, secret: 'secret1', r: 'r1', B_: 'B1' },
    { amount: 2, secret: 'secret2', r: 'r2', B_: 'B2' },
  ];

  const mockOutputs = [
    { amount: 1, B_: 'B1', id: 'keyset1' },
    { amount: 2, B_: 'B2', id: 'keyset1' },
  ];

  const mockSignatures = [
    { amount: 1, C_: 'C1', id: 'keyset1' },
    { amount: 2, C_: 'C2', id: 'keyset1' },
  ];

  const testAddress = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';
  const proofStorageKey = `cashu_proofs_${testAddress}`;
  const mintQuoteStorageKey = 'cashu_pending_mint_quotes';
  const expectStoredProofEnvelope = (key: string, proofs: typeof mockProofs) => {
    const proofWrite = (SecureStore.setItemAsync as jest.Mock).mock.calls.find(
      ([storedKey]) => storedKey === key
    );
    expect(proofWrite).toBeDefined();
    expect(JSON.parse(proofWrite![1])).toMatchObject({
      version: 1,
      proofs,
      integrityHash: expect.any(String),
    });
  };

  const seedMintQuoteRecovery = (
    storage: Record<string, string>,
    quoteId: string,
    amount: number
  ) => {
    storage[mintQuoteStorageKey] = JSON.stringify([
      {
        quoteId,
        amount,
        depositAddress: 'tb1pmintdeposit',
        taprootAddress: testAddress,
        createdAt: Date.now(),
        state: 'PAID',
      },
    ]);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (cashuCrypto.sumProofs as jest.Mock).mockReset();
    (cashuCrypto.selectProofsForAmount as jest.Mock).mockReset();
    (cashuCrypto.splitAmount as jest.Mock).mockReset();
    (cashuCrypto.createBlindedOutputs as jest.Mock).mockReset();
    (cashuCrypto.unblindSignatures as jest.Mock).mockReset();
    (cashuCrypto.decodeTokenMetadata as jest.Mock).mockImplementation(
      (token: string) => (cashuCrypto.decodeToken as jest.Mock)(token)
    );

    // Default mock implementations - use storage map for proof integrity hash verification
    mockSecureStorage = {};
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(mockSecureStorage[key] || null)
    );
    (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
      mockSecureStorage[key] = value;
      return Promise.resolve(undefined);
    });
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation((key: string) => {
      delete mockSecureStorage[key];
      return Promise.resolve(undefined);
    });

    // Set current account for tests that need it
    await cashuWalletService.setCurrentAccount(testAddress);

    // Clear all mocks after setCurrentAccount to start fresh
    jest.clearAllMocks();

    // Default: spent check returns one UNSPENT state per proof.
    (cashuMintClient.checkProofsSpent as jest.Mock).mockImplementation(async (proofs: any[]) => ({
      states: proofs.map(() => ({ state: 'UNSPENT' })),
    }));

    (cashuCrypto.sumProofs as jest.Mock).mockImplementation((proofs: any) =>
      proofs.reduce((sum: any, p: any) => sum + p.amount, 0)
    );
    (cashuCrypto.selectProofsForAmount as jest.Mock).mockImplementation((proofs: any, amount: any) => {
      const selected = [];
      let sum = 0;
      for (const proof of proofs) {
        if (sum >= amount) break;
        selected.push(proof);
        sum += proof.amount;
      }
      return selected;
    });
    (cashuCrypto.splitAmount as jest.Mock).mockImplementation((amount: any) => {
      const amounts = [];
      let remaining = amount;
      for (let i = 0; i < 10 && remaining > 0; i++) {
        const power = Math.pow(2, i);
        if (remaining >= power) {
          amounts.push(power);
          remaining -= power;
        }
      }
      return amounts;
    });
    (cashuQuoteSigner.getMintQuoteSigningKey as jest.Mock).mockResolvedValue({
      pubkey: '02' + 'a'.repeat(64),
      privateKey: '1'.repeat(64),
    });
    (cashuQuoteSigner.signMintQuoteOutputs as jest.Mock).mockReturnValue('quotesig');
  });

  describe('Account Management', () => {
    describe('setCurrentAccount', () => {
      it('should set current account and log', async () => {
        const address = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';

        // Reset mocks to see the call from this test
        jest.clearAllMocks();
        await cashuWalletService.setCurrentAccount(address);

        expect(logger.info).toHaveBeenCalledWith('Set current Cashu account', { address });
      });

      it('should migrate global proofs to account-specific storage', async () => {
        const address = 'tb1pnewaddress';
        const oldProofs = JSON.stringify(mockProofs);
        const storage: Record<string, string> = {
          cashu_proofs: oldProofs,
        };

        (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
          return Promise.resolve(storage[key] || null);
        });
        (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
          storage[key] = value;
          return Promise.resolve();
        });
        (SecureStore.deleteItemAsync as jest.Mock).mockImplementation((key: string) => {
          delete storage[key];
          return Promise.resolve();
        });

        await cashuWalletService.setCurrentAccount(address);

        expectStoredProofEnvelope(`cashu_proofs_${address}`, mockProofs);
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cashu_proofs');
      });

      it('should not migrate if account-specific proofs already exist', async () => {
        const address = 'tb1pexisting';

        (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: any) => {
          if (key === 'cashu_proofs') return Promise.resolve(JSON.stringify(mockProofs));
          if (key === `cashu_proofs_${address}`) return Promise.resolve(JSON.stringify(mockProofs));
          return Promise.resolve(null);
        });

        jest.clearAllMocks();
        await cashuWalletService.setCurrentAccount(address);

        // Should not copy or delete
        expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
          expect.stringContaining('cashu_proofs'),
          expect.anything()
        );
      });

      it('should handle migration errors gracefully', async () => {
        const address = 'tb1perror';

        (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

        // Should not throw
        await expect(cashuWalletService.setCurrentAccount(address)).resolves.not.toThrow();

        expect(logger.error).toHaveBeenCalledWith('Failed to migrate global proofs',
          expect.objectContaining({ error: 'Storage error' })
        );
      });
    });
  });

  describe('Proof Storage', () => {
    describe('loadProofs', () => {
      it('should load proofs from storage', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockProofs));

        const result = await cashuWalletService.loadProofs();

        expect(result).toEqual(mockProofs);
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith(`cashu_proofs_${testAddress}`);
      });

      it('should return empty array when no proofs exist', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

        const result = await cashuWalletService.loadProofs();

        expect(result).toEqual([]);
      });

      it('should fail closed on storage errors', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

        await expect(cashuWalletService.loadProofs()).rejects.toThrow('Storage error');

        expect(logger.error).toHaveBeenCalledWith('Failed to load proofs',
          expect.objectContaining({ error: 'Storage error' })
        );
      });

      it('should quarantine corrupted JSON data and fail closed', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('invalid json {');

        await expect(cashuWalletService.loadProofs())
          .rejects.toThrow('Cashu proof storage corrupted: invalid JSON');
      });
    });

    describe('saveProofs', () => {
      it('should save proofs to storage with verification', async () => {
        await cashuWalletService.saveProofs(mockProofs);

        const proofWrite = (SecureStore.setItemAsync as jest.Mock).mock.calls.find(
          ([key]) => key === proofStorageKey
        );
        expect(proofWrite).toBeDefined();
        expect(JSON.parse(proofWrite![1])).toMatchObject({
          version: 1,
          proofs: mockProofs,
        });
        expect(logger.info).toHaveBeenCalledWith('Saved proofs to storage',
          expect.objectContaining({ count: 4 })
        );
      });

      it('should throw error if verification fails', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
          if (key === 'cashu_proof_keys_v1') {
            return Promise.resolve(null);
          }
          if (key === proofStorageKey) {
            return Promise.resolve(JSON.stringify([mockProofs[0]]));
          }
          return Promise.resolve(mockSecureStorage[key] || null);
        });

        await expect(cashuWalletService.saveProofs(mockProofs))
          .rejects.toThrow('Failed to save proofs - verification failed');

        expect(logger.error).toHaveBeenCalledWith('SecureStore write verification failed!',
          expect.objectContaining({
            expected: mockProofs.length,
            actual: 'invalid-envelope',
          })
        );
      });

      it('should handle storage errors', async () => {
        (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
          if (key === proofStorageKey) {
            return Promise.reject(new Error('Storage error'));
          }
          mockSecureStorage[key] = value;
          return Promise.resolve(undefined);
        });

        await expect(cashuWalletService.saveProofs(mockProofs))
          .rejects.toThrow('Storage error');
      });
    });

    describe('addProofs', () => {
      it('should add new proofs to existing proofs', async () => {
        const existing = [mockProofs[0], mockProofs[1]];
        const newProofs = [mockProofs[2], mockProofs[3]];
        const combined = [...existing, ...newProofs];
        mockSecureStorage[proofStorageKey] = JSON.stringify(existing);

        await cashuWalletService.addProofs(newProofs);

        expect(await cashuWalletService.loadProofs()).toEqual(combined);
        expect(logger.info).toHaveBeenCalledWith('Added proofs', { added: 2, total: 4 });
      });

      it('should add proofs to empty wallet', async () => {
        await cashuWalletService.addProofs(mockProofs);

        expect(await cashuWalletService.loadProofs()).toEqual(mockProofs);
      });
    });

    describe('removeProofs', () => {
      it('should remove specified proofs by secret', async () => {
        const toRemove = [mockProofs[1], mockProofs[2]];
        const remaining = [mockProofs[0], mockProofs[3]];
        mockSecureStorage[proofStorageKey] = JSON.stringify(mockProofs);

        await cashuWalletService.removeProofs(toRemove);

        expect(await cashuWalletService.loadProofs()).toEqual(remaining);
        expect(logger.info).toHaveBeenCalledWith('Removed proofs', {
          removed: 2,
          remaining: 2,
        });
      });

      it('should handle removing proofs not in wallet', async () => {
        const toRemove = [{ amount: 16, secret: 'nonexistent', C: 'C5', id: 'keyset1' }];
        mockSecureStorage[proofStorageKey] = JSON.stringify(mockProofs);

        await cashuWalletService.removeProofs(toRemove);

        expect(await cashuWalletService.loadProofs()).toEqual(mockProofs);
      });
    });

    describe('loadProofsPartial', () => {
      it('should load limited number of proofs', async () => {
        const manyProofs = Array.from({ length: 100 }, (_, i) => ({
          amount: 1,
          secret: `secret${i}`,
          C: `C${i}`,
          id: 'keyset1',
        }));

        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(manyProofs));

        const result = await cashuWalletService.loadProofsPartial(25);

        expect(result).toHaveLength(25);
        expect(result).toEqual(manyProofs.slice(0, 25));
      });

      it('should return all proofs if limit exceeds total', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockProofs));

        const result = await cashuWalletService.loadProofsPartial(100);

        expect(result).toEqual(mockProofs);
      });

      it('should return all proofs if limit is null', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockProofs));

        const result = await cashuWalletService.loadProofsPartial(null);

        expect(result).toEqual(mockProofs);
      });

      it('should handle empty storage', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

        const result = await cashuWalletService.loadProofsPartial(10);

        expect(result).toEqual([]);
      });
    });
  });

  describe('Mint Operations', () => {
    describe('requestMint', () => {
      it('should request mint quote', async () => {
        const mockQuote = {
          quote: 'quote123',
          amount: 2355,
          request: 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297',
          expiry: Date.now() + 3600000,
          state: 'UNPAID',
        };

        (cashuMintClient.createMintQuote as jest.Mock).mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.requestMint(1000);

        expect(result).toEqual({
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: mockQuote.request,
          expiry: mockQuote.expiry,
          state: 'UNPAID',
        });
        expect(cashuMintClient.createMintQuote).toHaveBeenCalledWith(
          '02' + 'a'.repeat(64),
          'unit'
        );
      });

      it('should handle mint request errors', async () => {
        (cashuMintClient.createMintQuote as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        await expect(cashuWalletService.requestMint(1000))
          .rejects.toThrow('Network error');

        expect(logger.error).toHaveBeenCalledWith('Failed to request mint',
          expect.objectContaining({ error: 'Network error' })
        );
      });

      it('should handle large amounts', async () => {
        const largeAmount = 1000000;
        (cashuMintClient.createMintQuote as jest.Mock).mockResolvedValueOnce({
          quote: 'quote_large',
          amount: largeAmount,
          request: 'tb1p...',
          expiry: Date.now() + 3600000,
          state: 'UNPAID',
        });

        const result = await cashuWalletService.requestMint(largeAmount);

        expect(result.amount).toBe(largeAmount);
      });
    });

    describe('checkMintStatus', () => {
      it('should check if mint quote is paid', async () => {
        const mockQuote = {
          quote: 'quote123',
          state: 'PAID',
        };

        (cashuMintClient.checkMintQuote as jest.Mock).mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.checkMintStatus('quote123');

        expect(result).toEqual({
          quoteId: 'quote123',
          state: 'PAID',
          paid: true,
          amountPaid: undefined,
          amountIssued: undefined,
          availableAmount: 0,
        });
      });

      it('should recognize ISSUED state as paid but not mintable', async () => {
        const mockQuote = {
          quote: 'quote123',
          state: 'ISSUED',
        };

        (cashuMintClient.checkMintQuote as jest.Mock).mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.checkMintStatus('quote123');

        expect(result.paid).toBe(true);
        expect(result.availableAmount).toBe(0);
      });

      it('should treat amount_paid minus amount_issued as mintable without state', async () => {
        const mockQuote = {
          quote: 'quote123',
          amount_paid: 125,
          amount_issued: 25,
        };

        (cashuMintClient.checkMintQuote as jest.Mock).mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.checkMintStatus('quote123');

        expect(result).toEqual({
          quoteId: 'quote123',
          state: 'PAID',
          paid: true,
          amountPaid: 125,
          amountIssued: 25,
          availableAmount: 100,
        });
      });

      it('should handle unpaid quotes', async () => {
        const mockQuote = {
          quote: 'quote123',
          state: 'UNPAID',
        };

        (cashuMintClient.checkMintQuote as jest.Mock).mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.checkMintStatus('quote123');

        expect(result.paid).toBe(false);
        expect(result.availableAmount).toBe(0);
      });

      it('should handle status check errors', async () => {
        (cashuMintClient.checkMintQuote as jest.Mock).mockRejectedValueOnce(new Error('Quote not found'));

        await expect(cashuWalletService.checkMintStatus('invalid'))
          .rejects.toThrow('Quote not found');
      });
    });

    describe('completeMint', () => {
      beforeEach(() => {
        (cashuMintClient.getKeys as jest.Mock).mockResolvedValue(mockKeysetData);
        (cashuMintClient.checkMintQuote as jest.Mock).mockResolvedValue({
          quote: 'quote123',
          state: 'PAID',
          amount_paid: 3,
          amount_issued: 0,
          pubkey: '02' + 'a'.repeat(64),
        });
        (cashuCrypto.createBlindedOutputs as jest.Mock).mockResolvedValue({
          outputs: mockOutputs,
          blindingData: mockBlindingData,
        });
        (cashuMintClient.mintTokens as jest.Mock).mockResolvedValue({
          signatures: mockSignatures,
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValue(mockProofs.slice(0, 2));
      });

      it('should complete mint and add proofs to wallet', async () => {
        (cashuCrypto.splitAmount as jest.Mock).mockReturnValueOnce([1, 2]);

        const newProofs = mockProofs.slice(0, 2);

        // Use a stateful mock that tracks storage
        const storage: Record<string, string> = {};
        (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
          return Promise.resolve(storage[key] || null);
        });
        (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
          storage[key] = value;
          return Promise.resolve();
        });
        seedMintQuoteRecovery(storage, 'quote123', 3);

        const result = await cashuWalletService.completeMint('quote123', 3);

        expect(cashuCrypto.splitAmount).toHaveBeenCalledWith(3);
        expect(cashuCrypto.createBlindedOutputs).toHaveBeenCalledWith([1, 2], 'keyset1');
        expect(cashuMintClient.mintTokens).toHaveBeenCalledWith('quote123', mockOutputs, 'quotesig');
        expect(cashuCrypto.unblindSignatures).toHaveBeenCalled();
        expect(result).toEqual(newProofs);
      });

      it('should throw error if no unit keyset is available', async () => {
        (cashuMintClient.getKeys as jest.Mock).mockResolvedValueOnce({ keysets: [] });
        seedMintQuoteRecovery(mockSecureStorage, 'quote123', 1000);

        await expect(cashuWalletService.completeMint('quote123', 1000))
          .rejects.toThrow('No active unit keyset available from mint');
      });

      it('should handle mint completion errors', async () => {
        (cashuMintClient.mintTokens as jest.Mock).mockRejectedValueOnce(new Error('Mint error'));
        seedMintQuoteRecovery(mockSecureStorage, 'quote123', 1000);

        await expect(cashuWalletService.completeMint('quote123', 1000))
          .rejects.toThrow('Mint error');
      });

      it('should handle amount splitting correctly', async () => {
        const amount = 15; // 1 + 2 + 4 + 8
        (cashuMintClient.checkMintQuote as jest.Mock).mockResolvedValueOnce({
          quote: 'quote123',
          state: 'PAID',
          amount_paid: amount,
          amount_issued: 0,
          pubkey: '02' + 'a'.repeat(64),
        });
        (cashuCrypto.splitAmount as jest.Mock).mockReturnValueOnce([1, 2, 4, 8]);
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValueOnce(mockProofs);

        // Use a stateful mock that tracks storage
        const storage: Record<string, string> = {};
        (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
          return Promise.resolve(storage[key] || null);
        });
        (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
          storage[key] = value;
          return Promise.resolve();
        });
        seedMintQuoteRecovery(storage, 'quote123', amount);

        await cashuWalletService.completeMint('quote123', amount);

        expect(cashuCrypto.splitAmount).toHaveBeenCalledWith(amount);
      });
    });
  });

  describe('Token Operations', () => {
    describe('receiveToken - Basic Validation', () => {
      it('should reject invalid token format', async () => {
        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue(null);

        await expect(cashuWalletService.receiveToken('invalid'))
          .rejects.toThrow('Invalid token format');
      });

      it('should reject token from different mint', async () => {
        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue({
          mint: 'https://different-mint.com',
          proofs: mockProofs,
          amount: 15,
        });

        await expect(cashuWalletService.receiveToken('token'))
          .rejects.toThrow('Token from different mint');
      });

      it('should reject already received tokens', async () => {
        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue({
          mint: cashuMintClient.MINT_URL,
          proofs: mockProofs,
          amount: 15,
        });

        mockSecureStorage[proofStorageKey] = JSON.stringify(mockProofs);

        await expect(cashuWalletService.receiveToken('token'))
          .rejects.toThrow('Token already received');
      });
    });

    describe('sendToken - Basic Operations', () => {
      beforeEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(mockProofs));
        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValue(mockProofs.slice(0, 2));
        (cashuCrypto.sumProofs as jest.Mock).mockReturnValue(3);
        (cashuCrypto.encodeToken as jest.Mock).mockReturnValue('cashuBeyJ0...');
        (cashuMintClient.getKeys as jest.Mock).mockResolvedValue(mockKeysetData);
      });

      it('should handle insufficient balance', async () => {
        (cashuCrypto.selectProofsForAmount as jest.Mock).mockImplementationOnce(() => {
          throw new Error('Insufficient balance');
        });

        await expect(cashuWalletService.sendToken(1000))
          .rejects.toThrow('Insufficient balance');
      });

      it('should validate amount parameter', async () => {
        await expect(cashuWalletService.sendToken(0))
          .rejects.toThrow();
      });

      it('should handle empty wallet', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

        await expect(cashuWalletService.sendToken(100))
          .rejects.toThrow();
      });
    });
  });

  describe('Melt Operations', () => {
    describe('requestMelt', () => {
      it('should request melt quote', async () => {
        const mockQuote = {
          quote: 'melt123',
          amount: 1000,
          fee_reserve: 10,
        };

        (cashuMintClient.createMeltQuote as jest.Mock).mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.requestMelt('tb1qaddress', 1000);

        expect(result).toEqual({
          quoteId: 'melt123',
          amount: 1000,
          fee: 10,
          total: 1010,
        });
        expect(cashuMintClient.createMeltQuote).toHaveBeenCalledWith('tb1qaddress', 1000);
      });

      it('should handle melt request errors', async () => {
        (cashuMintClient.createMeltQuote as jest.Mock).mockRejectedValueOnce(new Error('Address invalid'));

        await expect(cashuWalletService.requestMelt('invalid', 1000))
          .rejects.toThrow('Address invalid');
      });

      it('should calculate total including fee', async () => {
        const mockQuote = {
          quote: 'melt123',
          amount: 1000,
          fee_reserve: 50,
        };

        (cashuMintClient.createMeltQuote as jest.Mock).mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.requestMelt('tb1qaddress', 1000);

        expect(result.total).toBe(1050);
      });
    });
  });

  describe('Error Handling', () => {
    it('should fail closed on SecureStore failures', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage unavailable'));

      await expect(cashuWalletService.loadProofs()).rejects.toThrow('Storage unavailable');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle network failures in mint operations', async () => {
      (cashuMintClient.createMintQuote as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      await expect(cashuWalletService.requestMint(1000))
        .rejects.toThrow('Network timeout');
    });

    it('should handle invalid keyset data', async () => {
      (cashuMintClient.getKeys as jest.Mock).mockResolvedValue({});
      (cashuMintClient.checkMintQuote as jest.Mock).mockResolvedValue({
        quote: 'quote123',
        state: 'PAID',
        amount_paid: 1000,
        amount_issued: 0,
      });
      seedMintQuoteRecovery(mockSecureStorage, 'quote123', 1000);

      await expect(cashuWalletService.completeMint('quote123', 1000))
        .rejects.toThrow('No active unit keyset available');
    });

    it('should quarantine malformed proof data and fail closed', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('not valid json');

      await expect(cashuWalletService.loadProofs())
        .rejects.toThrow('Cashu proof storage corrupted: invalid JSON');
    });

    it('should handle saveProofs failures', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
        if (key === proofStorageKey) {
          return Promise.reject(new Error('Write failed'));
        }
        mockSecureStorage[key] = value;
        return Promise.resolve(undefined);
      });

      await expect(cashuWalletService.saveProofs(mockProofs))
        .rejects.toThrow('Write failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty proof array', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify([]));

      const result = await cashuWalletService.loadProofs();

      expect(result).toEqual([]);
    });

    it('should handle null values in storage', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await cashuWalletService.loadProofs();

      expect(result).toEqual([]);
    });

    it('should handle very large proof arrays', async () => {
      const manyProofs = Array.from({ length: 10000 }, (_, i) => ({
        amount: 1,
        secret: `secret${i}`,
        C: `C${i}`,
        id: 'keyset1',
      }));

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(manyProofs));

      const result = await cashuWalletService.loadProofs();

      expect(result).toHaveLength(10000);
    });

    it('should handle concurrent operations', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(mockProofs));

      // Multiple concurrent loads
      const [result1, result2, result3] = await Promise.all([
        cashuWalletService.loadProofs(),
        cashuWalletService.loadProofs(),
        cashuWalletService.loadProofs(),
      ]);

      expect(result1).toEqual(mockProofs);
      expect(result2).toEqual(mockProofs);
      expect(result3).toEqual(mockProofs);
    });

    it('should handle account switching', async () => {
      const address1 = 'tb1paddr1';
      const address2 = 'tb1paddr2';
      const proofs1 = mockProofs.slice(0, 2);
      const proofs2 = mockProofs.slice(2, 4);

      await cashuWalletService.setCurrentAccount(address1);

      // Mock for addProofs: load (empty) + verification
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(proofs1));

      await cashuWalletService.addProofs(proofs1);

      await cashuWalletService.setCurrentAccount(address2);

      // Mock for addProofs: load (empty) + verification
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(proofs2));

      await cashuWalletService.addProofs(proofs2);

      // Should use different storage keys
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(`cashu_proofs_${address1}`);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(`cashu_proofs_${address2}`);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full mint flow', async () => {
      // Request mint
      (cashuMintClient.createMintQuote as jest.Mock).mockResolvedValueOnce({
        quote: 'quote1',
        amount: 1000,
        request: 'tb1p...',
        expiry: Date.now() + 3600000,
        state: 'UNPAID',
      });

      const quote = await cashuWalletService.requestMint(1000);
      expect(quote.quoteId).toBe('quote1');

      // Check status
      (cashuMintClient.checkMintQuote as jest.Mock).mockResolvedValueOnce({
        quote: 'quote1',
        state: 'PAID',
      });

      const status = await cashuWalletService.checkMintStatus('quote1');
      expect(status.paid).toBe(true);

      // Complete mint
      (cashuMintClient.checkMintQuote as jest.Mock).mockResolvedValueOnce({
        quote: 'quote1',
        state: 'PAID',
        amount_paid: 15,
        amount_issued: 0,
        pubkey: '02' + 'a'.repeat(64),
      });
      (cashuMintClient.getKeys as jest.Mock).mockResolvedValue(mockKeysetData);
      (cashuCrypto.splitAmount as jest.Mock).mockReturnValueOnce([1, 2, 4, 8]);
      (cashuCrypto.createBlindedOutputs as jest.Mock).mockResolvedValueOnce({
        outputs: mockOutputs,
        blindingData: mockBlindingData,
      });
      (cashuMintClient.mintTokens as jest.Mock).mockResolvedValueOnce({
        signatures: mockSignatures,
      });
      (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValueOnce(mockProofs);

      // Use a stateful mock that tracks storage
      const storage: Record<string, string> = {};
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        return Promise.resolve(storage[key] || null);
      });
      (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
        storage[key] = value;
        return Promise.resolve();
      });
      seedMintQuoteRecovery(storage, 'quote1', 1000);

      const proofs = await cashuWalletService.completeMint('quote1', 1000);
      expect(proofs).toEqual(mockProofs);
    });

    it('should handle full melt flow', async () => {
      // Request melt
      (cashuMintClient.createMeltQuote as jest.Mock).mockResolvedValueOnce({
        quote: 'melt1',
        amount: 500,
        fee_reserve: 5,
      });

      const quote = await cashuWalletService.requestMelt('tb1qaddr', 500);
      expect(quote.quoteId).toBe('melt1');
      expect(quote.total).toBe(505);
    });

    it('should handle account migration on first use', async () => {
      const oldProofs = JSON.stringify(mockProofs);
      const storage: Record<string, string> = {
        cashu_proofs: oldProofs,
      };

      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        return Promise.resolve(storage[key] || null);
      });
      (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
        storage[key] = value;
        return Promise.resolve();
      });
      (SecureStore.deleteItemAsync as jest.Mock).mockImplementation((key: string) => {
        delete storage[key];
        return Promise.resolve();
      });

      await cashuWalletService.setCurrentAccount('tb1pnewaccount');

      expectStoredProofEnvelope('cashu_proofs_tb1pnewaccount', mockProofs);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cashu_proofs');
    });
  });

  // ==================== NEW TESTS FOR REMAINING FUNCTIONS ====================

  describe('Balance Operations', () => {
    describe('getBalance', () => {
      beforeEach(() => {
        (cashuP2PK.isP2PKSecret as jest.Mock).mockImplementation((secret: string) => {
          return typeof secret === 'string' && secret.startsWith('["P2PK"');
        });
        // Reset sumProofs mock implementation for each test
        (cashuCrypto.sumProofs as jest.Mock).mockImplementation((proofs: any) =>
          proofs.reduce((sum: any, p: any) => sum + p.amount, 0)
        );
      });

      it('should calculate balance from regular proofs', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockProofs));

        const balance = await cashuWalletService.getBalance(true);

        expect(balance).toBe(15);
        expect(cashuCrypto.sumProofs).toHaveBeenCalledWith(mockProofs);
      });

      it('should exclude P2PK locked proofs from balance', async () => {
        const mixedProofs = [...mockProofs, ...mockP2PKProofs];
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(mixedProofs));

        const balance = await cashuWalletService.getBalance(true);

        expect(balance).toBe(15);
        expect(cashuP2PK.isP2PKSecret).toHaveBeenCalled();
        // Verify only regular proofs were summed
        expect(cashuCrypto.sumProofs).toHaveBeenCalledWith(mockProofs);
      });

      it('should handle partial load for quick balance estimate', async () => {
        const manyProofs = Array.from({ length: 100 }, (_, i) => ({
          amount: 1,
          secret: `secret${i}`,
          C: `C${i}`,
          id: 'keyset1',
        }));

        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(manyProofs));

        const balance = await cashuWalletService.getBalance(false);

        expect(balance).toBe(25);
        // Should have called sumProofs with only first 25 proofs
        expect(cashuCrypto.sumProofs).toHaveBeenCalledWith(manyProofs.slice(0, 25));
      });

      it('should handle empty wallet', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

        const balance = await cashuWalletService.getBalance(true);

        expect(balance).toBe(0);
      });

      it('should handle wallet with only P2PK locked proofs', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockP2PKProofs));
        (cashuCrypto.sumProofs as jest.Mock).mockReturnValueOnce(0);

        const balance = await cashuWalletService.getBalance(true);

        expect(balance).toBe(0);
        expect(cashuCrypto.sumProofs).toHaveBeenCalledWith([]);
      });
    });
  });

  describe('Token Operations - Full Flow', () => {
    describe('receiveToken - Full Flow', () => {
      beforeEach(() => {
        (cashuP2PK.isP2PKLocked as jest.Mock).mockReturnValue(false);
        (cashuP2PK.isP2PKSecret as jest.Mock).mockReturnValue(false);
        (cashuMintClient.getKeys as jest.Mock).mockResolvedValue(mockKeysetData);
        (cashuCrypto.createBlindedOutputs as jest.Mock).mockResolvedValue({
          outputs: mockOutputs,
          blindingData: mockBlindingData,
        });
        (cashuMintClient.swapTokens as jest.Mock).mockResolvedValue({
          signatures: mockSignatures,
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValue(mockProofs.slice(0, 2));
      });

      it('should receive regular token and add proofs', async () => {
        const tokenString = 'cashuBeyJ0...';
        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue({
          mint: cashuMintClient.MINT_URL,
          proofs: mockProofs.slice(0, 2),
          amount: 3,
        });
        (cashuCrypto.splitAmount as jest.Mock).mockReturnValueOnce([1, 2]);

        const result = await cashuWalletService.receiveToken(tokenString);

        expect(result.amount).toBe(3);
        expect(result.proofCount).toBe(2);
        expect(cashuMintClient.swapTokens).toHaveBeenCalled();
        expect(cashuCrypto.unblindSignatures).toHaveBeenCalled();
      });

      it('should handle P2PK locked tokens for current account', async () => {
        const tokenString = 'cashuBeyJ0...';
        const p2pkProofs = mockP2PKProofs.slice(0, 2);

        (cashuP2PK.isP2PKLocked as jest.Mock).mockReturnValue(true);
        (cashuP2PK.isP2PKSecret as jest.Mock).mockReturnValue(true);
        (cashuP2PK.getP2PKRecipient as jest.Mock).mockReturnValue('02abc123');
        // findAccountForP2PKToken must return privateKey - this is used for signing
        (cashuP2PK.findAccountForP2PKToken as jest.Mock).mockResolvedValue({
          accountIndex: 0,
          publicKey: '02abc123',
          privateKey: 'deadbeef'
        });
        (cashuP2PK.signP2PKProofs as jest.Mock).mockResolvedValue(p2pkProofs);
        (secureStorageService.getCurrentAccount as jest.Mock).mockResolvedValue(0);

        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue({
          mint: cashuMintClient.MINT_URL,
          proofs: p2pkProofs,
          amount: 3,
        });
        (cashuCrypto.splitAmount as jest.Mock).mockReturnValueOnce([1, 2]);

        const result = await cashuWalletService.receiveToken(tokenString);

        expect(result.amount).toBe(3);
        expect(cashuP2PK.signP2PKProofs).toHaveBeenCalledWith(p2pkProofs, 'deadbeef');
      });

      it('should reject P2PK token for wrong account', async () => {
        const tokenString = 'cashuBeyJ0...';

        (cashuP2PK.isP2PKLocked as jest.Mock).mockReturnValue(true);
        (cashuP2PK.getP2PKRecipient as jest.Mock).mockReturnValue('02abc123');
        (cashuP2PK.findAccountForP2PKToken as jest.Mock).mockResolvedValue({ accountIndex: 1, publicKey: '02abc123' });
        (secureStorageService.getCurrentAccount as jest.Mock).mockResolvedValue(0);

        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue({
          mint: cashuMintClient.MINT_URL,
          proofs: mockP2PKProofs,
          amount: 3,
        });

        await expect(cashuWalletService.receiveToken(tokenString))
          .rejects.toThrow('This proof belongs to account 2');
      });
    });

    describe('sendToken - Full Flow', () => {
      beforeEach(() => {
        // Reset sumProofs to default implementation
        (cashuCrypto.sumProofs as jest.Mock).mockImplementation((proofs: any) =>
          proofs.reduce((sum: any, p: any) => sum + p.amount, 0)
        );

        (cashuMintClient.getKeys as jest.Mock).mockResolvedValue(mockKeysetData);
        (cashuCrypto.createBlindedOutputs as jest.Mock).mockResolvedValue({
          outputs: mockOutputs,
          blindingData: mockBlindingData,
        });
        (cashuMintClient.swapTokens as jest.Mock).mockResolvedValue({
          signatures: mockSignatures,
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValue(mockProofs);
        (cashuP2PK.isP2PKSecret as jest.Mock).mockReturnValue(false);
      });

      it('should send token with exact amount (no change)', async () => {
        const selectedProofs = [mockProofs[0], mockProofs[1]]; // 1 + 2 = 3
        mockSecureStorage[proofStorageKey] = JSON.stringify(mockProofs);

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValueOnce(selectedProofs);
        (cashuCrypto.encodeToken as jest.Mock).mockReturnValueOnce('cashuBeyJ0...');

        const result = await cashuWalletService.sendToken(3, false);

        expect(result.token).toBe('cashuBeyJ0...');
        expect(result.amount).toBe(3);
        expect(cashuMintClient.swapTokens).not.toHaveBeenCalled();
      });

      it('should send token with change', async () => {
        const selectedProofs = [mockProofs[0], mockProofs[1], mockProofs[2]]; // 1 + 2 + 4 = 7
        const sendProofs = [mockProofs[0], mockProofs[1]]; // 1 + 2 = 3
        const changeProofs = [mockProofs[2]]; // 4

        // Use map-based storage for integrity hash verification
        const storage: Record<string, string> = {};
        storage[`cashu_proofs_${testAddress}`] = JSON.stringify(mockProofs);
        (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
          Promise.resolve(storage[key] || null)
        );
        (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
          storage[key] = value;
          return Promise.resolve();
        });
        (SecureStore.deleteItemAsync as jest.Mock).mockImplementation((key: string) => {
          delete storage[key];
          return Promise.resolve();
        });

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValueOnce(selectedProofs);
        (cashuCrypto.splitAmount as jest.Mock)
          .mockReturnValueOnce([1, 2])  // send (amounts as jest.Mock)
          .mockReturnValueOnce([4]);     // change amounts
        (cashuCrypto.createBlindedOutputs as jest.Mock)
          .mockResolvedValueOnce({
            outputs: mockOutputs.slice(0, 2),
            blindingData: mockBlindingData.slice(0, 2),
          })
          .mockResolvedValueOnce({
            outputs: [{ amount: 4, B_: 'B3', id: 'keyset1' }],
            blindingData: [{ amount: 4, secret: 'secret3', r: 'r3', B_: 'B3' }],
          });
        (cashuMintClient.swapTokens as jest.Mock).mockResolvedValueOnce({
          signatures: mockSignatures,
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValueOnce([...sendProofs, ...changeProofs]);
        (cashuCrypto.encodeToken as jest.Mock).mockReturnValueOnce('cashuBeyJ0...');

        const result = await cashuWalletService.sendToken(3, true);

        expect(result.token).toBe('cashuBeyJ0...');
        expect(result.amount).toBe(3);
        expect(cashuMintClient.swapTokens).toHaveBeenCalled();
      });

      it('should handle insufficient balance', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockProofs));

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockImplementationOnce(() => {
          throw new Error('Insufficient balance');
        });

        await expect(cashuWalletService.sendToken(1000, true))
          .rejects.toThrow('Insufficient balance');
      });
    });
  });

  describe('Melt Operations - Full Flow', () => {
    beforeEach(() => {
      // Reset sumProofs to default implementation
      (cashuCrypto.sumProofs as jest.Mock).mockImplementation((proofs: any) =>
        proofs.reduce((sum: any, p: any) => sum + p.amount, 0)
      );

      (cashuMintClient.getKeys as jest.Mock).mockResolvedValue(mockKeysetData);
      (cashuCrypto.createBlindedOutputs as jest.Mock).mockResolvedValue({
        outputs: mockOutputs,
        blindingData: mockBlindingData,
      });
      (cashuMintClient.swapTokens as jest.Mock).mockResolvedValue({
        signatures: mockSignatures,
      });
      (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValue(mockProofs);
    });

    describe('completeMelt', () => {
      it('should complete melt with cleanup (exact amount)', async () => {
        const selectedProofs = [mockProofs[0], mockProofs[1], mockProofs[2]]; // 7 units
        mockSecureStorage[proofStorageKey] = JSON.stringify(mockProofs);

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValueOnce(selectedProofs);

        (cashuMintClient.meltTokens as jest.Mock).mockResolvedValueOnce({
          paid: true,
          payment_preimage: 'txid123',
          fee_paid: 0,
        });

        (cashuP2PK.isP2PKSecret as jest.Mock).mockReturnValue(false);

        const result = await cashuWalletService.completeMelt('melt123', 7);

        expect(result.paid).toBe(true);
        expect(result.txid).toBe('txid123');
        expect(cashuMintClient.meltTokens).toHaveBeenCalledWith('melt123', selectedProofs, []);
      });

      it('should pre-swap melt change before completing melt', async () => {
        const selectedProofs = mockProofs; // 15 units total
        const exactMeltProofs = [
          { amount: 1, secret: 'melt1', C: 'Cm1', id: 'keyset1' },
          { amount: 2, secret: 'melt2', C: 'Cm2', id: 'keyset1' },
        ];
        const changeProofs = [
          { amount: 4, secret: 'change4', C: 'Cc4', id: 'keyset1' },
          { amount: 8, secret: 'change8', C: 'Cc8', id: 'keyset1' },
        ];
        const swappedProofs = [...exactMeltProofs, ...changeProofs];

        // Use map-based storage for integrity hash verification
        const storage: Record<string, string> = {};
        storage[`cashu_proofs_${testAddress}`] = JSON.stringify(mockProofs);
        (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
          Promise.resolve(storage[key] || null)
        );
        (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
          storage[key] = value;
          return Promise.resolve();
        });
        (SecureStore.deleteItemAsync as jest.Mock).mockImplementation((key: string) => {
          delete storage[key];
          return Promise.resolve();
        });

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValueOnce(selectedProofs);

        (cashuCrypto.createBlindedOutputs as jest.Mock)
          .mockResolvedValueOnce({
            outputs: [
              { amount: 1, B_: 'Bm1', id: 'keyset1' },
              { amount: 2, B_: 'Bm2', id: 'keyset1' },
            ],
            blindingData: [
              { amount: 1, secret: 'melt1', r: 'rm1', B_: 'Bm1' },
              { amount: 2, secret: 'melt2', r: 'rm2', B_: 'Bm2' },
            ],
          })
          .mockResolvedValueOnce({
            outputs: [
              { amount: 4, B_: 'Bc4', id: 'keyset1' },
              { amount: 8, B_: 'Bc8', id: 'keyset1' },
            ],
            blindingData: [
              { amount: 4, secret: 'change4', r: 'rc4', B_: 'Bc4' },
              { amount: 8, secret: 'change8', r: 'rc8', B_: 'Bc8' },
            ],
          });

        (cashuMintClient.swapTokens as jest.Mock).mockResolvedValueOnce({
          signatures: [
            { amount: 1, C_: 'Cm1', id: 'keyset1' },
            { amount: 2, C_: 'Cm2', id: 'keyset1' },
            { amount: 4, C_: 'Cc4', id: 'keyset1' },
            { amount: 8, C_: 'Cc8', id: 'keyset1' },
          ],
        });

        (cashuMintClient.meltTokens as jest.Mock).mockResolvedValueOnce({
          paid: true,
          payment_preimage: 'txid123',
          fee_paid: 0,
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValueOnce(swappedProofs);

        const result = await cashuWalletService.completeMelt('melt123', 3);

        expect(result.paid).toBe(true);
        expect(result.txid).toBe('txid123');
        expect(cashuMintClient.swapTokens).toHaveBeenCalledWith(selectedProofs, [
          { amount: 1, B_: 'Bm1', id: 'keyset1' },
          { amount: 2, B_: 'Bm2', id: 'keyset1' },
          { amount: 4, B_: 'Bc4', id: 'keyset1' },
          { amount: 8, B_: 'Bc8', id: 'keyset1' },
        ]);
        expect(cashuMintClient.meltTokens).toHaveBeenCalledWith('melt123', exactMeltProofs, []);
      });

      it('should surface melt failure before proof cleanup', async () => {
        const selectedProofs = mockProofs;
        const exactMeltProofs = [
          { amount: 1, secret: 'melt1', C: 'Cm1', id: 'keyset1' },
          { amount: 2, secret: 'melt2', C: 'Cm2', id: 'keyset1' },
        ];
        const swappedProofs = [
          ...exactMeltProofs,
          { amount: 4, secret: 'change4', C: 'Cc4', id: 'keyset1' },
          { amount: 8, secret: 'change8', C: 'Cc8', id: 'keyset1' },
        ];

        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockProofs));

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValueOnce(selectedProofs);
        (cashuCrypto.createBlindedOutputs as jest.Mock)
          .mockResolvedValueOnce({
            outputs: [
              { amount: 1, B_: 'Bm1', id: 'keyset1' },
              { amount: 2, B_: 'Bm2', id: 'keyset1' },
            ],
            blindingData: [
              { amount: 1, secret: 'melt1', r: 'rm1', B_: 'Bm1' },
              { amount: 2, secret: 'melt2', r: 'rm2', B_: 'Bm2' },
            ],
          })
          .mockResolvedValueOnce({
            outputs: [
              { amount: 4, B_: 'Bc4', id: 'keyset1' },
              { amount: 8, B_: 'Bc8', id: 'keyset1' },
            ],
            blindingData: [
              { amount: 4, secret: 'change4', r: 'rc4', B_: 'Bc4' },
              { amount: 8, secret: 'change8', r: 'rc8', B_: 'Bc8' },
            ],
          });
        (cashuMintClient.swapTokens as jest.Mock).mockResolvedValueOnce({
          signatures: [
            { amount: 1, C_: 'Cm1', id: 'keyset1' },
            { amount: 2, C_: 'Cm2', id: 'keyset1' },
            { amount: 4, C_: 'Cc4', id: 'keyset1' },
            { amount: 8, C_: 'Cc8', id: 'keyset1' },
          ],
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValueOnce(swappedProofs);

        (cashuMintClient.meltTokens as jest.Mock).mockRejectedValueOnce(new Error('Melt failed'));

        await expect(cashuWalletService.completeMelt('melt123', 3))
          .rejects.toThrow('Melt failed');

        expect(cashuMintClient.swapTokens).toHaveBeenCalled();
        expect(cashuMintClient.meltTokens).toHaveBeenCalledWith('melt123', exactMeltProofs, []);
      });
    });

    describe('completeMeltWithoutCleanup', () => {
      it('should complete melt without cleanup (no change)', async () => {
        const selectedProofs = mockProofs; // All 4 proofs = 15 units

        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockProofs));

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValueOnce(selectedProofs);

        // Override implementation to return 15 (exact match with totalAmount)
        (cashuCrypto.sumProofs as jest.Mock).mockImplementationOnce(() => 15);

        (cashuMintClient.meltTokens as jest.Mock).mockResolvedValueOnce({
          paid: true,
          payment_preimage: 'txid123',
          fee_paid: 0,
        });

        const result = await cashuWalletService.completeMeltWithoutCleanup('melt123', 15);

        expect(result.paid).toBe(true);
        expect(result.txid).toBe('txid123');
        expect(result.proofsToRemove).toEqual(selectedProofs);
        expect(result.changeProofs).toBeNull();

        expect(cashuMintClient.meltTokens).toHaveBeenCalledWith('melt123', selectedProofs, []);
      });

      it('should pre-swap change and return only exact melt proofs for later cleanup', async () => {
        const selectedProofs = mockProofs;
        const exactMeltProofs = [
          { amount: 1, secret: 'melt1', C: 'Cm1', id: 'keyset1' },
          { amount: 2, secret: 'melt2', C: 'Cm2', id: 'keyset1' },
        ];
        const swappedProofs = [
          ...exactMeltProofs,
          { amount: 4, secret: 'change4', C: 'Cc4', id: 'keyset1' },
          { amount: 8, secret: 'change8', C: 'Cc8', id: 'keyset1' },
        ];

        (SecureStore.getItemAsync as jest.Mock)
          .mockResolvedValueOnce(JSON.stringify(mockProofs))
          .mockResolvedValueOnce(null);

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValueOnce(selectedProofs);
        (cashuCrypto.createBlindedOutputs as jest.Mock)
          .mockResolvedValueOnce({
            outputs: [
              { amount: 1, B_: 'Bm1', id: 'keyset1' },
              { amount: 2, B_: 'Bm2', id: 'keyset1' },
            ],
            blindingData: [
              { amount: 1, secret: 'melt1', r: 'rm1', B_: 'Bm1' },
              { amount: 2, secret: 'melt2', r: 'rm2', B_: 'Bm2' },
            ],
          })
          .mockResolvedValueOnce({
            outputs: [
              { amount: 4, B_: 'Bc4', id: 'keyset1' },
              { amount: 8, B_: 'Bc8', id: 'keyset1' },
            ],
            blindingData: [
              { amount: 4, secret: 'change4', r: 'rc4', B_: 'Bc4' },
              { amount: 8, secret: 'change8', r: 'rc8', B_: 'Bc8' },
            ],
          });
        (cashuMintClient.swapTokens as jest.Mock).mockResolvedValueOnce({
          signatures: [
            { amount: 1, C_: 'Cm1', id: 'keyset1' },
            { amount: 2, C_: 'Cm2', id: 'keyset1' },
            { amount: 4, C_: 'Cc4', id: 'keyset1' },
            { amount: 8, C_: 'Cc8', id: 'keyset1' },
          ],
        });

        (cashuMintClient.meltTokens as jest.Mock).mockResolvedValueOnce({
          paid: true,
          payment_preimage: 'txid123',
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValueOnce(swappedProofs);

        const result = await cashuWalletService.completeMeltWithoutCleanup('melt123', 3);

        expect(result.proofsToRemove).toEqual(exactMeltProofs);
        expect(result.changeProofs).toBeNull();
        expect(cashuMintClient.meltTokens).toHaveBeenCalledWith('melt123', exactMeltProofs, []);
      });
    });

    describe('cleanupMeltProofs', () => {
      it('should remove spent proofs and add change', async () => {
        const proofsToRemove = [mockProofs[0], mockProofs[1]]; // Remove 2 proofs (proof0, proof1)
        const changeProofs = [mockProofs[3]]; // Add 1 proof
        const remaining = [mockProofs[2], mockProofs[3]]; // 2 proofs remaining (proof2, proof3)
        const afterAddChange = [mockProofs[2], mockProofs[3], mockProofs[3]]; // 3 proofs (remaining + changeProofs)

        // Use a stateful mock storage to handle all key reads (including hash keys)
        const mockStorage: Record<string, string> = {
          [`cashu_proofs_${testAddress}`]: JSON.stringify(mockProofs),
        };

        (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
          return Promise.resolve(mockStorage[key] || null);
        });

        (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
        (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
          mockStorage[key] = value;
          return Promise.resolve();
        });

        await cashuWalletService.cleanupMeltProofs(proofsToRemove, changeProofs);

        expect(logger.info).toHaveBeenCalledWith('Cleaned up melt proofs with change', {
          removedCount: 2,  // Removing proof0 and proof1
          changeCount: 1,   // Adding 1 changeProof
        });
      });

      it('should handle cleanup without change', async () => {
        const proofsToRemove = [mockProofs[0]];
        const remaining = mockProofs.slice(1);

        (SecureStore.getItemAsync as jest.Mock)
          .mockResolvedValueOnce(JSON.stringify(mockProofs))
          .mockResolvedValueOnce(JSON.stringify(remaining));

        await cashuWalletService.cleanupMeltProofs(proofsToRemove, '' as any);

        expect(logger.info).toHaveBeenCalledWith('Cleaned up melt proofs', { count: 1 });
      });

      it('should handle empty arrays', async () => {
        (SecureStore.getItemAsync as jest.Mock)
          .mockResolvedValueOnce(JSON.stringify(mockProofs))
          .mockResolvedValueOnce(JSON.stringify(mockProofs));

        await cashuWalletService.cleanupMeltProofs([], '' as any);

        expect(logger.info).toHaveBeenCalledWith('Cleaned up melt proofs', { count: 0 });
      });
    });
  });

  describe('P2PK Operations - Full Flow', () => {
    const recipientPubkey = '02abc123def456';
    const privateKey = 'deadbeef1234567890';

    beforeEach(() => {
      (cashuP2PK.createP2PKSecret as jest.Mock).mockImplementation(async () => {
        const nonce =
          (cashuP2PK.createP2PKSecret as jest.Mock).mock.calls.length === 1 ? 'abc' : 'def';
        return `["P2PK",{"nonce":"${nonce}","data":"02abc123"}]`;
      });
      (cashuP2PK.isP2PKSecret as jest.Mock).mockImplementation((secret: string) => {
        return typeof secret === 'string' && secret.startsWith('["P2PK"');
      });
      (cashuP2PK.signP2PKSecret as jest.Mock).mockResolvedValue({
        signatures: ['sig1'],
      });
      (cashuMintClient.getKeys as jest.Mock).mockResolvedValue(mockKeysetData);
      (cashuCrypto.generateSecret as jest.Mock).mockResolvedValue('normal_secret');
      (cashuCrypto.sumProofs as jest.Mock).mockImplementation((proofs: any) =>
        proofs.reduce((sum: any, p: any) => sum + p.amount, 0)
      );
    });

    describe('sendP2PKToken', () => {
      it('should send P2PK locked token', async () => {
        // Use map-based storage for integrity hash verification
        const storage: Record<string, string> = {};
        storage[`cashu_proofs_${testAddress}`] = JSON.stringify(mockProofs);
        (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
          Promise.resolve(storage[key] || null)
        );
        (SecureStore.setItemAsync as jest.Mock).mockImplementation((key: string, value: string) => {
          storage[key] = value;
          return Promise.resolve();
        });
        (SecureStore.deleteItemAsync as jest.Mock).mockImplementation((key: string) => {
          delete storage[key];
          return Promise.resolve();
        });

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValueOnce(mockProofs.slice(0, 2));

        // Mock sumProofs to return correct values
        (cashuCrypto.sumProofs as jest.Mock).mockReturnValue(3);  // Default for proofsToSend

        (cashuCrypto.splitAmount as jest.Mock).mockReturnValueOnce([1, 2]);
        (cashuCrypto.createBlindedOutputs as jest.Mock).mockResolvedValueOnce({
          outputs: mockOutputs,
          blindingData: mockBlindingData,
        });
        (cashuMintClient.swapTokens as jest.Mock).mockResolvedValueOnce({
          signatures: mockSignatures,
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValueOnce([
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
          { ...mockProofs[1], secret: '["P2PK",{"nonce":"def","data":"02abc123"}]' },
        ]);
        (cashuCrypto.encodeToken as jest.Mock).mockReturnValueOnce('cashuBeyJ0...');

        const result = await cashuWalletService.sendP2PKToken(3, recipientPubkey);

        expect(result.token).toBe('cashuBeyJ0...');
        expect(result.amount).toBe(3);
        expect(cashuP2PK.createP2PKSecret).toHaveBeenCalledWith(recipientPubkey, {});
      });

      it('should include locktime option', async () => {
        const options = { locktime: Date.now() + 86400000 };
        mockSecureStorage[proofStorageKey] = JSON.stringify(mockProofs);

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValueOnce([mockProofs[0], mockProofs[1]]);
        (cashuCrypto.splitAmount as jest.Mock).mockReturnValueOnce([1, 2]);
        (cashuMintClient.swapTokens as jest.Mock).mockResolvedValueOnce({
          signatures: mockSignatures,
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValueOnce([
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
          { ...mockProofs[1], secret: '["P2PK",{"nonce":"def","data":"02abc123"}]' },
        ]);
        (cashuCrypto.encodeToken as jest.Mock).mockReturnValueOnce('cashuBeyJ0...');

        await cashuWalletService.sendP2PKToken(3, recipientPubkey, options);

        expect(cashuP2PK.createP2PKSecret).toHaveBeenCalledWith(recipientPubkey, options);
      });

      it('should include refund pubkey option', async () => {
        const options = { refund: ['03xyz789'] };
        mockSecureStorage[proofStorageKey] = JSON.stringify(mockProofs);

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValueOnce([mockProofs[0], mockProofs[1]]);
        (cashuCrypto.splitAmount as jest.Mock).mockReturnValueOnce([1, 2]);
        (cashuMintClient.swapTokens as jest.Mock).mockResolvedValueOnce({
          signatures: mockSignatures,
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValueOnce([
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
          { ...mockProofs[1], secret: '["P2PK",{"nonce":"def","data":"02abc123"}]' },
        ]);
        (cashuCrypto.encodeToken as jest.Mock).mockReturnValueOnce('cashuBeyJ0...');

        await cashuWalletService.sendP2PKToken(3, recipientPubkey, options);

        expect(cashuP2PK.createP2PKSecret).toHaveBeenCalledWith(recipientPubkey, options);
      });

      it('should handle progress callbacks', async () => {
        const onProgress = jest.fn();
        mockSecureStorage[proofStorageKey] = JSON.stringify(mockProofs);

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockReturnValueOnce([mockProofs[0], mockProofs[1]]);
        (cashuCrypto.splitAmount as jest.Mock).mockReturnValueOnce([1, 2]);
        (cashuMintClient.swapTokens as jest.Mock).mockResolvedValueOnce({
          signatures: mockSignatures,
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValueOnce([
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
          { ...mockProofs[1], secret: '["P2PK",{"nonce":"def","data":"02abc123"}]' },
        ]);
        (cashuCrypto.encodeToken as jest.Mock).mockReturnValueOnce('cashuBeyJ0...');

        await cashuWalletService.sendP2PKToken(3, recipientPubkey, {}, onProgress);

        expect(onProgress).toHaveBeenCalledTimes(4);
        expect(onProgress).toHaveBeenCalledWith(1, 4, 'Selecting proofs');
        expect(onProgress).toHaveBeenCalledWith(4, 4, 'Saving to wallet');
      });

      it('should handle insufficient balance', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockProofs));

        (cashuCrypto.selectProofsForAmount as jest.Mock).mockImplementationOnce(() => {
          throw new Error('Insufficient balance');
        });

        await expect(cashuWalletService.sendP2PKToken(1000, recipientPubkey))
          .rejects.toThrow('Insufficient balance');
      });
    });

    describe('receiveP2PKToken', () => {
      it('should receive and unlock P2PK token', async () => {
        const tokenString = 'cashuBeyJ0...';
        const p2pkProofs = [
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
          { ...mockProofs[1], secret: '["P2PK",{"nonce":"def","data":"02abc123"}]' },
        ];

        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue({
          mint: cashuMintClient.MINT_URL,
          proofs: p2pkProofs,
          amount: 3,
        });

        (cashuCrypto.splitAmount as jest.Mock).mockReturnValueOnce([1, 2]);
        (cashuCrypto.createBlindedOutputs as jest.Mock).mockResolvedValueOnce({
          outputs: mockOutputs,
          blindingData: mockBlindingData,
        });
        (cashuMintClient.swapTokens as jest.Mock).mockResolvedValueOnce({
          signatures: mockSignatures,
        });
        (cashuCrypto.unblindSignatures as jest.Mock).mockReturnValueOnce(mockProofs.slice(0, 2));

        const result = await cashuWalletService.receiveP2PKToken(tokenString, privateKey);

        expect(result.amount).toBe(3);
        expect(result.proofCount).toBe(2);
        expect(cashuP2PK.signP2PKSecret).toHaveBeenCalled();
      });

      it('should handle non-P2PK token error', async () => {
        const tokenString = 'cashuBeyJ0...';

        (cashuP2PK.isP2PKSecret as jest.Mock).mockReturnValue(false);

        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue({
          mint: cashuMintClient.MINT_URL,
          proofs: mockProofs,
          amount: 15,
        });

        await expect(cashuWalletService.receiveP2PKToken(tokenString, privateKey))
          .rejects.toThrow('Token does not contain P2PK locked proofs');
      });

      it('should handle wrong private key (swap fails)', async () => {
        const tokenString = 'cashuBeyJ0...';
        const p2pkProofs = [
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
        ];

        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue({
          mint: cashuMintClient.MINT_URL,
          proofs: p2pkProofs,
          amount: 1,
        });

        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

        (cashuCrypto.splitAmount as jest.Mock).mockReturnValueOnce([1]);
        (cashuCrypto.createBlindedOutputs as jest.Mock).mockResolvedValueOnce({
          outputs: [mockOutputs[0]],
          blindingData: [mockBlindingData[0]],
        });

        (cashuMintClient.swapTokens as jest.Mock).mockRejectedValueOnce(new Error('P2PK verification failed'));

        await expect(cashuWalletService.receiveP2PKToken(tokenString, 'wrongkey'))
          .rejects.toThrow('P2PK verification failed');
      });
    });
  });

  describe('Recovery Operations', () => {
    beforeEach(() => {
      (cashuP2PK.isP2PKSecret as jest.Mock).mockImplementation((secret: string) => {
        return typeof secret === 'string' && secret.startsWith('["P2PK"');
      });
    });

    describe('recoverLockedChange', () => {
      it('should recover locked tokens we can claim', async () => {
        const sentToken = {
          id: 'token1',
          token: 'cashuBeyJ0...',
        };

        const changeProofs = [mockProofs[0], mockProofs[1]];
        const lockedProofs = mockP2PKProofs;

        (cashuLockedTokensService.getSentLockedTokens as jest.Mock).mockResolvedValueOnce([sentToken]);

        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue({
          proofs: [...changeProofs, ...lockedProofs],
        });

        (cashuCrypto.sumProofs as jest.Mock).mockImplementation((proofs: any) =>
          proofs.reduce((sum: any, p: any) => sum + p.amount, 0)
        );

        const result = await cashuWalletService.recoverLockedChange();

        expect(result.recovered).toBe(2);
        expect(result.amount).toBe(3);
        expect(logger.info).toHaveBeenCalledWith('Successfully recovered change proofs', {
          recovered: 2,
          amount: 3,
          unit: 'unit',
        });
      });

      it('should handle no locked tokens', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify([]));
        (cashuLockedTokensService.getSentLockedTokens as jest.Mock).mockResolvedValueOnce([]);

        const result = await cashuWalletService.recoverLockedChange();

        expect(result.recovered).toBe(0);
        expect(result.amount).toBe(0);
        expect(result.message).toContain('No change proofs found');
      });

      it('should handle locked tokens we cannot claim (all P2PK)', async () => {
        const sentToken = {
          id: 'token1',
          token: 'cashuBeyJ0...',
        };

        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify([]));
        (cashuLockedTokensService.getSentLockedTokens as jest.Mock).mockResolvedValueOnce([sentToken]);

        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue({
          proofs: mockP2PKProofs,  // All P2PK, no change
        });

        const result = await cashuWalletService.recoverLockedChange();

        expect(result.recovered).toBe(0);
        expect(result.amount).toBe(0);
      });

      it('should skip tokens already in wallet', async () => {
        const sentToken = {
          id: 'token1',
          token: 'cashuBeyJ0...',
        };

        const changeProofs = [mockProofs[0]];

        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(changeProofs));  // already in wallet
        (cashuLockedTokensService.getSentLockedTokens as jest.Mock).mockResolvedValueOnce([sentToken]);

        (cashuCrypto.decodeToken as jest.Mock).mockReturnValue({
          proofs: changeProofs,
        });

        (cashuCrypto.sumProofs as jest.Mock).mockReturnValueOnce(1);

        const result = await cashuWalletService.recoverLockedChange();

        expect(result.recovered).toBe(0);  // No new proofs added
      });
    });

    describe('removeSpentProofs', () => {
      it('should check proofs and remove spent ones', async () => {
        const allProofs = mockProofs;
        const spentStates = [
          { state: 'SPENT' },
          { state: 'UNSPENT' },
          { state: 'SPENT' },
          { state: 'UNSPENT' },
        ];

        (SecureStore.getItemAsync as jest.Mock)
          .mockResolvedValueOnce(JSON.stringify(allProofs))  // (loadProofs as jest.Mock)
          .mockResolvedValueOnce(JSON.stringify([mockProofs[1], mockProofs[3]]));  // verification

        (cashuMintClient.checkProofsSpent as jest.Mock).mockResolvedValueOnce({
          states: spentStates,
        });

        const result = await cashuWalletService.removeSpentProofs();

        expect(result.removed).toBe(2);
        expect(result.kept).toBe(2);
        expect(cashuMintClient.checkProofsSpent).toHaveBeenCalledWith(allProofs);
      });

      it('should handle no spent proofs', async () => {
        const allProofs = mockProofs;
        const unspentStates = [
          { state: 'UNSPENT' },
          { state: 'UNSPENT' },
          { state: 'UNSPENT' },
          { state: 'UNSPENT' },
        ];

        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(allProofs));

        (cashuMintClient.checkProofsSpent as jest.Mock).mockResolvedValueOnce({
          states: unspentStates,
        });

        const result = await cashuWalletService.removeSpentProofs();

        expect(result.removed).toBe(0);
        expect(result.kept).toBe(4);
        // saveProofs should not be called if no proofs were spent
        expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
      });

      it('should handle empty wallet', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

        const result = await cashuWalletService.removeSpentProofs();

        expect(result.removed).toBe(0);
        expect(result.kept).toBe(0);
        expect(cashuMintClient.checkProofsSpent).not.toHaveBeenCalled();
      });

      it('should handle check error', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockProofs));
        (cashuMintClient.checkProofsSpent as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        await expect(cashuWalletService.removeSpentProofs())
          .rejects.toThrow('Network error');
      });
    });
  });

  describe('Wallet Operations', () => {
    describe('clearWallet', () => {
      it('should clear all proofs and keysets', async () => {
        await cashuWalletService.clearWallet();

        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(`cashu_proofs_${testAddress}`);
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cashu_keysets');
        expect(logger.info).toHaveBeenCalledWith('Wallet cleared', {
          storageKey: `cashu_proofs_${testAddress}`,
        });
      });

      it('should use account-specific storage key', async () => {
        const customAddress = 'tb1pcustomaddress';
        await cashuWalletService.setCurrentAccount(customAddress);
        jest.clearAllMocks();

        await cashuWalletService.clearWallet();

        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(`cashu_proofs_${customAddress}`);
      });

      it('should handle deletion errors gracefully', async () => {
        (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Delete failed'));

        // Should throw the error
        await expect(cashuWalletService.clearWallet())
          .rejects.toThrow('Delete failed');
      });
    });
  });
});
