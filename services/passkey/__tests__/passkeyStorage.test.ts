/**
 * Tests for Passkey Data Storage Utilities
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../../utils/logger';
import { saveToICloud, loadFromICloud } from '../../icloudStorage';
import { saveCurrentAccount, saveMnemonic } from '../../secureStorageService';

/**
 * Interface for error objects with optional code and name
 */
interface ErrorWithCode extends Error {
  code?: string;
  name: string;
}

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 8,
}));

// Mock icloudStorage
jest.mock('../../icloudStorage', () => ({
  saveToICloud: jest.fn(),
  loadFromICloud: jest.fn(),
}));

jest.mock('../../secureStorageService', () => ({
  saveMnemonic: jest.fn(),
  saveCurrentAccount: jest.fn(),
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import after mocks
import { PASSKEY_KEYS } from '../core';
import {
  storePasskeyData,
  backupToICloudWithVerification,
  storeStandardMnemonic,
  setCurrentAccount,
} from '../passkeyStorage';

const DEVICE_ONLY = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

describe('Passkey Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (saveMnemonic as jest.Mock).mockResolvedValue(undefined);
    (saveCurrentAccount as jest.Mock).mockResolvedValue(true);
  });

  describe('storePasskeyData', () => {
    const mockCredentialId = new Uint8Array([1, 2, 3, 4, 5]);
    const mockUserHandle = new Uint8Array([6, 7, 8, 9, 10]);
    const mockEncrypted = 'encryptedMnemonicBase64';
    const mockIv = 'ivBase64';
    const mockTag = 'tagBase64';

    it('should store all passkey data in SecureStore', async () => {
      await storePasskeyData({
        credentialId: mockCredentialId,
        userHandle: mockUserHandle,
        encrypted: mockEncrypted,
        iv: mockIv,
        tag: mockTag,
      });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.ENABLED,
        'true',
        DEVICE_ONLY
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.CREDENTIAL_ID,
        Buffer.from(mockCredentialId).toString('base64'),
        DEVICE_ONLY
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.USER_HANDLE,
        Buffer.from(mockUserHandle).toString('base64'),
        DEVICE_ONLY
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.ENCRYPTED_MNEMONIC,
        mockEncrypted,
        DEVICE_ONLY
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.ENCRYPTION_IV,
        mockIv,
        DEVICE_ONLY
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.ENCRYPTION_TAG,
        mockTag,
        DEVICE_ONLY
      );
    });

    it('should store creation method when provided', async () => {
      await storePasskeyData({
        credentialId: mockCredentialId,
        userHandle: mockUserHandle,
        encrypted: mockEncrypted,
        iv: mockIv,
        tag: mockTag,
        creationMethod: 'passkey',
      });

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.CREATION_METHOD,
        'passkey',
        DEVICE_ONLY
      );
    });

    it('should not store creation method when not provided', async () => {
      await storePasskeyData({
        credentialId: mockCredentialId,
        userHandle: mockUserHandle,
        encrypted: mockEncrypted,
        iv: mockIv,
        tag: mockTag,
      });

      // Check that setItemAsync was not called with CREATION_METHOD
      const calls = (SecureStore.setItemAsync as jest.Mock).mock.calls;
      const creationMethodCall = calls.find(
        (call) => call[0] === PASSKEY_KEYS.CREATION_METHOD
      );
      expect(creationMethodCall).toBeUndefined();
    });
  });

  describe('backupToICloudWithVerification', () => {
    const mockBackupData = {
      encrypted: 'encryptedData',
      iv: 'ivData',
      tag: 'tagData',
      credentialId: new Uint8Array([1, 2, 3]),
      userHandle: new Uint8Array([4, 5, 6]),
      pinSalt: 'a'.repeat(64),
    };

    it('should save to iCloud and verify', async () => {
      const mockDebugInfo = 'Save successful';
      (saveToICloud as jest.Mock).mockResolvedValue(mockDebugInfo);
      (loadFromICloud as jest.Mock).mockResolvedValue({
        encrypted: mockBackupData.encrypted,
        iv: mockBackupData.iv,
        tag: mockBackupData.tag,
      });

      const result = await backupToICloudWithVerification(mockBackupData);

      expect(result.debugInfo).toBe(mockDebugInfo);
      expect(result.verificationLog).toContain('VERIFICATION');
      expect(result.verificationLog).toContain('iCloud data verified');
    });

    it('should call saveToICloud with correct data', async () => {
      (saveToICloud as jest.Mock).mockResolvedValue('');
      (loadFromICloud as jest.Mock).mockResolvedValue({});

      await backupToICloudWithVerification(mockBackupData);

      expect(saveToICloud).toHaveBeenCalledWith({
        encrypted: mockBackupData.encrypted,
        iv: mockBackupData.iv,
        tag: mockBackupData.tag,
        credentialId: Buffer.from(mockBackupData.credentialId).toString('base64'),
        userHandle: Buffer.from(mockBackupData.userHandle).toString('base64'),
        pinSalt: mockBackupData.pinSalt,
      });
    });

    it('should log debug message on success', async () => {
      (saveToICloud as jest.Mock).mockResolvedValue('');
      (loadFromICloud as jest.Mock).mockResolvedValue({});

      await backupToICloudWithVerification(mockBackupData);

      expect(logger.debug).toHaveBeenCalledWith('Encrypted backup saved to iCloud');
    });

    it('should include debug info from verification read-back', async () => {
      (saveToICloud as jest.Mock).mockResolvedValue('');
      (loadFromICloud as jest.Mock).mockResolvedValue({
        encrypted: 'test',
        _debugInfo: 'Additional debug info',
      });

      const result = await backupToICloudWithVerification(mockBackupData);

      expect(result.verificationLog).toContain('Additional debug info');
    });

    it('should handle verification failure gracefully', async () => {
      (saveToICloud as jest.Mock).mockResolvedValue('');
      (loadFromICloud as jest.Mock).mockRejectedValue(new Error('Read-back failed'));

      const result = await backupToICloudWithVerification(mockBackupData);

      expect(result.verificationLog).toContain('iCloud verification failed');
      expect(result.verificationLog).toContain('Read-back failed');
    });

    it('should throw detailed error when saveToICloud fails', async () => {
      const error = new Error('iCloud not available') as ErrorWithCode;
      error.code = 'ERR_ICLOUD_NOT_AVAILABLE';
      error.name = 'iCloudError';
      (saveToICloud as jest.Mock).mockRejectedValue(error);

      await expect(backupToICloudWithVerification(mockBackupData)).rejects.toThrow(
        'iCloud backup failed'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'CRITICAL: iCloud backup failed',
        expect.objectContaining({
          error: 'iCloud not available',
          errorCode: 'ERR_ICLOUD_NOT_AVAILABLE',
          errorName: 'iCloudError',
        })
      );
    });

    it('should include troubleshooting info in error message', async () => {
      (saveToICloud as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(backupToICloudWithVerification(mockBackupData)).rejects.toThrow(
        /Check:/
      );
      await expect(backupToICloudWithVerification(mockBackupData)).rejects.toThrow(
        /iCloud is enabled/
      );
    });
  });

  describe('storeStandardMnemonic', () => {
    it('should store mnemonic in SECURE_KEYS.MNEMONIC', async () => {
      const mnemonic = 'test mnemonic phrase';

      await storeStandardMnemonic(mnemonic);

      expect(saveMnemonic).toHaveBeenCalledWith(mnemonic);
    });
  });

  describe('setCurrentAccount', () => {
    it('should store account index as string', async () => {
      await setCurrentAccount(5);

      expect(saveCurrentAccount).toHaveBeenCalledWith(5);
    });

    it('should default to account 0', async () => {
      await setCurrentAccount();

      expect(saveCurrentAccount).toHaveBeenCalledWith(0);
    });

    it('should handle account index 0 explicitly', async () => {
      await setCurrentAccount(0);

      expect(saveCurrentAccount).toHaveBeenCalledWith(0);
    });

    it('should throw when secure account storage fails', async () => {
      (saveCurrentAccount as jest.Mock).mockResolvedValue(false);

      await expect(setCurrentAccount(1)).rejects.toThrow('Failed to save current account securely');
    });
  });
});
