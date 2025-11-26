/**
 * Tests for turboTokenStorage service
 */

// Mock dependencies BEFORE imports
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {
  hashToken,
  loadProcessedTokens,
  saveProcessedTokens,
  markTokenAsProcessed,
  isTokenProcessed,
  initializeTokenStorage,
} from '../turboTokenStorage';

describe('turboTokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset global state
    delete (global as any).processedCashuTokens;
    delete (global as any).processedCashuTokensLoading;
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('mockedHashValue');
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue();
  });

  describe('hashToken', () => {
    it('should hash a token using SHA256', async () => {
      const result = await hashToken('cashuAtoken123');

      expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.SHA256,
        'cashuAtoken123'
      );
      expect(result).toBe('mockedHashValue');
    });

    it('should return first 64 chars as fallback on error', async () => {
      (Crypto.digestStringAsync as jest.Mock).mockRejectedValue(new Error('Hash failed'));
      const longToken = 'a'.repeat(100);

      const result = await hashToken(longToken);

      expect(result).toBe('a'.repeat(64));
    });
  });

  describe('loadProcessedTokens', () => {
    it('should load tokens from storage', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('["hash1","hash2","hash3"]');

      const result = await loadProcessedTokens();

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('processed_cashu_tokens');
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(3);
      expect(result.has('hash1')).toBe(true);
      expect(result.has('hash2')).toBe(true);
      expect(result.has('hash3')).toBe(true);
    });

    it('should return empty set when storage is empty', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await loadProcessedTokens();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should return empty set on error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await loadProcessedTokens();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('saveProcessedTokens', () => {
    it('should save tokens to storage', async () => {
      const tokens = new Set(['hash1', 'hash2']);

      await saveProcessedTokens(tokens);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'processed_cashu_tokens',
        expect.any(String)
      );
      const savedValue = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedValue).toContain('hash1');
      expect(savedValue).toContain('hash2');
    });

    it('should limit storage to MAX_STORED_TOKENS (500)', async () => {
      const tokens = new Set();
      for (let i = 0; i < 600; i++) {
        tokens.add(`hash${i}`);
      }

      await saveProcessedTokens(tokens);

      const savedValue = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedValue.length).toBe(500);
    });

    it('should handle save errors gracefully', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Save failed'));

      // Should not throw
      await expect(saveProcessedTokens(new Set(['hash1']))).resolves.not.toThrow();
    });
  });

  describe('markTokenAsProcessed', () => {
    it('should mark token as processed when global set exists', async () => {
      (global as any).processedCashuTokens = new Set();

      await markTokenAsProcessed('cashuAtoken');

      expect((global as any).processedCashuTokens.has('mockedHashValue')).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should not throw when global set does not exist', async () => {
      delete global.processedCashuTokens;

      await expect(markTokenAsProcessed('cashuAtoken')).resolves.not.toThrow();
    });

    it('should handle errors gracefully', async () => {
      (global as any).processedCashuTokens = new Set();
      (Crypto.digestStringAsync as jest.Mock).mockRejectedValue(new Error('Hash error'));

      // Should not throw
      await expect(markTokenAsProcessed('cashuAtoken')).resolves.not.toThrow();
    });

    it('should log error when add operation fails (line 73)', async () => {
      const { logger } = require('../../../utils/logger');
      // Set up a fake object that throws when add is called
      (global as any).processedCashuTokens = {
        add: jest.fn().mockImplementation(() => {
          throw new Error('Add operation failed');
        }),
      };

      await markTokenAsProcessed('cashuAtoken');

      expect((logger.error as jest.Mock)).toHaveBeenCalledWith(
        '[TURBO] Failed to mark token as processed:',
        expect.objectContaining({ message: 'Add operation failed' })
      );
    });
  });

  describe('isTokenProcessed', () => {
    it('should return true for processed token', async () => {
      (global as any).processedCashuTokens = new Set(['mockedHashValue']);

      const result = await isTokenProcessed('cashuAtoken');

      expect(result).toBe(true);
    });

    it('should return false for unprocessed token', async () => {
      (global as any).processedCashuTokens = new Set(['otherHash']);

      const result = await isTokenProcessed('cashuAtoken');

      expect(result).toBe(false);
    });

    it('should return false when global set does not exist', async () => {
      delete global.processedCashuTokens;

      const result = await isTokenProcessed('cashuAtoken');

      // When global set doesn't exist, the check returns falsy
      expect(result).toBeFalsy();
    });

    it('should return false on error', async () => {
      (global as any).processedCashuTokens = new Set();
      (Crypto.digestStringAsync as jest.Mock).mockRejectedValue(new Error('Hash error'));

      const result = await isTokenProcessed('cashuAtoken');

      expect(result).toBe(false);
    });

    it('should log error and return false when has operation fails (lines 85-86)', async () => {
      const { logger } = require('../../../utils/logger');
      // Set up a fake object that throws when has is called
      (global as any).processedCashuTokens = {
        has: jest.fn().mockImplementation(() => {
          throw new Error('Has operation failed');
        }),
      };

      const result = await isTokenProcessed('cashuAtoken');

      expect(result).toBe(false);
      expect((logger.error as jest.Mock)).toHaveBeenCalledWith(
        '[TURBO] Failed to check token status:',
        expect.objectContaining({ message: 'Has operation failed' })
      );
    });
  });

  describe('initializeTokenStorage', () => {
    it('should initialize empty set and load from storage', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('["hash1","hash2"]');

      await initializeTokenStorage();

      expect((global as any).processedCashuTokens).toBeInstanceOf(Set);
      expect((global as any).processedCashuTokens.size).toBe(2);
      expect((global as any).processedCashuTokensLoading).toBe(false);
    });

    it('should not reinitialize if already initialized', async () => {
      (global as any).processedCashuTokens = new Set(['existingHash']);

      await initializeTokenStorage();

      expect(SecureStore.getItemAsync as jest.Mock).not.toHaveBeenCalled();
      expect((global as any).processedCashuTokens.has('existingHash')).toBe(true);
    });

    it('should handle load errors and create empty set', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Load failed'));

      await initializeTokenStorage();

      expect((global as any).processedCashuTokens).toBeInstanceOf(Set);
      expect((global as any).processedCashuTokens.size).toBe(0);
      expect((global as any).processedCashuTokensLoading).toBe(false);
    });

    it('should log error and create empty set when loadProcessedTokens throws (lines 103-105)', async () => {
      const { logger } = require('../../../utils/logger');
      // Make logger.debug throw AFTER loadProcessedTokens returns successfully
      // This triggers the catch block in initializeTokenStorage (lines 103-105)
      (logger.debug as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Logger debug failed');
      });

      await initializeTokenStorage();

      // The catch block should be triggered and log an error
      expect((logger.error as jest.Mock)).toHaveBeenCalledWith(
        '[TURBO] Failed to load processed tokens, starting fresh:',
        expect.objectContaining({ message: 'Logger debug failed' })
      );
      expect((global as any).processedCashuTokens).toBeInstanceOf(Set);
      expect((global as any).processedCashuTokens.size).toBe(0);
      expect((global as any).processedCashuTokensLoading).toBe(false);
    });

    it('should set loading flag during initialization', async () => {
      let loadingDuringInit = null;

      (SecureStore.getItemAsync as jest.Mock).mockImplementation(() => {
        loadingDuringInit = (global as any).processedCashuTokensLoading;
        return Promise.resolve(null);
      });

      await initializeTokenStorage();

      expect(loadingDuringInit).toBe(true);
      expect((global as any).processedCashuTokensLoading).toBe(false);
    });
  });
});
