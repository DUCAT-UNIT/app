/**
 * Tests for iCloud Storage Service
 */

import {
  checkICloudAvailability,
  saveToICloud,
  loadFromICloud,
  hasICloudBackup,
  clearICloud,
} from '../icloudStorage';
import iCloudStorage from 'react-native-icloudstore';
import { Platform } from 'react-native';

// Mock react-native-icloudstore
jest.mock('react-native-icloudstore', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

/**
 * Error type with optional code property (common in native modules)
 */
interface ICloudError extends Error {
  code?: string;
}

/**
 * Mutable platform type for testing
 */
interface MutablePlatform {
  OS: string;
}

// Typed mock references
const mockGetItem = iCloudStorage.getItem as jest.MockedFunction<typeof iCloudStorage.getItem>;
const mockSetItem = iCloudStorage.setItem as jest.MockedFunction<typeof iCloudStorage.setItem>;
const mockRemoveItem = iCloudStorage.removeItem as jest.MockedFunction<typeof iCloudStorage.removeItem>;

describe('iCloudStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Platform.OS to ios for each test
    (Platform as MutablePlatform).OS = 'ios';
  });

  describe('checkICloudAvailability', () => {
    it('should return available when iCloud is accessible', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await checkICloudAvailability();

      expect(result).toEqual({ available: true });
      expect(mockGetItem).toHaveBeenCalledWith('__icloud_test_key__');
    });

    it('should return unavailable on non-iOS platform', async () => {
      (Platform as MutablePlatform).OS = 'android';

      const result = await checkICloudAvailability();

      expect(result).toEqual({
        available: false,
        error: 'iCloud is only available on iOS',
      });
    });

    it('should return unavailable when iCloud storage not available', async () => {
      const error = new Error('iCloud not available');
      (error as ICloudError).code = 'ICLOUD_STORAGE_NOT_AVAILABLE';
      mockGetItem.mockRejectedValue(error);

      const result = await checkICloudAvailability();

      expect(result).toEqual({
        available: false,
        error: 'iCloud is not available. Please sign into iCloud in Settings and enable iCloud Drive.',
      });
    });

    it('should return unavailable when app not entitled', async () => {
      const error = new Error('App is not entitled for iCloud');
      mockGetItem.mockRejectedValue(error);

      const result = await checkICloudAvailability();

      expect(result).toEqual({
        available: false,
        error: 'App is not entitled for iCloud access. This is a configuration issue.',
      });
    });

    it('should return available when key does not exist but iCloud is accessible', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await checkICloudAvailability();

      expect(result).toEqual({ available: true });
    });

    it('should return available when getItem throws unknown error (iCloud accessible but key not found)', async () => {
      // Throw an error that is NOT ICLOUD_STORAGE_NOT_AVAILABLE and NOT "not entitled"
      const error = new Error('Key not found');
      (error as ICloudError).code = 'KEY_NOT_FOUND';
      mockGetItem.mockRejectedValue(error);

      const result = await checkICloudAvailability();

      // This should hit line 63 - returning available: true because iCloud is accessible
      expect(result).toEqual({ available: true });
    });

    it('should handle outer try-catch errors', async () => {
      // Force outer error by making Platform.OS throw
      Object.defineProperty(Platform, 'OS', {
        get() {
          throw new Error('Unexpected error');
        },
        configurable: true,
      });

      const result = await checkICloudAvailability();

      expect(result.available).toBe(false);
      expect(result.error).toContain('Failed to check iCloud');

      // Reset Platform.OS
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
        writable: true,
      });
    });
  });

  describe('saveToICloud', () => {
    const validBackupData = {
      encrypted: 'encrypted-data',
      iv: 'iv-data',
      tag: 'tag-data',
      credentialId: 'cred-id',
      userHandle: 'user-handle',
      pinSalt: 'pin-salt',
    };

    it('should save all data to iCloud successfully (atomic v2 format)', async () => {
      mockSetItem.mockResolvedValue();

      const result = await saveToICloud(validBackupData);

      // Now uses single atomic backup instead of 6 separate keys
      expect(result).toContain('Atomic backup saved successfully');
      expect(result).toContain('Backup saved successfully with atomic write protection');

      // Verify atomic backup was saved with correct key
      expect(mockSetItem).toHaveBeenCalledWith('ducat_backup_v2', expect.stringContaining('"version":2'));
      expect(mockSetItem).toHaveBeenCalledWith('ducat_backup_v2', expect.stringContaining('"encrypted":"encrypted-data"'));
    });

    it('should include debug info in result', async () => {
      mockSetItem.mockResolvedValue();

      const result = await saveToICloud(validBackupData);

      expect(result).toContain('iCloud Save Debug');
      expect(result).toContain('Input validation');
      // Now uses atomic backup format
      expect(result).toContain('Saving atomic backup to iCloud');
    });

    it('should throw error with debug info when setItem fails', async () => {
      const error = new Error('Storage full');
      (error as ICloudError).code = 'STORAGE_FULL';
      mockSetItem.mockRejectedValue(error);

      await expect(saveToICloud(validBackupData)).rejects.toThrow('iCloud Save Debug');
    });

    it('should include error details in thrown error', async () => {
      const error = new Error('Storage full');
      (error as ICloudError).code = 'STORAGE_FULL';
      mockSetItem.mockRejectedValue(error);

      try {
        await saveToICloud(validBackupData);
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('SAVE FAILED');
        expect((e as Error).message).toContain('Storage full');
        expect((e as Error).message).toContain('STORAGE_FULL');
      }
    });

    it('should log input validation info', async () => {
      mockSetItem.mockResolvedValue();

      const result = await saveToICloud(validBackupData);

      expect(result).toContain('encrypted: true');
      expect(result).toContain('iv: true');
      expect(result).toContain('tag: true');
      expect(result).toContain('credentialId: true');
      expect(result).toContain('userHandle: true');
      expect(result).toContain('pinSalt: true');
    });

    it('should handle undefined/null values in input', async () => {
      mockSetItem.mockResolvedValue();

      const dataWithNulls = {
        encrypted: '',
        iv: '',
        tag: '',
        credentialId: '',
        userHandle: '',
        pinSalt: '',
      };

      const result = await saveToICloud(dataWithNulls);

      expect(result).toContain('(length: 0)');
    });
  });

  describe('loadFromICloud', () => {
    it('should load all data from iCloud successfully (v2 atomic format)', async () => {
      // New v2 atomic backup format
      const atomicBackup = JSON.stringify({
        version: 2,
        encrypted: 'encrypted-data',
        iv: 'iv-data',
        tag: 'tag-data',
        credentialId: 'cred-id',
        userHandle: 'user-handle',
        pinSalt: 'pin-salt',
        timestamp: Date.now(),
      });

      mockGetItem.mockImplementation((key) => {
        if (key === 'ducat_backup_v2') {
          return Promise.resolve(atomicBackup);
        }
        return Promise.resolve(null);
      });

      const result = await loadFromICloud();

      expect(result.encrypted).toBe('encrypted-data');
      expect(result.iv).toBe('iv-data');
      expect(result.tag).toBe('tag-data');
      expect(result.credentialId).toBe('cred-id');
      expect(result.userHandle).toBe('user-handle');
      expect(result.pinSalt).toBe('pin-salt');
      expect(result._debugInfo).toContain('Atomic backup loaded successfully');
    });

    it('should throw error when no backup exists', async () => {
      mockGetItem.mockResolvedValue(null);

      await expect(loadFromICloud()).rejects.toThrow('backup does not exist');
    });

    it('should throw error when IV is missing', async () => {
      mockGetItem.mockImplementation((key) => {
        const data: Record<string, string | null> = {
          'ducat_encrypted_mnemonic_v1': 'encrypted-data',
          'ducat_encryption_iv_v1': null,
          'ducat_credential_id_v1': 'cred-id',
          'ducat_user_handle_v1': 'user-handle',
          'ducat_pin_salt_v1': 'pin-salt',
        };
        return Promise.resolve(data[key]);
      });

      await expect(loadFromICloud()).rejects.toThrow('INCOMPLETE DATA');
    });

    it('should throw error when credentialId is missing', async () => {
      mockGetItem.mockImplementation((key) => {
        const data: Record<string, string | null> = {
          'ducat_encrypted_mnemonic_v1': 'encrypted-data',
          'ducat_encryption_iv_v1': 'iv-data',
          'ducat_credential_id_v1': null,
          'ducat_user_handle_v1': 'user-handle',
          'ducat_pin_salt_v1': 'pin-salt',
        };
        return Promise.resolve(data[key]);
      });

      await expect(loadFromICloud()).rejects.toThrow('INCOMPLETE DATA');
    });

    it('should throw error when userHandle is missing', async () => {
      mockGetItem.mockImplementation((key) => {
        const data: Record<string, string | null> = {
          'ducat_encrypted_mnemonic_v1': 'encrypted-data',
          'ducat_encryption_iv_v1': 'iv-data',
          'ducat_credential_id_v1': 'cred-id',
          'ducat_user_handle_v1': null,
          'ducat_pin_salt_v1': 'pin-salt',
        };
        return Promise.resolve(data[key]);
      });

      await expect(loadFromICloud()).rejects.toThrow('INCOMPLETE DATA');
    });

    it('should throw error when pinSalt is missing', async () => {
      mockGetItem.mockImplementation((key) => {
        const data: Record<string, string | null> = {
          'ducat_encrypted_mnemonic_v1': 'encrypted-data',
          'ducat_encryption_iv_v1': 'iv-data',
          'ducat_credential_id_v1': 'cred-id',
          'ducat_user_handle_v1': 'user-handle',
          'ducat_pin_salt_v1': null,
        };
        return Promise.resolve(data[key]);
      });

      await expect(loadFromICloud()).rejects.toThrow('INCOMPLETE DATA');
    });

    it('should handle missing tag gracefully (optional field)', async () => {
      mockGetItem.mockImplementation((key) => {
        const data: Record<string, string | null> = {
          'ducat_encrypted_mnemonic_v1': 'encrypted-data',
          'ducat_encryption_iv_v1': 'iv-data',
          'ducat_encryption_tag_v1': null,
          'ducat_credential_id_v1': 'cred-id',
          'ducat_user_handle_v1': 'user-handle',
          'ducat_pin_salt_v1': 'pin-salt',
        };
        return Promise.resolve(data[key]);
      });

      const result = await loadFromICloud();

      expect(result.tag).toBe('');
    });

    it('should include debug info when load fails', async () => {
      const error = new Error('Network error');
      (error as ICloudError).code = 'NETWORK_ERROR';
      mockGetItem.mockRejectedValue(error);

      try {
        await loadFromICloud();
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('iCloud Load Debug');
        expect((e as Error).message).toContain('Load failed');
        expect((e as Error).message).toContain('Network error');
      }
    });

    it('should preserve debug info from thrown errors', async () => {
      mockGetItem.mockImplementation((key) => {
        if (key === 'ducat_encrypted_mnemonic_v1') {
          return Promise.resolve('encrypted-data');
        }
        throw new Error('iCloud Load Debug: Custom error message');
      });

      await expect(loadFromICloud()).rejects.toThrow('iCloud Load Debug: Custom error message');
    });
  });

  describe('hasICloudBackup', () => {
    it('should return true when backup exists', async () => {
      mockGetItem.mockResolvedValue('encrypted-data');

      const result = await hasICloudBackup();

      expect(result).toBe(true);
      // Now uses atomic backup key v2
      expect(mockGetItem).toHaveBeenCalledWith('ducat_backup_v2');
    });

    it('should return false when no backup exists', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await hasICloudBackup();

      expect(result).toBe(false);
    });

    it('should throw enhanced error when iCloud not available', async () => {
      const error = new Error('iCloud not available');
      (error as ICloudError).code = 'ICLOUD_STORAGE_NOT_AVAILABLE';
      mockGetItem.mockRejectedValue(error);

      await expect(hasICloudBackup()).rejects.toThrow('iCloud is not available');
      await expect(hasICloudBackup()).rejects.toThrow("You're signed into iCloud");
    });

    it('should throw enhanced error when not entitled', async () => {
      const error = new Error('App not entitled for iCloud');
      mockGetItem.mockRejectedValue(error);

      await expect(hasICloudBackup()).rejects.toThrow('App not entitled for iCloud');
      await expect(hasICloudBackup()).rejects.toThrow('contact support');
    });

    it('should throw generic error for other failures', async () => {
      const error = new Error('Unknown error');
      (error as ICloudError).code = 'UNKNOWN';
      mockGetItem.mockRejectedValue(error);

      await expect(hasICloudBackup()).rejects.toThrow('iCloud access failed: Unknown error');
      await expect(hasICloudBackup()).rejects.toThrow('(code: UNKNOWN)');
    });

    it('should include error code in thrown error', async () => {
      const error = new Error('Test error');
      mockGetItem.mockRejectedValue(error);

      await expect(hasICloudBackup()).rejects.toThrow('(code: N/A)');
    });
  });

  describe('clearICloud', () => {
    it('should clear all iCloud data successfully', async () => {
      mockRemoveItem.mockResolvedValue();

      await clearICloud();

      expect(mockRemoveItem).toHaveBeenCalledWith('ducat_encrypted_mnemonic_v1');
      expect(mockRemoveItem).toHaveBeenCalledWith('ducat_encryption_iv_v1');
      expect(mockRemoveItem).toHaveBeenCalledWith('ducat_encryption_tag_v1');
      expect(mockRemoveItem).toHaveBeenCalledWith('ducat_credential_id_v1');
      expect(mockRemoveItem).toHaveBeenCalledWith('ducat_user_handle_v1');
      expect(mockRemoveItem).toHaveBeenCalledWith('ducat_pin_salt_v1');
    });

    it('should throw error when clearing fails', async () => {
      const error = new Error('Clear failed');
      mockRemoveItem.mockRejectedValue(error);

      await expect(clearICloud()).rejects.toThrow('Clear failed');
    });

    it('should call removeItem 7 times for all keys (1 v2 + 6 v1 legacy)', async () => {
      mockRemoveItem.mockResolvedValue();

      await clearICloud();

      // 1 atomic v2 key + 6 legacy v1 keys
      expect(mockRemoveItem).toHaveBeenCalledTimes(7);
    });
  });
});
