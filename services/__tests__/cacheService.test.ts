/**
 * Tests for cacheService
 */

// Mock dependencies BEFORE imports
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../utils/constants', () => ({
  SECURE_KEYS: {
    MNEMONIC: 'mnemonic',
    ENCRYPTED_MNEMONIC: 'encrypted_mnemonic',
    PIN_HASH: 'pin_hash',
    PIN_SALT: 'pin_salt',
    LOCKOUT_UNTIL: 'lockout_until',
    FAILED_ATTEMPTS: 'failed_attempts',
    BIOMETRIC_ENABLED: 'biometric_enabled',
    AUTH_SETTINGS: 'auth_settings',
  },
}));

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAppCache, clearP2PKCache, clearCashuCache } from '../cacheService';

// Typed mock references
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;
const mockGetAllKeys = AsyncStorage.getAllKeys as jest.MockedFunction<typeof AsyncStorage.getAllKeys>;
const mockMultiRemove = AsyncStorage.multiRemove as jest.MockedFunction<typeof AsyncStorage.multiRemove>;

describe('cacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteItemAsync.mockResolvedValue();
    mockGetAllKeys.mockResolvedValue([]);
    mockMultiRemove.mockResolvedValue();
  });

  describe('clearAppCache', () => {
    it('should clear known SecureStore keys', async () => {
      await clearAppCache();

      // Should try to delete known clearable keys
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('cashu_keysets');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('sent_turbo_tokens');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('p2pk_taproot_address_v3');
    });

    it('should return summary with cleared counts', async () => {
      const result = await clearAppCache();

      expect(result).toHaveProperty('secureStoreCleared');
      expect(result).toHaveProperty('asyncStorageCleared');
      expect(result).toHaveProperty('cashuProofsCleared');
      expect(result).toHaveProperty('derivedKeysCleared');
      expect(result).toHaveProperty('errors');
    });

    it('should clear AsyncStorage keys except protected ones', async () => {
      mockGetAllKeys.mockResolvedValue([
        'mnemonic',
        'pin_hash',
        'cache_data',
        'temp_data',
      ]);

      const result = await clearAppCache();

      // Should only remove non-protected keys
      expect(mockMultiRemove).toHaveBeenCalledWith(['cache_data', 'temp_data']);
      expect(result.asyncStorageCleared).toBe(2);
    });

    it('should not remove protected AsyncStorage keys', async () => {
      mockGetAllKeys.mockResolvedValue([
        'mnemonic',
        'pin_hash',
        'onboarding_complete',
      ]);

      await clearAppCache();

      // multiRemove should be called with empty array or not at all
      if (mockMultiRemove.mock.calls.length > 0) {
        const removedKeys = mockMultiRemove.mock.calls[0][0];
        expect(removedKeys).not.toContain('mnemonic');
        expect(removedKeys).not.toContain('pin_hash');
        expect(removedKeys).not.toContain('onboarding_complete');
      }
    });

    it('should handle SecureStore delete errors gracefully', async () => {
      mockDeleteItemAsync.mockRejectedValue(new Error('Delete failed'));

      const result = await clearAppCache();

      // Should not throw, should continue
      expect(result).toBeDefined();
      expect(result.secureStoreCleared).toBe(0);
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      mockGetAllKeys.mockRejectedValue(new Error('Storage error'));

      const result = await clearAppCache();

      expect(result.errors).toContain('AsyncStorage: Storage error');
    });

    it('should aggressively clear cashu proofs for all accounts', async () => {
      await clearAppCache();

      // Should try to delete cashu_proofs_account_X for accounts 0-49
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('cashu_proofs_account_0');
    });

    it('should aggressively clear derived keys for all accounts', async () => {
      await clearAppCache();

      // Should try to delete derived_key_* for accounts 0-49
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('derived_key_account_0');
    });
  });

  describe('clearP2PKCache', () => {
    it('should clear P2PK cache keys', async () => {
      await clearP2PKCache();

      expect(mockDeleteItemAsync).toHaveBeenCalledWith('p2pk_taproot_address_v3');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('p2pk_private_key_v3');
    });

    it('should handle errors gracefully', async () => {
      mockDeleteItemAsync.mockRejectedValue(new Error('Failed'));

      // Should not throw
      await expect(clearP2PKCache()).resolves.not.toThrow();
    });
  });

  describe('clearCashuCache', () => {
    it('should clear Cashu cache keys', async () => {
      await clearCashuCache();

      expect(mockDeleteItemAsync).toHaveBeenCalledWith('cashu_keysets');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('sent_turbo_tokens');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('received_turbo_tokens');
    });

    it('should handle errors gracefully', async () => {
      mockDeleteItemAsync.mockRejectedValue(new Error('Failed'));

      // Should not throw
      await expect(clearCashuCache()).resolves.not.toThrow();
    });
  });
});
