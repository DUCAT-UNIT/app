/**
 * Tests for Passkey Unlock Service
 * Covers unlockWithPasskey and recoverWithPasskey
 */

import * as SecureStore from 'expo-secure-store';
import { Passkey } from 'react-native-passkey';
import { SECURE_KEYS } from '../../../utils/constants';
import { logger } from '../../../utils/logger';

// Mock dependencies
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 8,
}));

jest.mock('react-native-passkey', () => ({
  Passkey: {
    get: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../utils/bitcoin', () => ({
  deriveAddressesFromMnemonic: jest.fn(() => ({
    segwitAddress: 'tb1q...',
    taprootAddress: 'tb1p...',
  })),
}));

jest.mock('../../icloudStorage', () => ({
  loadFromICloud: jest.fn(),
  checkICloudAvailability: jest.fn(),
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
    ENCRYPTED_MNEMONIC: 'passkey_encrypted_mnemonic_v1',
    ENCRYPTION_IV: 'passkey_encryption_iv_v1',
    ENCRYPTION_TAG: 'passkey_encryption_tag_v1',
    CREATION_METHOD: 'wallet_creation_method_v1',
    PRF_ENABLED: 'passkey_prf_enabled_v1',
    DERIVATION_VERSION: 'passkey_derivation_version_v1',
  },
  PRF_SALT: new Uint8Array(Buffer.from('ducat-wallet-prf-v1', 'utf8')),
  derivationVersionForPrf: jest.fn((prfEnabled: boolean) => (prfEnabled ? '5' : '4')),
  resolvePasskeyDerivationVersion: jest.fn(
    (storedVersion, prfEnabled) => storedVersion || (prfEnabled ? '5' : '4')
  ),
  isLegacyPasskeyDerivationVersion: jest.fn((version) => version === '4'),
  toBase64Url: jest.fn((buffer) =>
    Buffer.from(buffer)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/[=]/g, '')
  ),
  isPasskeySupported: jest.fn(),
}));

jest.mock('../encryption', () => ({
  deriveEncryptionKey: jest.fn(),
  decryptMnemonic: jest.fn(),
}));

// Note: react-native-quick-crypto is mocked globally in jest.setup.js with real node:crypto functions

// Mock pinService
jest.mock('../../pinService', () => ({
  savePinWithExistingSalt: jest.fn(),
}));

jest.mock('../../pinLockout', () => ({
  checkPinLockout: jest.fn(),
  recordFailedAttempt: jest.fn(),
}));

jest.mock('../../secureStorageService', () => ({
  cacheSessionMnemonic: jest.fn(),
  saveMnemonic: jest.fn(),
  saveCachedAddresses: jest.fn(),
  saveCurrentAccount: jest.fn(),
  saveToMultiAccountCache: jest.fn(),
}));

// Import mock reference
import { savePinWithExistingSalt } from '../../pinService';
import { checkPinLockout, recordFailedAttempt } from '../../pinLockout';
import {
  cacheSessionMnemonic,
  saveCachedAddresses,
  saveCurrentAccount,
  saveToMultiAccountCache,
} from '../../secureStorageService';
const mockSavePinWithExistingSalt = savePinWithExistingSalt as jest.Mock;
const mockCheckPinLockout = checkPinLockout as jest.Mock;
const mockRecordFailedAttempt = recordFailedAttempt as jest.Mock;
const mockCacheSessionMnemonic = cacheSessionMnemonic as jest.Mock;
const mockSaveCachedAddresses = saveCachedAddresses as jest.Mock;
const mockSaveCurrentAccount = saveCurrentAccount as jest.Mock;
const mockSaveToMultiAccountCache = saveToMultiAccountCache as jest.Mock;

// Import after mocks
import { loadFromICloud, checkICloudAvailability } from '../../icloudStorage';
import { isPasskeySupported, PASSKEY_KEYS } from '../core';
import { deriveEncryptionKey, decryptMnemonic } from '../encryption';
import { unlockWithPasskey, recoverWithPasskey } from '../unlock';

const DEVICE_ONLY = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

