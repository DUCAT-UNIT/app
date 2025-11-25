/**
 * Comprehensive Tests for Cashu Wallet Service
 * Tests all wallet operations before refactoring
 *
 * NOTE: Some functions use dynamic imports (import()) which are difficult to mock in Jest
 * without experimental VM modules. These tests focus on the core logic that can be tested.
 * After refactoring, dynamic imports should be replaced with static imports for better testability.
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../../utils/logger';
import * as cashuMintClient from '../cashuMintClient';
import * as cashuCrypto from '../crypto';
import * as cashuWalletService from '../cashuWalletService';
import * as cashuP2PK from '../p2pk';
import * as secureStorageService from '../../secureStorageService';
import * as cashuLockedTokensService from '../cashuLockedTokensService';

// Mock all dependencies
jest.mock('expo-secure-store');
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('../cashuMintClient');
jest.mock('../crypto');
jest.mock('../p2pk');
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
}));

describe('cashuWalletService', () => {
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
        unit: 'sat',
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

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set current account for tests that need it
    await cashuWalletService.setCurrentAccount(testAddress);

    // Clear all mocks after setCurrentAccount to start fresh
    jest.clearAllMocks();

    // Default mock implementations - use mockImplementation for flexibility
    SecureStore.getItemAsync.mockImplementation(() => Promise.resolve(null));
    SecureStore.setItemAsync.mockImplementation(() => Promise.resolve(undefined));
    SecureStore.deleteItemAsync.mockImplementation(() => Promise.resolve(undefined));

    cashuCrypto.sumProofs.mockImplementation((proofs) =>
      proofs.reduce((sum, p) => sum + p.amount, 0)
    );
    cashuCrypto.selectProofsForAmount.mockImplementation((proofs, amount) => {
      const selected = [];
      let sum = 0;
      for (const proof of proofs) {
        if (sum >= amount) break;
        selected.push(proof);
        sum += proof.amount;
      }
      return selected;
    });
    cashuCrypto.splitAmount.mockImplementation((amount) => {
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

        SecureStore.getItemAsync.mockImplementation((key) => {
          if (key === 'cashu_proofs') return Promise.resolve(oldProofs);
          if (key === `cashu_proofs_${address}`) return Promise.resolve(null);
          return Promise.resolve(null);
        });

        await cashuWalletService.setCurrentAccount(address);

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          `cashu_proofs_${address}`,
          oldProofs
        );
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cashu_proofs');
      });

      it('should not migrate if account-specific proofs already exist', async () => {
        const address = 'tb1pexisting';

        SecureStore.getItemAsync.mockImplementation((key) => {
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

        SecureStore.getItemAsync.mockRejectedValueOnce(new Error('Storage error'));

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
        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(mockProofs));

        const result = await cashuWalletService.loadProofs();

        expect(result).toEqual(mockProofs);
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith(`cashu_proofs_${testAddress}`);
      });

      it('should return empty array when no proofs exist', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(null);

        const result = await cashuWalletService.loadProofs();

        expect(result).toEqual([]);
      });

      it('should handle storage errors and return empty array', async () => {
        SecureStore.getItemAsync.mockRejectedValueOnce(new Error('Storage error'));

        const result = await cashuWalletService.loadProofs();

        expect(result).toEqual([]);
        expect(logger.error).toHaveBeenCalledWith('Failed to load proofs',
          expect.objectContaining({ error: 'Storage error' })
        );
      });

      it('should handle corrupted JSON data', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce('invalid json {');

        const result = await cashuWalletService.loadProofs();

        expect(result).toEqual([]);
        expect(logger.error).toHaveBeenCalled();
      });
    });

    describe('saveProofs', () => {
      it('should save proofs to storage with verification', async () => {
        const serialized = JSON.stringify(mockProofs);

        // Mock the verification read to return the same data
        SecureStore.getItemAsync.mockResolvedValueOnce(serialized);

        await cashuWalletService.saveProofs(mockProofs);

        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(`cashu_proofs_${testAddress}`);
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          `cashu_proofs_${testAddress}`,
          serialized
        );
        expect(logger.info).toHaveBeenCalledWith('Saved proofs to storage', { count: 4 });
      });

      it('should throw error if verification fails', async () => {
        // Mock verification to return different count
        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify([mockProofs[0]]));

        await expect(cashuWalletService.saveProofs(mockProofs))
          .rejects.toThrow('Failed to save proofs - verification failed');

        expect(logger.error).toHaveBeenCalledWith('SecureStore write verification failed!',
          expect.objectContaining({
            expected: mockProofs.length,
            actual: 1,
          })
        );
      });

      it('should handle storage errors', async () => {
        SecureStore.setItemAsync.mockRejectedValueOnce(new Error('Storage error'));

        await expect(cashuWalletService.saveProofs(mockProofs))
          .rejects.toThrow('Storage error');
      });
    });

    describe('addProofs', () => {
      it('should add new proofs to existing proofs', async () => {
        const existing = [mockProofs[0], mockProofs[1]];
        const newProofs = [mockProofs[2], mockProofs[3]];
        const combined = [...existing, ...newProofs];

        // First call: loadProofs, second call: verification after save
        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(existing))
          .mockResolvedValueOnce(JSON.stringify(combined));

        await cashuWalletService.addProofs(newProofs);

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          `cashu_proofs_${testAddress}`,
          JSON.stringify(combined)
        );
        expect(logger.info).toHaveBeenCalledWith('Added proofs', { added: 2, total: 4 });
      });

      it('should add proofs to empty wallet', async () => {
        // First call: loadProofs (empty), second call: verification after save
        SecureStore.getItemAsync
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(JSON.stringify(mockProofs));

        await cashuWalletService.addProofs(mockProofs);

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          `cashu_proofs_${testAddress}`,
          JSON.stringify(mockProofs)
        );
      });
    });

    describe('removeProofs', () => {
      it('should remove specified proofs by secret', async () => {
        const toRemove = [mockProofs[1], mockProofs[2]];
        const remaining = [mockProofs[0], mockProofs[3]];

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))
          .mockResolvedValueOnce(JSON.stringify(remaining));

        await cashuWalletService.removeProofs(toRemove);

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          `cashu_proofs_${testAddress}`,
          JSON.stringify(remaining)
        );
        expect(logger.info).toHaveBeenCalledWith('Removed proofs', {
          removed: 2,
          remaining: 2,
        });
      });

      it('should handle removing proofs not in wallet', async () => {
        const toRemove = [{ amount: 16, secret: 'nonexistent', C: 'C5', id: 'keyset1' }];

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))
          .mockResolvedValueOnce(JSON.stringify(mockProofs));

        await cashuWalletService.removeProofs(toRemove);

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          `cashu_proofs_${testAddress}`,
          JSON.stringify(mockProofs)
        );
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

        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(manyProofs));

        const result = await cashuWalletService.loadProofsPartial(25);

        expect(result).toHaveLength(25);
        expect(result).toEqual(manyProofs.slice(0, 25));
      });

      it('should return all proofs if limit exceeds total', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(mockProofs));

        const result = await cashuWalletService.loadProofsPartial(100);

        expect(result).toEqual(mockProofs);
      });

      it('should return all proofs if limit is null', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(mockProofs));

        const result = await cashuWalletService.loadProofsPartial(null);

        expect(result).toEqual(mockProofs);
      });

      it('should handle empty storage', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(null);

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
          amount: 1000,
          request: 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297',
          expiry: Date.now() + 3600000,
          state: 'UNPAID',
        };

        cashuMintClient.createMintQuote.mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.requestMint(1000);

        expect(result).toEqual({
          quoteId: 'quote123',
          amount: 1000,
          depositAddress: mockQuote.request,
          expiry: mockQuote.expiry,
          state: 'UNPAID',
        });
        expect(cashuMintClient.createMintQuote).toHaveBeenCalledWith(1000);
      });

      it('should handle mint request errors', async () => {
        cashuMintClient.createMintQuote.mockRejectedValueOnce(new Error('Network error'));

        await expect(cashuWalletService.requestMint(1000))
          .rejects.toThrow('Network error');

        expect(logger.error).toHaveBeenCalledWith('Failed to request mint',
          expect.objectContaining({ error: 'Network error' })
        );
      });

      it('should handle large amounts', async () => {
        const largeAmount = 1000000;
        cashuMintClient.createMintQuote.mockResolvedValueOnce({
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

        cashuMintClient.checkMintQuote.mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.checkMintStatus('quote123');

        expect(result).toEqual({
          quoteId: 'quote123',
          state: 'PAID',
          paid: true,
        });
      });

      it('should recognize ISSUED state as paid', async () => {
        const mockQuote = {
          quote: 'quote123',
          state: 'ISSUED',
        };

        cashuMintClient.checkMintQuote.mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.checkMintStatus('quote123');

        expect(result.paid).toBe(true);
      });

      it('should handle unpaid quotes', async () => {
        const mockQuote = {
          quote: 'quote123',
          state: 'UNPAID',
        };

        cashuMintClient.checkMintQuote.mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.checkMintStatus('quote123');

        expect(result.paid).toBe(false);
      });

      it('should handle status check errors', async () => {
        cashuMintClient.checkMintQuote.mockRejectedValueOnce(new Error('Quote not found'));

        await expect(cashuWalletService.checkMintStatus('invalid'))
          .rejects.toThrow('Quote not found');
      });
    });

    describe('completeMint', () => {
      beforeEach(() => {
        cashuMintClient.getKeys.mockResolvedValue(mockKeysetData);
        cashuCrypto.createBlindedOutputs.mockResolvedValue({
          outputs: mockOutputs,
          blindingData: mockBlindingData,
        });
        cashuMintClient.mintTokens.mockResolvedValue({
          signatures: mockSignatures,
        });
        cashuCrypto.unblindSignatures.mockReturnValue(mockProofs.slice(0, 2));
      });

      it('should complete mint and add proofs to wallet', async () => {
        cashuCrypto.splitAmount.mockReturnValueOnce([1, 2]);

        const newProofs = mockProofs.slice(0, 2);
        // Mock sequence:
        // 1. getOrFetchKeys checks for cached keys (KEYSETS_KEY)
        // 2. loadProofs reads current proofs
        // 3. saveProofs verification reads back saved proofs
        SecureStore.getItemAsync
          .mockResolvedValueOnce(null)  // getOrFetchKeys: no cached keys
          .mockResolvedValueOnce(JSON.stringify([]))  // loadProofs: empty wallet
          .mockResolvedValueOnce(JSON.stringify(newProofs));  // verification: new proofs saved

        const result = await cashuWalletService.completeMint('quote123', 3);

        expect(cashuCrypto.splitAmount).toHaveBeenCalledWith(3);
        expect(cashuCrypto.createBlindedOutputs).toHaveBeenCalledWith([1, 2], 'keyset1');
        expect(cashuMintClient.mintTokens).toHaveBeenCalledWith('quote123', mockOutputs);
        expect(cashuCrypto.unblindSignatures).toHaveBeenCalled();
        expect(result).toEqual(newProofs);
      });

      it('should throw error if no keysets available', async () => {
        cashuMintClient.getKeys.mockResolvedValueOnce({ keysets: [] });

        await expect(cashuWalletService.completeMint('quote123', 1000))
          .rejects.toThrow('No keysets available from mint');
      });

      it('should handle mint completion errors', async () => {
        cashuMintClient.mintTokens.mockRejectedValueOnce(new Error('Mint error'));

        await expect(cashuWalletService.completeMint('quote123', 1000))
          .rejects.toThrow('Mint error');
      });

      it('should handle amount splitting correctly', async () => {
        const amount = 15; // 1 + 2 + 4 + 8
        cashuCrypto.splitAmount.mockReturnValueOnce([1, 2, 4, 8]);

        const newProofs = mockProofs.slice(0, 2);
        // Mock sequence: getOrFetchKeys + loadProofs + verification
        SecureStore.getItemAsync
          .mockResolvedValueOnce(null)  // getOrFetchKeys: no cached keys
          .mockResolvedValueOnce(JSON.stringify([]))  // loadProofs: empty wallet
          .mockResolvedValueOnce(JSON.stringify(newProofs));  // verification: new proofs saved

        await cashuWalletService.completeMint('quote123', amount);

        expect(cashuCrypto.splitAmount).toHaveBeenCalledWith(amount);
      });
    });
  });

  describe('Token Operations', () => {
    describe('receiveToken - Basic Validation', () => {
      it('should reject invalid token format', async () => {
        cashuCrypto.decodeToken.mockReturnValueOnce(null);

        await expect(cashuWalletService.receiveToken('invalid'))
          .rejects.toThrow('Invalid token format');
      });

      it('should reject token from different mint', async () => {
        cashuCrypto.decodeToken.mockReturnValueOnce({
          mint: 'https://different-mint.com',
          proofs: mockProofs,
          amount: 15,
        });

        await expect(cashuWalletService.receiveToken('token'))
          .rejects.toThrow('Token from different mint');
      });

      it('should reject already received tokens', async () => {
        cashuCrypto.decodeToken.mockReturnValueOnce({
          mint: cashuMintClient.MINT_URL,
          proofs: mockProofs,
          amount: 15,
        });

        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(mockProofs));

        await expect(cashuWalletService.receiveToken('token'))
          .rejects.toThrow('Token already received');
      });
    });

    describe('sendToken - Basic Operations', () => {
      beforeEach(() => {
        SecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mockProofs));
        cashuCrypto.selectProofsForAmount.mockReturnValue(mockProofs.slice(0, 2));
        cashuCrypto.sumProofs.mockReturnValue(3);
        cashuCrypto.encodeToken.mockReturnValue('cashuAeyJ0...');
        cashuMintClient.getKeys.mockResolvedValue(mockKeysetData);
      });

      it('should handle insufficient balance', async () => {
        cashuCrypto.selectProofsForAmount.mockImplementationOnce(() => {
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
        SecureStore.getItemAsync.mockResolvedValueOnce(null);

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

        cashuMintClient.createMeltQuote.mockResolvedValueOnce(mockQuote);

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
        cashuMintClient.createMeltQuote.mockRejectedValueOnce(new Error('Address invalid'));

        await expect(cashuWalletService.requestMelt('invalid', 1000))
          .rejects.toThrow('Address invalid');
      });

      it('should calculate total including fee', async () => {
        const mockQuote = {
          quote: 'melt123',
          amount: 1000,
          fee_reserve: 50,
        };

        cashuMintClient.createMeltQuote.mockResolvedValueOnce(mockQuote);

        const result = await cashuWalletService.requestMelt('tb1qaddress', 1000);

        expect(result.total).toBe(1050);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle SecureStore failures gracefully', async () => {
      SecureStore.getItemAsync.mockRejectedValue(new Error('Storage unavailable'));

      const result = await cashuWalletService.loadProofs();

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle network failures in mint operations', async () => {
      cashuMintClient.createMintQuote.mockRejectedValue(new Error('Network timeout'));

      await expect(cashuWalletService.requestMint(1000))
        .rejects.toThrow('Network timeout');
    });

    it('should handle invalid keyset data', async () => {
      cashuMintClient.getKeys.mockResolvedValue({});

      await expect(cashuWalletService.completeMint('quote123', 1000))
        .rejects.toThrow('No keysets available');
    });

    it('should handle malformed proof data', async () => {
      SecureStore.getItemAsync.mockResolvedValueOnce('not valid json');

      const result = await cashuWalletService.loadProofs();

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle saveProofs failures', async () => {
      SecureStore.setItemAsync.mockRejectedValueOnce(new Error('Write failed'));

      await expect(cashuWalletService.saveProofs(mockProofs))
        .rejects.toThrow('Write failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty proof array', async () => {
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify([]));

      const result = await cashuWalletService.loadProofs();

      expect(result).toEqual([]);
    });

    it('should handle null values in storage', async () => {
      SecureStore.getItemAsync.mockResolvedValue(null);

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

      SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(manyProofs));

      const result = await cashuWalletService.loadProofs();

      expect(result).toHaveLength(10000);
    });

    it('should handle concurrent operations', async () => {
      SecureStore.getItemAsync.mockResolvedValue(JSON.stringify(mockProofs));

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
      SecureStore.getItemAsync
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(proofs1));

      await cashuWalletService.addProofs(proofs1);

      await cashuWalletService.setCurrentAccount(address2);

      // Mock for addProofs: load (empty) + verification
      SecureStore.getItemAsync
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
      cashuMintClient.createMintQuote.mockResolvedValueOnce({
        quote: 'quote1',
        amount: 1000,
        request: 'tb1p...',
        expiry: Date.now() + 3600000,
        state: 'UNPAID',
      });

      const quote = await cashuWalletService.requestMint(1000);
      expect(quote.quoteId).toBe('quote1');

      // Check status
      cashuMintClient.checkMintQuote.mockResolvedValueOnce({
        quote: 'quote1',
        state: 'PAID',
      });

      const status = await cashuWalletService.checkMintStatus('quote1');
      expect(status.paid).toBe(true);

      // Complete mint
      cashuMintClient.getKeys.mockResolvedValue(mockKeysetData);
      cashuCrypto.splitAmount.mockReturnValueOnce([1, 2, 4, 8]);
      cashuCrypto.createBlindedOutputs.mockResolvedValueOnce({
        outputs: mockOutputs,
        blindingData: mockBlindingData,
      });
      cashuMintClient.mintTokens.mockResolvedValueOnce({
        signatures: mockSignatures,
      });
      cashuCrypto.unblindSignatures.mockReturnValueOnce(mockProofs);

      // Mock sequence: getOrFetchKeys + loadProofs + verification
      SecureStore.getItemAsync
        .mockResolvedValueOnce(null)  // getOrFetchKeys: no cached keys
        .mockResolvedValueOnce(JSON.stringify([]))  // loadProofs: empty wallet
        .mockResolvedValueOnce(JSON.stringify(mockProofs));  // verification: proofs saved

      const proofs = await cashuWalletService.completeMint('quote1', 1000);
      expect(proofs).toEqual(mockProofs);
    });

    it('should handle full melt flow', async () => {
      // Request melt
      cashuMintClient.createMeltQuote.mockResolvedValueOnce({
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

      SecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'cashu_proofs') return Promise.resolve(oldProofs);
        return Promise.resolve(null);
      });

      await cashuWalletService.setCurrentAccount('tb1pnewaccount');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'cashu_proofs_tb1pnewaccount',
        oldProofs
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cashu_proofs');
    });
  });

  // ==================== NEW TESTS FOR REMAINING FUNCTIONS ====================

  describe('Balance Operations', () => {
    describe('getBalance', () => {
      beforeEach(() => {
        cashuP2PK.isP2PKSecret.mockImplementation((secret) => {
          return typeof secret === 'string' && secret.startsWith('["P2PK"');
        });
        // Reset sumProofs mock implementation for each test
        cashuCrypto.sumProofs.mockImplementation((proofs) =>
          proofs.reduce((sum, p) => sum + p.amount, 0)
        );
      });

      it('should calculate balance from regular proofs', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(mockProofs));

        const balance = await cashuWalletService.getBalance(true);

        expect(balance).toBe(15);
        expect(cashuCrypto.sumProofs).toHaveBeenCalledWith(mockProofs);
      });

      it('should exclude P2PK locked proofs from balance', async () => {
        const mixedProofs = [...mockProofs, ...mockP2PKProofs];
        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(mixedProofs));

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

        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(manyProofs));

        const balance = await cashuWalletService.getBalance(false);

        expect(balance).toBe(25);
        // Should have called sumProofs with only first 25 proofs
        expect(cashuCrypto.sumProofs).toHaveBeenCalledWith(manyProofs.slice(0, 25));
      });

      it('should handle empty wallet', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(null);

        const balance = await cashuWalletService.getBalance(true);

        expect(balance).toBe(0);
      });

      it('should handle wallet with only P2PK locked proofs', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(mockP2PKProofs));
        cashuCrypto.sumProofs.mockReturnValueOnce(0);

        const balance = await cashuWalletService.getBalance(true);

        expect(balance).toBe(0);
        expect(cashuCrypto.sumProofs).toHaveBeenCalledWith([]);
      });
    });
  });

  describe('Token Operations - Full Flow', () => {
    describe('receiveToken - Full Flow', () => {
      beforeEach(() => {
        cashuP2PK.isP2PKLocked.mockReturnValue(false);
        cashuP2PK.isP2PKSecret.mockReturnValue(false);
        cashuMintClient.getKeys.mockResolvedValue(mockKeysetData);
        cashuCrypto.createBlindedOutputs.mockResolvedValue({
          outputs: mockOutputs,
          blindingData: mockBlindingData,
        });
        cashuMintClient.swapTokens.mockResolvedValue({
          signatures: mockSignatures,
        });
        cashuCrypto.unblindSignatures.mockReturnValue(mockProofs.slice(0, 2));
      });

      it('should receive regular token and add proofs', async () => {
        const tokenString = 'cashuAeyJ0...';
        cashuCrypto.decodeToken.mockReturnValueOnce({
          mint: cashuMintClient.MINT_URL,
          proofs: mockProofs.slice(0, 2),
          amount: 3,
        });
        cashuCrypto.splitAmount.mockReturnValueOnce([1, 2]);

        // Mock sequence: loadProofs (check duplicates), getOrFetchKeys, loadProofs (add), verification
        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify([]))  // loadProofs: check duplicates
          .mockResolvedValueOnce(null)  // getOrFetchKeys: no cached keys
          .mockResolvedValueOnce(JSON.stringify([]))  // loadProofs: empty wallet
          .mockResolvedValueOnce(JSON.stringify(mockProofs.slice(0, 2)));  // verification

        const result = await cashuWalletService.receiveToken(tokenString);

        expect(result.amount).toBe(3);
        expect(result.proofCount).toBe(2);
        expect(cashuMintClient.swapTokens).toHaveBeenCalled();
        expect(cashuCrypto.unblindSignatures).toHaveBeenCalled();
      });

      it('should handle P2PK locked tokens for current account', async () => {
        const tokenString = 'cashuAeyJ0...';
        const p2pkProofs = mockP2PKProofs.slice(0, 2);

        cashuP2PK.isP2PKLocked.mockReturnValue(true);
        cashuP2PK.isP2PKSecret.mockReturnValue(true);
        cashuP2PK.getP2PKRecipient.mockReturnValue('02abc123');
        cashuP2PK.findAccountForP2PKToken.mockResolvedValue({ accountIndex: 0, publicKey: '02abc123' });
        cashuP2PK.getP2PKPrivateKey.mockResolvedValue('deadbeef');
        cashuP2PK.signP2PKProofs.mockResolvedValue(p2pkProofs);
        secureStorageService.getCurrentAccount.mockResolvedValue(0);

        cashuCrypto.decodeToken.mockReturnValueOnce({
          mint: cashuMintClient.MINT_URL,
          proofs: p2pkProofs,
          amount: 3,
        });
        cashuCrypto.splitAmount.mockReturnValueOnce([1, 2]);

        // Mock sequence
        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify([]))  // loadProofs: check duplicates
          .mockResolvedValueOnce(null)  // getOrFetchKeys: no cached keys
          .mockResolvedValueOnce(JSON.stringify([]))  // loadProofs: empty wallet
          .mockResolvedValueOnce(JSON.stringify(mockProofs.slice(0, 2)));  // verification

        const result = await cashuWalletService.receiveToken(tokenString);

        expect(result.amount).toBe(3);
        expect(cashuP2PK.signP2PKProofs).toHaveBeenCalledWith(p2pkProofs, 'deadbeef');
      });

      it('should reject P2PK token for wrong account', async () => {
        const tokenString = 'cashuAeyJ0...';

        cashuP2PK.isP2PKLocked.mockReturnValue(true);
        cashuP2PK.getP2PKRecipient.mockReturnValue('02abc123');
        cashuP2PK.findAccountForP2PKToken.mockResolvedValue({ accountIndex: 1, publicKey: '02abc123' });
        secureStorageService.getCurrentAccount.mockResolvedValue(0);

        cashuCrypto.decodeToken.mockReturnValueOnce({
          mint: cashuMintClient.MINT_URL,
          proofs: mockP2PKProofs,
          amount: 3,
        });

        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify([]));

        await expect(cashuWalletService.receiveToken(tokenString))
          .rejects.toThrow('This proof belongs to account 2');
      });
    });

    describe('sendToken - Full Flow', () => {
      beforeEach(() => {
        // Reset sumProofs to default implementation
        cashuCrypto.sumProofs.mockImplementation((proofs) =>
          proofs.reduce((sum, p) => sum + p.amount, 0)
        );

        cashuMintClient.getKeys.mockResolvedValue(mockKeysetData);
        cashuCrypto.createBlindedOutputs.mockResolvedValue({
          outputs: mockOutputs,
          blindingData: mockBlindingData,
        });
        cashuMintClient.swapTokens.mockResolvedValue({
          signatures: mockSignatures,
        });
        cashuCrypto.unblindSignatures.mockReturnValue(mockProofs);
        cashuP2PK.isP2PKSecret.mockReturnValue(false);
      });

      it('should send token with exact amount (no change)', async () => {
        const selectedProofs = [mockProofs[0], mockProofs[1]]; // 1 + 2 = 3
        const remaining = [mockProofs[2], mockProofs[3]]; // 4 + 8 = 12

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))  // loadProofs
          .mockResolvedValueOnce(JSON.stringify(mockProofs))  // loadProofs (removeProofs)
          .mockResolvedValueOnce(JSON.stringify(remaining))  // verification (removeProofs)
          .mockResolvedValueOnce(JSON.stringify(remaining));  // getBalance

        cashuCrypto.selectProofsForAmount.mockReturnValueOnce(selectedProofs);
        cashuCrypto.encodeToken.mockReturnValueOnce('cashuAeyJ0...');

        const result = await cashuWalletService.sendToken(3, false);

        expect(result.token).toBe('cashuAeyJ0...');
        expect(result.amount).toBe(3);
        expect(cashuMintClient.swapTokens).not.toHaveBeenCalled();
      });

      it('should send token with change', async () => {
        const selectedProofs = [mockProofs[0], mockProofs[1], mockProofs[2]]; // 1 + 2 + 4 = 7
        const sendProofs = [mockProofs[0], mockProofs[1]]; // 1 + 2 = 3
        const changeProofs = [mockProofs[2]]; // 4
        const remaining = [mockProofs[3]]; // 8
        const afterAdd = [mockProofs[3], mockProofs[2]]; // 8 + 4 = 12

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))  // loadProofs
          .mockResolvedValueOnce(null)  // getOrFetchKeys cache check
          .mockResolvedValueOnce(JSON.stringify(mockProofs))  // loadProofs (removeProofs)
          .mockResolvedValueOnce(JSON.stringify(remaining))  // verification after removeProofs writes
          .mockResolvedValueOnce(JSON.stringify(remaining))  // loadProofs (addProofs)
          .mockResolvedValueOnce(JSON.stringify(afterAdd))  // verification after addProofs writes
          .mockResolvedValueOnce(JSON.stringify(afterAdd));  // loadProofs (getBalance)

        SecureStore.deleteItemAsync.mockResolvedValue();
        SecureStore.setItemAsync.mockResolvedValue();

        cashuCrypto.selectProofsForAmount.mockReturnValueOnce(selectedProofs);
        cashuCrypto.splitAmount
          .mockReturnValueOnce([1, 2])  // send amounts
          .mockReturnValueOnce([4]);     // change amounts
        cashuCrypto.createBlindedOutputs.mockResolvedValueOnce({
          outputs: mockOutputs,
          blindingData: mockBlindingData,
        });
        cashuMintClient.swapTokens.mockResolvedValueOnce({
          signatures: mockSignatures,
        });
        cashuCrypto.unblindSignatures.mockReturnValueOnce([...sendProofs, ...changeProofs]);
        cashuCrypto.encodeToken.mockReturnValueOnce('cashuAeyJ0...');

        const result = await cashuWalletService.sendToken(3, true);

        expect(result.token).toBe('cashuAeyJ0...');
        expect(result.amount).toBe(3);
        expect(cashuMintClient.swapTokens).toHaveBeenCalled();
      });

      it('should handle insufficient balance', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(mockProofs));

        cashuCrypto.selectProofsForAmount.mockImplementationOnce(() => {
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
      cashuCrypto.sumProofs.mockImplementation((proofs) =>
        proofs.reduce((sum, p) => sum + p.amount, 0)
      );

      cashuMintClient.getKeys.mockResolvedValue(mockKeysetData);
      cashuCrypto.createBlindedOutputs.mockResolvedValue({
        outputs: mockOutputs,
        blindingData: mockBlindingData,
      });
      cashuMintClient.swapTokens.mockResolvedValue({
        signatures: mockSignatures,
      });
      cashuCrypto.unblindSignatures.mockReturnValue(mockProofs);
    });

    describe('completeMelt', () => {
      it('should complete melt with cleanup (exact amount)', async () => {
        const selectedProofs = [mockProofs[0], mockProofs[1], mockProofs[2]]; // 7 sats
        const remaining = [mockProofs[3]]; // 8 sats

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))  // loadProofs
          .mockResolvedValueOnce(JSON.stringify(mockProofs))  // loadProofs (removeProofs)
          .mockResolvedValueOnce(JSON.stringify(remaining))  // verification (removeProofs)
          .mockResolvedValueOnce(JSON.stringify(remaining));  // getBalance

        cashuCrypto.selectProofsForAmount.mockReturnValueOnce(selectedProofs);

        cashuMintClient.meltTokens.mockResolvedValueOnce({
          paid: true,
          payment_preimage: 'txid123',
          fee_paid: 0,
        });

        cashuP2PK.isP2PKSecret.mockReturnValue(false);

        const result = await cashuWalletService.completeMelt('melt123', 7);

        expect(result.paid).toBe(true);
        expect(result.txid).toBe('txid123');
        expect(cashuMintClient.meltTokens).toHaveBeenCalledWith('melt123', selectedProofs);
      });

      it('should complete melt with change', async () => {
        const selectedProofs = mockProofs; // 15 sats total
        const meltProofs = mockProofs.slice(0, 2);
        const changeProofs = mockProofs.slice(2); // 4 + 8 = 12 sats

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))  // loadProofs
          .mockResolvedValueOnce(null)  // getOrFetchKeys
          .mockResolvedValueOnce(JSON.stringify(mockProofs))  // loadProofs (removeProofs)
          .mockResolvedValueOnce(JSON.stringify([]))  // verification (removeProofs) - empty after removing all 4
          .mockResolvedValueOnce(JSON.stringify([]))  // loadProofs (addProofs)
          .mockResolvedValueOnce(JSON.stringify(changeProofs))  // verification (addProofs) - 2 change proofs
          .mockResolvedValueOnce(JSON.stringify(changeProofs));  // getBalance

        cashuCrypto.selectProofsForAmount.mockReturnValueOnce(selectedProofs);

        cashuCrypto.splitAmount
          .mockReturnValueOnce([1, 2])  // melt amounts
          .mockReturnValueOnce([4, 8]);  // change amounts

        cashuMintClient.meltTokens.mockResolvedValueOnce({
          paid: true,
          payment_preimage: 'txid123',
          fee_paid: 0,
        });

        const result = await cashuWalletService.completeMelt('melt123', 3);

        expect(result.paid).toBe(true);
        expect(result.txid).toBe('txid123');
        expect(cashuMintClient.swapTokens).toHaveBeenCalled();
      });

      it('should handle melt failure and preserve change', async () => {
        const selectedProofs = mockProofs;
        const changeProofs = mockProofs.slice(2);

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))  // loadProofs
          .mockResolvedValueOnce(null)  // getOrFetchKeys
          .mockResolvedValueOnce(JSON.stringify([]))  // removeProofs (recovery)
          .mockResolvedValueOnce(JSON.stringify([]))  // verification (removeProofs)
          .mockResolvedValueOnce(JSON.stringify(changeProofs))  // loadProofs (addProofs)
          .mockResolvedValueOnce(JSON.stringify(changeProofs));  // verification (addProofs)

        cashuCrypto.selectProofsForAmount.mockReturnValueOnce(selectedProofs);
        cashuCrypto.sumProofs.mockReturnValueOnce(15);
        cashuCrypto.splitAmount
          .mockReturnValueOnce([1, 2])
          .mockReturnValueOnce([4, 8]);

        cashuMintClient.swapTokens.mockResolvedValueOnce({
          signatures: mockSignatures,
        });

        cashuMintClient.meltTokens.mockRejectedValueOnce(new Error('Melt failed'));

        await expect(cashuWalletService.completeMelt('melt123', 3))
          .rejects.toThrow('Melt failed');

        // Verify change was saved despite melt failure
        expect(logger.warn).toHaveBeenCalledWith(
          'Melt failed after swap - saving change proofs to prevent fund loss'
        );
      });
    });

    describe('completeMeltWithoutCleanup', () => {
      it('should complete melt without cleanup (no change)', async () => {
        const selectedProofs = mockProofs; // All 4 proofs = 15 sats

        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(mockProofs));

        cashuCrypto.selectProofsForAmount.mockReturnValueOnce(selectedProofs);

        // Override implementation to return 15 (exact match with totalAmount)
        cashuCrypto.sumProofs.mockImplementationOnce(() => 15);

        cashuMintClient.meltTokens.mockResolvedValueOnce({
          paid: true,
          payment_preimage: 'txid123',
          fee_paid: 0,
        });

        const result = await cashuWalletService.completeMeltWithoutCleanup('melt123', 15);

        expect(result.paid).toBe(true);
        expect(result.txid).toBe('txid123');
        expect(result.proofsToRemove).toEqual(selectedProofs);
        expect(result.changeProofs).toBeNull();

        // Verify proofs were NOT removed from wallet
        expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
      });

      it('should return change proofs for later cleanup', async () => {
        const selectedProofs = mockProofs;
        const changeProofs = mockProofs.slice(2);

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))
          .mockResolvedValueOnce(null);

        cashuCrypto.selectProofsForAmount.mockReturnValueOnce(selectedProofs);
        cashuCrypto.sumProofs.mockReturnValueOnce(15);
        cashuCrypto.splitAmount
          .mockReturnValueOnce([1, 2])
          .mockReturnValueOnce([4, 8]);

        cashuMintClient.meltTokens.mockResolvedValueOnce({
          paid: true,
          payment_preimage: 'txid123',
        });

        const result = await cashuWalletService.completeMeltWithoutCleanup('melt123', 3);

        expect(result.proofsToRemove).toEqual(selectedProofs);
        expect(result.changeProofs).toBeTruthy();
      });
    });

    describe('cleanupMeltProofs', () => {
      it('should remove spent proofs and add change', async () => {
        const proofsToRemove = [mockProofs[0], mockProofs[1]]; // Remove 2 proofs (proof0, proof1)
        const changeProofs = [mockProofs[3]]; // Add 1 proof
        const remaining = [mockProofs[2], mockProofs[3]]; // 2 proofs remaining (proof2, proof3)
        const afterAddChange = [mockProofs[2], mockProofs[3], mockProofs[3]]; // 3 proofs (remaining + changeProofs)

        // Use a queue-based approach for getItemAsync
        const getItemQueue = [
          JSON.stringify(mockProofs),      // 1. loadProofs (removeProofs) - 4 proofs
          JSON.stringify(remaining),       // 2. verification (removeProofs) - 2 proofs
          JSON.stringify(remaining),       // 3. loadProofs (addProofs) - 2 proofs
          JSON.stringify(afterAddChange),  // 4. verification (addProofs) - 3 proofs
        ];

        SecureStore.getItemAsync.mockImplementation((key) => {
          const value = getItemQueue.shift();
          return Promise.resolve(value || null);
        });

        SecureStore.deleteItemAsync.mockResolvedValue();
        SecureStore.setItemAsync.mockImplementation((key, value) => {
          // Immediately make the written value available for verification
          // This simulates what would happen in real SecureStore
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

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))
          .mockResolvedValueOnce(JSON.stringify(remaining));

        await cashuWalletService.cleanupMeltProofs(proofsToRemove, null);

        expect(logger.info).toHaveBeenCalledWith('Cleaned up melt proofs', { count: 1 });
      });

      it('should handle empty arrays', async () => {
        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))
          .mockResolvedValueOnce(JSON.stringify(mockProofs));

        await cashuWalletService.cleanupMeltProofs([], null);

        expect(logger.info).toHaveBeenCalledWith('Cleaned up melt proofs', { count: 0 });
      });
    });
  });

  describe('P2PK Operations - Full Flow', () => {
    const recipientPubkey = '02abc123def456';
    const privateKey = 'deadbeef1234567890';

    beforeEach(() => {
      cashuP2PK.createP2PKSecret.mockResolvedValue('["P2PK",{"nonce":"abc","data":"02abc123"}]');
      cashuP2PK.isP2PKSecret.mockImplementation((secret) => {
        return typeof secret === 'string' && secret.startsWith('["P2PK"');
      });
      cashuP2PK.signP2PKSecret.mockResolvedValue({
        signatures: ['sig1'],
      });
      cashuMintClient.getKeys.mockResolvedValue(mockKeysetData);
      cashuCrypto.generateSecret.mockResolvedValue('normal_secret');
    });

    describe('sendP2PKToken', () => {
      it('should send P2PK locked token', async () => {
        const unlockedProofs = mockProofs;

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(unlockedProofs))  // loadProofs
          .mockResolvedValueOnce(null)  // getOrFetchKeys
          .mockResolvedValueOnce(JSON.stringify(mockProofs.slice(2)))  // loadProofs (removeProofs)
          .mockResolvedValueOnce(JSON.stringify(mockProofs.slice(2)))  // verification (removeProofs)
          .mockResolvedValueOnce(JSON.stringify(mockProofs.slice(2)));  // getBalance

        SecureStore.deleteItemAsync.mockResolvedValue();
        SecureStore.setItemAsync.mockResolvedValue();

        cashuCrypto.selectProofsForAmount.mockReturnValueOnce(mockProofs.slice(0, 2));

        // Mock sumProofs to return correct values
        cashuCrypto.sumProofs.mockReturnValue(3);  // Default for proofsToSend

        cashuCrypto.splitAmount.mockReturnValueOnce([1, 2]);
        cashuCrypto.createBlindedOutputs.mockResolvedValueOnce({
          outputs: mockOutputs,
          blindingData: mockBlindingData,
        });
        cashuMintClient.swapTokens.mockResolvedValueOnce({
          signatures: mockSignatures,
        });
        cashuCrypto.unblindSignatures.mockReturnValueOnce([
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
          { ...mockProofs[1], secret: '["P2PK",{"nonce":"def","data":"02abc123"}]' },
        ]);
        cashuCrypto.encodeToken.mockReturnValueOnce('cashuAeyJ0...');

        const result = await cashuWalletService.sendP2PKToken(3, recipientPubkey);

        expect(result.token).toBe('cashuAeyJ0...');
        expect(result.amount).toBe(3);
        expect(cashuP2PK.createP2PKSecret).toHaveBeenCalledWith(recipientPubkey, {});
      });

      it('should include locktime option', async () => {
        const options = { locktime: Date.now() + 86400000 };

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(JSON.stringify([mockProofs[2], mockProofs[3]]))
          .mockResolvedValueOnce(JSON.stringify([mockProofs[2], mockProofs[3]]))
          .mockResolvedValueOnce(JSON.stringify([mockProofs[2], mockProofs[3]]));

        cashuCrypto.selectProofsForAmount.mockReturnValueOnce([mockProofs[0]]);
        cashuCrypto.sumProofs
          .mockReturnValueOnce(1)
          .mockReturnValueOnce(14);

        cashuCrypto.splitAmount.mockReturnValueOnce([1]);
        cashuCrypto.createBlindedOutputs.mockResolvedValueOnce({
          outputs: [mockOutputs[0]],
          blindingData: [mockBlindingData[0]],
        });
        cashuMintClient.swapTokens.mockResolvedValueOnce({
          signatures: [mockSignatures[0]],
        });
        cashuCrypto.unblindSignatures.mockReturnValueOnce([
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
        ]);
        cashuCrypto.encodeToken.mockReturnValueOnce('cashuAeyJ0...');

        await cashuWalletService.sendP2PKToken(1, recipientPubkey, options);

        expect(cashuP2PK.createP2PKSecret).toHaveBeenCalledWith(recipientPubkey, options);
      });

      it('should include refund pubkey option', async () => {
        const options = { refund: ['03xyz789'] };

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(JSON.stringify([mockProofs[1], mockProofs[2], mockProofs[3]]))
          .mockResolvedValueOnce(JSON.stringify([mockProofs[1], mockProofs[2], mockProofs[3]]))
          .mockResolvedValueOnce(JSON.stringify([mockProofs[1], mockProofs[2], mockProofs[3]]));

        cashuCrypto.selectProofsForAmount.mockReturnValueOnce([mockProofs[0]]);
        cashuCrypto.sumProofs
          .mockReturnValueOnce(1)
          .mockReturnValueOnce(14);

        cashuCrypto.splitAmount.mockReturnValueOnce([1]);
        cashuCrypto.createBlindedOutputs.mockResolvedValueOnce({
          outputs: [mockOutputs[0]],
          blindingData: [mockBlindingData[0]],
        });
        cashuMintClient.swapTokens.mockResolvedValueOnce({
          signatures: [mockSignatures[0]],
        });
        cashuCrypto.unblindSignatures.mockReturnValueOnce([
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
        ]);
        cashuCrypto.encodeToken.mockReturnValueOnce('cashuAeyJ0...');

        await cashuWalletService.sendP2PKToken(1, recipientPubkey, options);

        expect(cashuP2PK.createP2PKSecret).toHaveBeenCalledWith(recipientPubkey, options);
      });

      it('should handle progress callbacks', async () => {
        const onProgress = jest.fn();

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(mockProofs))
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(JSON.stringify([mockProofs[2], mockProofs[3]]))
          .mockResolvedValueOnce(JSON.stringify([mockProofs[2], mockProofs[3]]))
          .mockResolvedValueOnce(JSON.stringify([mockProofs[2], mockProofs[3]]));

        cashuCrypto.selectProofsForAmount.mockReturnValueOnce([mockProofs[0]]);
        cashuCrypto.sumProofs
          .mockReturnValueOnce(1)
          .mockReturnValueOnce(14);

        cashuCrypto.splitAmount.mockReturnValueOnce([1]);
        cashuCrypto.createBlindedOutputs.mockResolvedValueOnce({
          outputs: [mockOutputs[0]],
          blindingData: [mockBlindingData[0]],
        });
        cashuMintClient.swapTokens.mockResolvedValueOnce({
          signatures: [mockSignatures[0]],
        });
        cashuCrypto.unblindSignatures.mockReturnValueOnce([
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
        ]);
        cashuCrypto.encodeToken.mockReturnValueOnce('cashuAeyJ0...');

        await cashuWalletService.sendP2PKToken(1, recipientPubkey, {}, onProgress);

        expect(onProgress).toHaveBeenCalledTimes(4);
        expect(onProgress).toHaveBeenCalledWith(1, 4, 'Selecting proofs');
        expect(onProgress).toHaveBeenCalledWith(4, 4, 'Saving to wallet');
      });

      it('should handle insufficient balance', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(mockProofs));

        cashuCrypto.selectProofsForAmount.mockImplementationOnce(() => {
          throw new Error('Insufficient balance');
        });

        await expect(cashuWalletService.sendP2PKToken(1000, recipientPubkey))
          .rejects.toThrow('Insufficient balance');
      });
    });

    describe('receiveP2PKToken', () => {
      it('should receive and unlock P2PK token', async () => {
        const tokenString = 'cashuAeyJ0...';
        const p2pkProofs = [
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
          { ...mockProofs[1], secret: '["P2PK",{"nonce":"def","data":"02abc123"}]' },
        ];

        cashuCrypto.decodeToken.mockReturnValueOnce({
          mint: cashuMintClient.MINT_URL,
          proofs: p2pkProofs,
          amount: 3,
        });

        SecureStore.getItemAsync
          .mockResolvedValueOnce(null)  // getOrFetchKeys
          .mockResolvedValueOnce(JSON.stringify([]))  // loadProofs (addProofs)
          .mockResolvedValueOnce(JSON.stringify(mockProofs.slice(0, 2)));  // verification

        cashuCrypto.splitAmount.mockReturnValueOnce([1, 2]);
        cashuCrypto.createBlindedOutputs.mockResolvedValueOnce({
          outputs: mockOutputs,
          blindingData: mockBlindingData,
        });
        cashuMintClient.swapTokens.mockResolvedValueOnce({
          signatures: mockSignatures,
        });
        cashuCrypto.unblindSignatures.mockReturnValueOnce(mockProofs.slice(0, 2));

        const result = await cashuWalletService.receiveP2PKToken(tokenString, privateKey);

        expect(result.amount).toBe(3);
        expect(result.proofCount).toBe(2);
        expect(cashuP2PK.signP2PKSecret).toHaveBeenCalled();
      });

      it('should handle non-P2PK token error', async () => {
        const tokenString = 'cashuAeyJ0...';

        cashuP2PK.isP2PKSecret.mockReturnValue(false);

        cashuCrypto.decodeToken.mockReturnValueOnce({
          mint: cashuMintClient.MINT_URL,
          proofs: mockProofs,
          amount: 15,
        });

        await expect(cashuWalletService.receiveP2PKToken(tokenString, privateKey))
          .rejects.toThrow('Token does not contain P2PK locked proofs');
      });

      it('should handle wrong private key (swap fails)', async () => {
        const tokenString = 'cashuAeyJ0...';
        const p2pkProofs = [
          { ...mockProofs[0], secret: '["P2PK",{"nonce":"abc","data":"02abc123"}]' },
        ];

        cashuCrypto.decodeToken.mockReturnValueOnce({
          mint: cashuMintClient.MINT_URL,
          proofs: p2pkProofs,
          amount: 1,
        });

        SecureStore.getItemAsync.mockResolvedValueOnce(null);

        cashuCrypto.splitAmount.mockReturnValueOnce([1]);
        cashuCrypto.createBlindedOutputs.mockResolvedValueOnce({
          outputs: [mockOutputs[0]],
          blindingData: [mockBlindingData[0]],
        });

        cashuMintClient.swapTokens.mockRejectedValueOnce(new Error('P2PK verification failed'));

        await expect(cashuWalletService.receiveP2PKToken(tokenString, 'wrongkey'))
          .rejects.toThrow('P2PK verification failed');
      });
    });
  });

  describe('Recovery Operations', () => {
    beforeEach(() => {
      cashuP2PK.isP2PKSecret.mockImplementation((secret) => {
        return typeof secret === 'string' && secret.startsWith('["P2PK"');
      });
    });

    describe('recoverLockedChange', () => {
      it('should recover locked tokens we can claim', async () => {
        const sentToken = {
          id: 'token1',
          token: 'cashuAeyJ0...',
        };

        const changeProofs = [mockProofs[0], mockProofs[1]];
        const lockedProofs = mockP2PKProofs;

        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify([]));  // loadProofs (check existing)

        cashuLockedTokensService.getSentLockedTokens.mockResolvedValueOnce([sentToken]);

        cashuCrypto.decodeToken.mockReturnValueOnce({
          proofs: [...changeProofs, ...lockedProofs],
        });

        cashuCrypto.sumProofs
          .mockReturnValueOnce(3)  // changeAmount in log
          .mockReturnValueOnce(3)  // lockedAmount in log
          .mockReturnValueOnce(3)  // changeProofs sum
          .mockReturnValueOnce(3);  // recoveredAmount

        // Mock addProofs sequence
        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify([]))  // loadProofs
          .mockResolvedValueOnce(JSON.stringify(changeProofs));  // verification

        const result = await cashuWalletService.recoverLockedChange();

        expect(result.recovered).toBe(2);
        expect(result.amount).toBe(3);
        expect(logger.info).toHaveBeenCalledWith('Successfully recovered change proofs', {
          recovered: 2,
          amount: 3,
        });
      });

      it('should handle no locked tokens', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify([]));
        cashuLockedTokensService.getSentLockedTokens.mockResolvedValueOnce([]);

        const result = await cashuWalletService.recoverLockedChange();

        expect(result.recovered).toBe(0);
        expect(result.amount).toBe(0);
        expect(result.message).toContain('No change proofs found');
      });

      it('should handle locked tokens we cannot claim (all P2PK)', async () => {
        const sentToken = {
          id: 'token1',
          token: 'cashuAeyJ0...',
        };

        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify([]));
        cashuLockedTokensService.getSentLockedTokens.mockResolvedValueOnce([sentToken]);

        cashuCrypto.decodeToken.mockReturnValueOnce({
          proofs: mockP2PKProofs,  // All P2PK, no change
        });

        const result = await cashuWalletService.recoverLockedChange();

        expect(result.recovered).toBe(0);
        expect(result.amount).toBe(0);
      });

      it('should skip tokens already in wallet', async () => {
        const sentToken = {
          id: 'token1',
          token: 'cashuAeyJ0...',
        };

        const changeProofs = [mockProofs[0]];

        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(changeProofs));  // already in wallet
        cashuLockedTokensService.getSentLockedTokens.mockResolvedValueOnce([sentToken]);

        cashuCrypto.decodeToken.mockReturnValueOnce({
          proofs: changeProofs,
        });

        cashuCrypto.sumProofs.mockReturnValueOnce(1);

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

        SecureStore.getItemAsync
          .mockResolvedValueOnce(JSON.stringify(allProofs))  // loadProofs
          .mockResolvedValueOnce(JSON.stringify([mockProofs[1], mockProofs[3]]));  // verification

        cashuMintClient.checkProofsSpent.mockResolvedValueOnce({
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

        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(allProofs));

        cashuMintClient.checkProofsSpent.mockResolvedValueOnce({
          states: unspentStates,
        });

        const result = await cashuWalletService.removeSpentProofs();

        expect(result.removed).toBe(0);
        expect(result.kept).toBe(4);
        // saveProofs should not be called if no proofs were spent
        expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
      });

      it('should handle empty wallet', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(null);

        const result = await cashuWalletService.removeSpentProofs();

        expect(result.removed).toBe(0);
        expect(result.kept).toBe(0);
        expect(cashuMintClient.checkProofsSpent).not.toHaveBeenCalled();
      });

      it('should handle check error', async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(mockProofs));
        cashuMintClient.checkProofsSpent.mockRejectedValueOnce(new Error('Network error'));

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
        SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('Delete failed'));

        // Should throw the error
        await expect(cashuWalletService.clearWallet())
          .rejects.toThrow('Delete failed');
      });
    });
  });
});
