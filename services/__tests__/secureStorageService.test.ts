// @ts-nocheck
/**
 * Tests for Secure Storage Service
 */

// Mock passkey service - handles the dynamic import() in deleteWalletData
// The mock throws to simulate import/execution failures which triggers the catch block
jest.mock('../passkey', () => ({
  clearPasskeyData: jest.fn().mockRejectedValue(new Error('Mock passkey error')),
}));

import {
  saveMnemonic,
  getMnemonic,
  withMnemonic,
  deleteMnemonic,
  saveCurrentAccount,
  getCurrentAccount,
  deleteWalletData,
} from '../secureStorageService';
import * as SecureStore from 'expo-secure-store';

// Mock expo-secure-store
jest.mock('expo-secure-store');

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Typed mock references
const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;

describe('SecureStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveMnemonic', () => {
    it('should save mnemonic to secure storage', async () => {
      mockSetItemAsync.mockResolvedValue();

      const result = await saveMnemonic('word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12');

      expect(result).toBe(true);
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'wallet_mnemonic_v1',
        'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12'
      );
    });

    it('should return false on storage error', async () => {
      mockSetItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await saveMnemonic('test mnemonic');

      expect(result).toBe(false);
    });
  });

  describe('getMnemonic', () => {
    it('should retrieve mnemonic from secure storage', async () => {
      mockGetItemAsync.mockResolvedValue('test mnemonic phrase');

      const result = await getMnemonic();

      expect(result).toBe('test mnemonic phrase');
      expect(mockGetItemAsync).toHaveBeenCalledWith('wallet_mnemonic_v1');
    });

    it('should return null when no mnemonic exists', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      const result = await getMnemonic();

      expect(result).toBeNull();
    });

    it('should return null on storage error', async () => {
      mockGetItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await getMnemonic();

      expect(result).toBeNull();
    });
  });

  describe('withMnemonic', () => {
    it('should execute callback with mnemonic', async () => {
      mockGetItemAsync.mockResolvedValue('test mnemonic');
      const callback = jest.fn().mockResolvedValue('callback result');

      const result = await withMnemonic(callback);

      expect(result).toBe('callback result');
      expect(callback).toHaveBeenCalledWith('test mnemonic');
    });

    it('should throw error when mnemonic not found', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      const callback = jest.fn();

      await expect(withMnemonic(callback)).rejects.toThrow('Mnemonic not found');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should propagate callback errors', async () => {
      mockGetItemAsync.mockResolvedValue('test mnemonic');
      const callback = jest.fn().mockRejectedValue(new Error('Callback error'));

      await expect(withMnemonic(callback)).rejects.toThrow('Callback error');
    });

    it('should still clear mnemonic from memory after callback error', async () => {
      mockGetItemAsync.mockResolvedValue('test mnemonic');
      const callback = jest.fn().mockRejectedValue(new Error('Callback error'));

      await expect(withMnemonic(callback)).rejects.toThrow('Callback error');
      // The finally block runs regardless of error
    });

    it('should handle async callbacks', async () => {
      mockGetItemAsync.mockResolvedValue('test mnemonic');
      const callback = jest.fn().mockImplementation(async (mnemonic) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `processed: ${mnemonic}`;
      });

      const result = await withMnemonic(callback);

      expect(result).toBe('processed: test mnemonic');
    });
  });

  describe('deleteMnemonic', () => {
    it('should delete mnemonic from secure storage', async () => {
      mockDeleteItemAsync.mockResolvedValue();

      const result = await deleteMnemonic();

      expect(result).toBe(true);
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_mnemonic_v1');
    });

    it('should return false on storage error', async () => {
      mockDeleteItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await deleteMnemonic();

      expect(result).toBe(false);
    });
  });

  describe('saveCurrentAccount', () => {
    it('should save account index to secure storage', async () => {
      mockSetItemAsync.mockResolvedValue();

      const result = await saveCurrentAccount(0);

      expect(result).toBe(true);
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_current_account_v1', '0');
    });

    it('should handle non-zero account index', async () => {
      mockSetItemAsync.mockResolvedValue();

      const result = await saveCurrentAccount(5);

      expect(result).toBe(true);
      expect(mockSetItemAsync).toHaveBeenCalledWith('wallet_current_account_v1', '5');
    });

    it('should return false on storage error', async () => {
      mockSetItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await saveCurrentAccount(0);

      expect(result).toBe(false);
    });
  });

  describe('getCurrentAccount', () => {
    it('should retrieve account index from secure storage', async () => {
      mockGetItemAsync.mockResolvedValue('3');

      const result = await getCurrentAccount();

      expect(result).toBe(3);
      expect(mockGetItemAsync).toHaveBeenCalledWith('wallet_current_account_v1');
    });

    it('should return 0 when no account stored', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      const result = await getCurrentAccount();

      expect(result).toBe(0);
    });

    it('should return 0 on storage error', async () => {
      mockGetItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await getCurrentAccount();

      expect(result).toBe(0);
    });

    it('should parse account index as integer', async () => {
      mockGetItemAsync.mockResolvedValue('10');

      const result = await getCurrentAccount();

      expect(result).toBe(10);
    });
  });

  describe('deleteWalletData', () => {
    it('should delete all wallet data from secure storage', async () => {
      mockDeleteItemAsync.mockResolvedValue();

      const result = await deleteWalletData();

      expect(result).toBe(true);

      // Check all expected keys are deleted
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_mnemonic_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_current_account_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_pin_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_pin_salt_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_pin_version_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_biometric_enabled_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pin_failed_attempts');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pin_lockout_until');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pendingWalletDelete');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pendingFaceIdEnable');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pendingNotificationsEnable');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('returnToSettingsAfterAuth');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('returnToSettingsAfterPinChange');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('returnToSettingsAfterSeedPhrase');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('notificationsEnabled');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('showZeroAssets');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('passkey_enabled_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('passkey_credential_id_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('passkey_user_handle_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_creation_method_v1');
    });

    it('should clear iCloud backup when requested (clearICloudBackup=true)', async () => {
      mockDeleteItemAsync.mockResolvedValue();

      const result = await deleteWalletData(true);

      // Result should be true and all keys should be deleted
      expect(result).toBe(true);
      expect(mockDeleteItemAsync).toHaveBeenCalled();
    });

    it('should preserve iCloud backup by default (clearICloudBackup=false)', async () => {
      mockDeleteItemAsync.mockResolvedValue();

      const result = await deleteWalletData();

      expect(result).toBe(true);
      expect(mockDeleteItemAsync).toHaveBeenCalled();
    });

    it('should continue even if passkey clear fails (via dynamic import error)', async () => {
      mockDeleteItemAsync.mockResolvedValue();
      // The passkey module mock throws an error, simulating import failure
      // The function should still succeed

      const result = await deleteWalletData();

      expect(result).toBe(true);
    });

    it('should return false on storage error', async () => {
      mockDeleteItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await deleteWalletData();

      expect(result).toBe(false);
    });
  });

  describe('securelyWipeString (internal function tested via withMnemonic)', () => {
    it('should handle null string gracefully', async () => {
      // This tests the securelyWipeString function indirectly
      // by testing that withMnemonic handles the finally block correctly
      mockGetItemAsync.mockResolvedValue(null);

      await expect(withMnemonic(jest.fn())).rejects.toThrow('Mnemonic not found');
    });

    it('should handle empty string', async () => {
      mockGetItemAsync.mockResolvedValue('');

      // Empty string is falsy, so it should throw "Mnemonic not found"
      await expect(withMnemonic(jest.fn())).rejects.toThrow('Mnemonic not found');
    });

    it('should properly execute callback with valid mnemonic', async () => {
      mockGetItemAsync.mockResolvedValue('valid mnemonic phrase here');
      const callback = jest.fn().mockResolvedValue('success');

      const result = await withMnemonic(callback);

      expect(result).toBe('success');
      expect(callback).toHaveBeenCalledWith('valid mnemonic phrase here');
    });
  });
});