describe('Passkey Unlock', () => {
  const mockCredentialId = 'credential-id-base64';
  const mockUserHandle = 'user-handle-base64';
  const mockEncrypted = 'encrypted-data';
  const mockIv = 'iv-data';
  const mockTag = 'tag-data';
  const mockMnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const mockPin = '123456';
  const mockPinSalt = 'a'.repeat(64);
  const mockEncryptionKey = { type: 'secret' };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (Passkey.get as jest.Mock).mockResolvedValue({
      id: mockCredentialId,
      response: {},
    });
    (deriveEncryptionKey as jest.Mock).mockResolvedValue(mockEncryptionKey);
    (decryptMnemonic as jest.Mock).mockResolvedValue(mockMnemonic);
    (isPasskeySupported as jest.Mock).mockResolvedValue(true);
    (checkICloudAvailability as jest.Mock).mockResolvedValue({ available: true });
    mockCheckPinLockout.mockResolvedValue({ isLocked: false });
    mockRecordFailedAttempt.mockResolvedValue({ shouldLockout: false, newFailedAttempts: 1 });
    // Note: getRandomValues is provided by the global mock in jest.setup.js
    mockSavePinWithExistingSalt.mockResolvedValue(undefined);
    mockCacheSessionMnemonic.mockImplementation(() => undefined);
    mockSaveCachedAddresses.mockResolvedValue(true);
    mockSaveCurrentAccount.mockResolvedValue(true);
    mockSaveToMultiAccountCache.mockResolvedValue(true);
  });

  describe('unlockWithPasskey', () => {
    beforeEach(() => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === PASSKEY_KEYS.ENABLED) return Promise.resolve('true');
        if (key === PASSKEY_KEYS.CREDENTIAL_ID) return Promise.resolve(mockCredentialId);
        if (key === PASSKEY_KEYS.USER_HANDLE) return Promise.resolve(mockUserHandle);
        if (key === PASSKEY_KEYS.ENCRYPTED_MNEMONIC) return Promise.resolve(mockEncrypted);
        if (key === PASSKEY_KEYS.ENCRYPTION_IV) return Promise.resolve(mockIv);
        if (key === PASSKEY_KEYS.ENCRYPTION_TAG) return Promise.resolve(mockTag);
        if (key === SECURE_KEYS.PIN_SALT) return Promise.resolve(mockPinSalt);
        if (key === SECURE_KEYS.CURRENT_ACCOUNT) return Promise.resolve('0');
        return Promise.resolve(null);
      });
    });

    it('should unlock wallet successfully', async () => {
      const result = await unlockWithPasskey(mockPin);

      expect(result.mnemonic).toBe(mockMnemonic);
      expect(result.addresses).toBeDefined();
      expect(Passkey.get).toHaveBeenCalled();
      expect(deriveEncryptionKey).toHaveBeenCalled();
      expect(decryptMnemonic).toHaveBeenCalled();
      expect(mockCacheSessionMnemonic).toHaveBeenCalledWith(mockMnemonic);
    });

    it('should not start passkey auth while auth is locked out', async () => {
      mockCheckPinLockout.mockResolvedValue({ isLocked: true, remainingTime: 12 });

      await expect(unlockWithPasskey(mockPin)).rejects.toThrow(
        'Too many failed attempts. Try again in 12 minutes.'
      );

      expect(Passkey.get).not.toHaveBeenCalled();
      expect(mockRecordFailedAttempt).not.toHaveBeenCalled();
    });

    it('should throw if passkey not enabled', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === PASSKEY_KEYS.ENABLED) return Promise.resolve('false');
        return Promise.resolve(null);
      });

      await expect(unlockWithPasskey(mockPin)).rejects.toThrow(
        'Passkey is not enabled for this wallet'
      );
    });

    it('should throw if credential data not found', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === PASSKEY_KEYS.ENABLED) return Promise.resolve('true');
        return Promise.resolve(null);
      });

      await expect(unlockWithPasskey(mockPin)).rejects.toThrow('Passkey data not found in storage');
    });

    it('should throw if PIN is invalid', async () => {
      await expect(unlockWithPasskey('')).rejects.toThrow('PIN is required to unlock wallet');
      await expect(unlockWithPasskey('123')).rejects.toThrow('PIN is required to unlock wallet');
    });

    it('should throw if PIN salt is invalid', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === PASSKEY_KEYS.ENABLED) return Promise.resolve('true');
        if (key === PASSKEY_KEYS.CREDENTIAL_ID) return Promise.resolve(mockCredentialId);
        if (key === PASSKEY_KEYS.USER_HANDLE) return Promise.resolve(mockUserHandle);
        if (key === PASSKEY_KEYS.ENCRYPTED_MNEMONIC) return Promise.resolve(mockEncrypted);
        if (key === PASSKEY_KEYS.ENCRYPTION_IV) return Promise.resolve(mockIv);
        if (key === SECURE_KEYS.PIN_SALT) return Promise.resolve('invalid');
        return Promise.resolve(null);
      });

      await expect(unlockWithPasskey(mockPin)).rejects.toThrow('Invalid or corrupted PIN salt');
    });

    it('should create authentication request with allowCredentials', async () => {
      await unlockWithPasskey(mockPin);

      const authCall = (Passkey.get as jest.Mock).mock.calls[0][0];
      expect(authCall.allowCredentials).toEqual([
        {
          id: mockCredentialId,
          type: 'public-key',
        },
      ]);
    });

    it('should verify credential ID matches', async () => {
      (Passkey.get as jest.Mock).mockResolvedValue({
        id: 'different-credential-id',
        response: {},
      });

      await expect(unlockWithPasskey(mockPin)).rejects.toThrow('Credential ID mismatch');
    });

    it('should use account index from storage', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === PASSKEY_KEYS.ENABLED) return Promise.resolve('true');
        if (key === PASSKEY_KEYS.CREDENTIAL_ID) return Promise.resolve(mockCredentialId);
        if (key === PASSKEY_KEYS.USER_HANDLE) return Promise.resolve(mockUserHandle);
        if (key === PASSKEY_KEYS.ENCRYPTED_MNEMONIC) return Promise.resolve(mockEncrypted);
        if (key === PASSKEY_KEYS.ENCRYPTION_IV) return Promise.resolve(mockIv);
        if (key === PASSKEY_KEYS.ENCRYPTION_TAG) return Promise.resolve(mockTag);
        if (key === SECURE_KEYS.PIN_SALT) return Promise.resolve(mockPinSalt);
        if (key === SECURE_KEYS.CURRENT_ACCOUNT) return Promise.resolve('5');
        return Promise.resolve(null);
      });

      await unlockWithPasskey(mockPin);

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(SECURE_KEYS.CURRENT_ACCOUNT);
    });

    it('should default to account 0 if not set', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
        if (key === PASSKEY_KEYS.ENABLED) return Promise.resolve('true');
        if (key === PASSKEY_KEYS.CREDENTIAL_ID) return Promise.resolve(mockCredentialId);
        if (key === PASSKEY_KEYS.USER_HANDLE) return Promise.resolve(mockUserHandle);
        if (key === PASSKEY_KEYS.ENCRYPTED_MNEMONIC) return Promise.resolve(mockEncrypted);
        if (key === PASSKEY_KEYS.ENCRYPTION_IV) return Promise.resolve(mockIv);
        if (key === PASSKEY_KEYS.ENCRYPTION_TAG) return Promise.resolve(mockTag);
        if (key === SECURE_KEYS.PIN_SALT) return Promise.resolve(mockPinSalt);
        if (key === SECURE_KEYS.CURRENT_ACCOUNT) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      await unlockWithPasskey(mockPin);

      // Should not throw and use account 0
      expect(decryptMnemonic).toHaveBeenCalled();
    });

    it('should log error on failure', async () => {
      (Passkey.get as jest.Mock).mockRejectedValue(new Error('User cancelled'));

      await expect(unlockWithPasskey(mockPin)).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith('Failed to unlock with passkey', {
        error: 'User cancelled',
      });
    });
  });

  describe('recoverWithPasskey', () => {
    const mockBackup = {
      encrypted: mockEncrypted,
      iv: mockIv,
      tag: mockTag,
      credentialId: mockCredentialId,
      userHandle: mockUserHandle,
      pinSalt: mockPinSalt,
    };

    beforeEach(() => {
      (loadFromICloud as jest.Mock).mockResolvedValue(mockBackup);
    });

    it('should recover wallet successfully', async () => {
      const result = await recoverWithPasskey(mockPin);

      expect(result.mnemonic).toBe(mockMnemonic);
      expect(result.addresses).toBeDefined();
      expect(isPasskeySupported).toHaveBeenCalled();
      expect(checkICloudAvailability).toHaveBeenCalled();
      expect(loadFromICloud).toHaveBeenCalled();
      expect(Passkey.get).toHaveBeenCalled();
      expect(deriveEncryptionKey).toHaveBeenCalled();
      expect(decryptMnemonic).toHaveBeenCalled();
    });

    it('should throw if passkeys not supported', async () => {
      (isPasskeySupported as jest.Mock).mockResolvedValue(false);

      await expect(recoverWithPasskey(mockPin)).rejects.toThrow('Passkeys not supported');
    });

    it('should throw if iCloud not available', async () => {
      (checkICloudAvailability as jest.Mock).mockResolvedValue({
        available: false,
        error: 'Not signed in',
      });

      await expect(recoverWithPasskey(mockPin)).rejects.toThrow('iCloud not available');
    });

    it('should throw if iCloud backup not found', async () => {
      (loadFromICloud as jest.Mock).mockResolvedValue(null);

      await expect(recoverWithPasskey(mockPin)).rejects.toThrow('No data in iCloud');
    });

    it('should throw if iCloud load fails', async () => {
      (loadFromICloud as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(recoverWithPasskey(mockPin)).rejects.toThrow('iCloud load failed');
    });

    it('should throw if PIN is invalid', async () => {
      await expect(recoverWithPasskey('')).rejects.toThrow('Invalid PIN');
      await expect(recoverWithPasskey('123')).rejects.toThrow('Invalid PIN');
    });

    it('should throw if PIN salt is invalid', async () => {
      (loadFromICloud as jest.Mock).mockResolvedValue({
        ...mockBackup,
        pinSalt: 'invalid',
      });

      await expect(recoverWithPasskey(mockPin)).rejects.toThrow('Invalid PIN salt');
    });

    it('should throw if passkey authentication fails', async () => {
      (Passkey.get as jest.Mock).mockRejectedValue(new Error('User cancelled'));

      await expect(recoverWithPasskey(mockPin)).rejects.toThrow('Passkey auth failed');
    });

    it('should throw if decryption fails', async () => {
      (decryptMnemonic as jest.Mock).mockRejectedValue(new Error('Wrong key'));

      await expect(recoverWithPasskey(mockPin)).rejects.toThrow('Decryption failed');
    });

    it('should store recovered data in SecureStore', async () => {
      await recoverWithPasskey(mockPin);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.ENABLED,
        'true',
        DEVICE_ONLY
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.CREATION_METHOD,
        'passkey',
        DEVICE_ONLY
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.CREDENTIAL_ID,
        mockCredentialId,
        DEVICE_ONLY
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.USER_HANDLE,
        mockUserHandle,
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
      expect(mockCacheSessionMnemonic).toHaveBeenCalledWith(mockMnemonic);
      expect(mockSaveCachedAddresses).toHaveBeenCalled();
      expect(mockSaveCurrentAccount).toHaveBeenCalledWith(0);
      expect(mockSaveToMultiAccountCache).toHaveBeenCalled();
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        SECURE_KEYS.PIN_SALT,
        mockPinSalt,
        DEVICE_ONLY
      );
    });

    it('should save PIN with existing salt', async () => {
      await recoverWithPasskey(mockPin);

      expect(mockSavePinWithExistingSalt).toHaveBeenCalledWith(mockPin, mockPinSalt);
    });

    it('should fail recovery if hardened current-account storage fails', async () => {
      mockSaveCurrentAccount.mockResolvedValue(false);

      await expect(recoverWithPasskey(mockPin)).rejects.toThrow(
        'Failed to save current account securely'
      );
    });

    it('should use discovery mode (no allowCredentials)', async () => {
      await recoverWithPasskey(mockPin);

      const authCall = (Passkey.get as jest.Mock).mock.calls[0][0];
      expect(authCall.allowCredentials).toBeUndefined();
    });

    it('should include debug steps in error', async () => {
      (isPasskeySupported as jest.Mock).mockResolvedValue(false);

      try {
        await recoverWithPasskey(mockPin);
      } catch (error) {
        expect((error as Error).message).toContain('Starting recovery');
        expect((error as Error).message).toContain('Checking passkey support');
      }
    });

    it('should preserve debug steps if already in error', async () => {
      const errorWithSteps = new Error('Starting recovery...\nCustom error');
      (loadFromICloud as jest.Mock).mockRejectedValue(errorWithSteps);

      try {
        await recoverWithPasskey(mockPin);
      } catch (error) {
        // Error message should contain the original custom error
        expect((error as Error).message).toContain('Custom error');
      }
    });

    it('should log iCloud keys found', async () => {
      await recoverWithPasskey(mockPin);

      // Should log the backup keys found
      expect(loadFromICloud).toHaveBeenCalled();
    });

    it('should handle backup without tag', async () => {
      (loadFromICloud as jest.Mock).mockResolvedValue({
        ...mockBackup,
        tag: undefined,
      });

      await recoverWithPasskey(mockPin);

      // Should not set tag if not in backup
      const tagCalls = (SecureStore.setItemAsync as jest.Mock).mock.calls.filter(
        (call) => call[0] === PASSKEY_KEYS.ENCRYPTION_TAG
      );
      expect(tagCalls.length).toBe(0);
    });

    it('should set tag if present in backup', async () => {
      await recoverWithPasskey(mockPin);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSKEY_KEYS.ENCRYPTION_TAG,
        mockTag,
        DEVICE_ONLY
      );
    });

    it('should log error with debug steps on failure', async () => {
      (Passkey.get as jest.Mock).mockRejectedValue(new Error('Auth failed'));

      await expect(recoverWithPasskey(mockPin)).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to recover with passkey',
        expect.any(Object)
      );
    });
  });
});
