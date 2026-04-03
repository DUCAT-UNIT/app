/**
 * Tests for Passkey Storage Service
 * Covers isPasskeyEnabled, getWalletCreationMethod, removePasskey, clearPasskeyData
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../../utils/logger';
import { clearICloud } from '../../icloudStorage';

// Mock dependencies
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../icloudStorage', () => ({
  clearICloud: jest.fn(),
}));

jest.mock('../core', () => ({
  PASSKEY_DERIVATION_VERSION: {
    LEGACY_V4: '4',
    PRF_V5: '5',
  },
  PASSKEY_KEYS: {
    ENABLED: 'passkey_enabled_v1',
    CREDENTIAL_ID: 'passkey_credential_id_v1',
    USER_HANDLE: 'passkey_user_handle_v1',
    CREATION_METHOD: 'wallet_creation_method_v1',
    ENCRYPTED_MNEMONIC: 'passkey_encrypted_mnemonic_v1',
    ENCRYPTION_IV: 'passkey_encryption_iv_v1',
    ENCRYPTION_TAG: 'passkey_encryption_tag_v1',
    PRF_ENABLED: 'passkey_prf_enabled_v1',
    DERIVATION_VERSION: 'passkey_derivation_version_v1',
  },
  resolvePasskeyDerivationVersion: jest.fn((storedVersion, prfEnabled) => storedVersion || (prfEnabled ? '5' : '4')),
  isLegacyPasskeyDerivationVersion: jest.fn((version) => version === '4'),
}));

// Import after mocks
import { PASSKEY_KEYS } from '../core';
import {
  isPasskeyEnabled,
  getWalletCreationMethod,
  removePasskey,
  clearPasskeyData,
} from '../storage';

describe('Passkey Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks to resolve successfully by default
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (clearICloud as jest.Mock).mockResolvedValue(undefined);
  });

  describe('isPasskeyEnabled', () => {
    it('should return true when passkey is enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

      const result = await isPasskeyEnabled();

      expect(result).toBe(true);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.ENABLED);
    });

    it('should return false when passkey is not enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('false');

      const result = await isPasskeyEnabled();

      expect(result).toBe(false);
    });

    it('should return false when passkey value is null', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await isPasskeyEnabled();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const result = await isPasskeyEnabled();

      expect(result).toBe(false);
    });

    it('should handle storage exceptions gracefully', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await isPasskeyEnabled();

      expect(result).toBe(false);
    });
  });

  describe('getWalletCreationMethod', () => {
    it('should return "passkey" when set', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('passkey');

      const result = await getWalletCreationMethod();

      expect(result).toBe('passkey');
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.CREATION_METHOD);
    });

    it('should return "pin" when set', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('pin');

      const result = await getWalletCreationMethod();

      expect(result).toBe('pin');
    });

    it('should return null when not set', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await getWalletCreationMethod();

      expect(result).toBeNull();
    });

    it('should return null when empty string', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('');

      const result = await getWalletCreationMethod();

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const result = await getWalletCreationMethod();

      expect(result).toBeNull();
    });
  });

  describe('removePasskey', () => {
    it('should remove all passkey data', async () => {
      await removePasskey();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.ENABLED);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.CREDENTIAL_ID);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.USER_HANDLE);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.ENCRYPTION_IV);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.ENCRYPTION_TAG);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.PRF_ENABLED);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.DERIVATION_VERSION);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(8);
    });

    it('should not delete creation method', async () => {
      await removePasskey();

      const calls = (SecureStore.deleteItemAsync as jest.Mock).mock.calls;
      const creationMethodCall = calls.find(call => call[0] === PASSKEY_KEYS.CREATION_METHOD);

      expect(creationMethodCall).toBeUndefined();
    });

    it('should log debug message on success', async () => {
      await removePasskey();

      expect(logger.debug).toHaveBeenCalledWith('Removing passkey from wallet');
      expect(logger.debug).toHaveBeenCalledWith('Passkey removed successfully');
    });

    it('should throw error if deletion fails', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(
        new Error('Delete failed')
      );

      await expect(removePasskey()).rejects.toThrow('Delete failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to remove passkey',
        { error: 'Delete failed' }
      );
    });

    it('should handle partial deletion failure', async () => {
      (SecureStore.deleteItemAsync as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed on second delete'));

      await expect(removePasskey()).rejects.toThrow('Failed on second delete');
    });
  });

  describe('clearPasskeyData', () => {
    it('should clear all local passkey data', async () => {
      await clearPasskeyData(false);

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.ENABLED);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.CREATION_METHOD);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.CREDENTIAL_ID);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.USER_HANDLE);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.ENCRYPTION_IV);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.ENCRYPTION_TAG);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.PRF_ENABLED);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.DERIVATION_VERSION);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(9);
    });

    it('should not clear iCloud by default', async () => {
      await clearPasskeyData();

      expect(clearICloud).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('iCloud backup preserved for restoration');
    });

    it('should clear iCloud when explicitly requested', async () => {
      await clearPasskeyData(true);

      expect(clearICloud).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('iCloud backup also cleared');
    });

    it('should handle iCloud clear failure gracefully', async () => {
      (clearICloud as jest.Mock).mockRejectedValue(new Error('iCloud error'));

      await clearPasskeyData(true);

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to clear iCloud backup',
        { error: 'iCloud error' }
      );
      expect(logger.debug).toHaveBeenCalledWith('Local passkey data cleared');
    });

    it('should log when clearing iCloud backup', async () => {
      await clearPasskeyData(true);

      expect(logger.debug).toHaveBeenCalledWith('Local passkey data cleared');
      expect(logger.debug).toHaveBeenCalledWith('iCloud backup also cleared');
    });

    it('should continue even if local deletion fails', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(
        new Error('Delete failed')
      );

      // Should not throw
      await clearPasskeyData(false);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to clear passkey data',
        { error: 'Delete failed' }
      );
    });

    it('should handle both local and iCloud failures', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(
        new Error('Local delete failed')
      );
      (clearICloud as jest.Mock).mockRejectedValue(new Error('iCloud delete failed'));

      await clearPasskeyData(true);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to clear passkey data',
        { error: 'Local delete failed' }
      );
    });

    it('should clear creation method unlike removePasskey', async () => {
      await clearPasskeyData(false);

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.CREATION_METHOD);
    });

    it('should log iCloud preservation message', async () => {
      await clearPasskeyData(false);

      expect(logger.debug).toHaveBeenCalledWith('iCloud backup preserved for restoration');
    });
  });

  describe('clearPasskeyData edge cases', () => {
    it('should handle undefined parameter', async () => {
      await clearPasskeyData(undefined);

      expect(clearICloud).not.toHaveBeenCalled();
    });

    it('should handle explicit false parameter', async () => {
      await clearPasskeyData(false);

      expect(clearICloud).not.toHaveBeenCalled();
    });

    it('should handle explicit true parameter', async () => {
      await clearPasskeyData(true);

      expect(clearICloud).toHaveBeenCalled();
    });
  });

  describe('removePasskey vs clearPasskeyData', () => {
    it('removePasskey should not clear creation method', async () => {
      await removePasskey();

      const calls = (SecureStore.deleteItemAsync as jest.Mock).mock.calls;
      const creationMethodDeleted = calls.some(call => call[0] === PASSKEY_KEYS.CREATION_METHOD);

      expect(creationMethodDeleted).toBe(false);
    });

    it('clearPasskeyData should clear creation method', async () => {
      await clearPasskeyData();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PASSKEY_KEYS.CREATION_METHOD);
    });

    it('removePasskey should throw on error', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(
        new Error('Error')
      );

      await expect(removePasskey()).rejects.toThrow();
    });

    it('clearPasskeyData should not throw on error', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(
        new Error('Error')
      );

      // Should not throw
      await expect(clearPasskeyData()).resolves.toBeUndefined();
    });
  });
});
