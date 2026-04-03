/**
 * Tests for Passkey Creation Service
 * Covers createWalletWithPasskey and addPasskeyToExistingWallet
 */

import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../../../utils/constants';
import { logger } from '../../../utils/logger';

// Mock dependencies
jest.mock('bip39', () => ({
  generateMnemonic: jest.fn(),
  validateMnemonic: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
}));

jest.mock('../../../utils/bitcoin', () => ({
  deriveAddressesFromMnemonic: jest.fn(() => ({
    segwitAddress: 'tb1q...',
    taprootAddress: 'tb1p...',
  })),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../icloudStorage', () => ({
  checkICloudAvailability: jest.fn(),
  saveToICloud: jest.fn(),
  loadFromICloud: jest.fn(),
}));

jest.mock('../core', () => ({
  PASSKEY_KEYS: {
    PRF_ENABLED: 'passkey_prf_enabled_v1',
    DERIVATION_VERSION: 'passkey_derivation_version_v1',
  },
  PASSKEY_DERIVATION_VERSION: {
    LEGACY_V4: '4',
    PRF_V5: '5',
  },
  derivationVersionForPrf: jest.fn((prfEnabled: boolean) => (prfEnabled ? '5' : '4')),
  isPasskeySupported: jest.fn(),
}));

jest.mock('../encryption', () => ({
  generateRandomMnemonic: jest.fn(),
  deriveEncryptionKey: jest.fn(),
  encryptMnemonic: jest.fn(),
}));

jest.mock('../credentialCreation', () => ({
  createPasskeyCredential: jest.fn(),
}));

jest.mock('../passkeyStorage', () => ({
  storePasskeyData: jest.fn(),
  backupToICloudWithVerification: jest.fn(),
  setCurrentAccount: jest.fn(),
}));

// Import after mocks
import { checkICloudAvailability, saveToICloud } from '../../icloudStorage';
import { isPasskeySupported } from '../core';
import { generateRandomMnemonic, deriveEncryptionKey, encryptMnemonic } from '../encryption';
import { createPasskeyCredential } from '../credentialCreation';
import {
  storePasskeyData,
  backupToICloudWithVerification,
  setCurrentAccount,
} from '../passkeyStorage';
import { createWalletWithPasskey, addPasskeyToExistingWallet } from '../creation';

// Mock the pinService module
jest.mock('../../pinService', () => ({
  savePinWithHash: jest.fn(),
  savePin: jest.fn(),
  hashPinForEncryption: jest.fn(),
}));

// Import mock reference after declaration
import * as pinService from '../../pinService';
const mockSavePinWithHash = pinService.savePinWithHash as jest.Mock;
const mockSavePin = pinService.savePin as jest.Mock;

describe('Passkey Creation', () => {
  const mockCredentialId = new Uint8Array([1, 2, 3, 4, 5]);
  const mockUserHandle = new Uint8Array([6, 7, 8, 9, 10]);
  const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const mockEncrypted = 'encryptedData';
  const mockIv = 'ivData';
  const mockTag = 'tagData';
  const mockEncryptionKey = { type: 'secret', extractable: false };
  const mockHashedPin = 'a'.repeat(64);
  const mockPinSalt = 'b'.repeat(64);
  const mockPepper = 'c'.repeat(32);

  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful mocks
    (isPasskeySupported as jest.Mock).mockResolvedValue(true);
    (checkICloudAvailability as jest.Mock).mockResolvedValue({ available: true });
    (createPasskeyCredential as jest.Mock).mockResolvedValue({
      credentialId: mockCredentialId,
      userHandle: mockUserHandle,
      prfEnabled: false,
      prfResult: null,
    });
    (generateRandomMnemonic as jest.Mock).mockReturnValue(mockMnemonic);
    (bip39.generateMnemonic as jest.Mock).mockReturnValue(mockMnemonic);
    (bip39.validateMnemonic as jest.Mock).mockReturnValue(true);
    mockSavePinWithHash.mockResolvedValue({
      hashedPin: mockHashedPin,
      salt: mockPinSalt,
    });
    (deriveEncryptionKey as jest.Mock).mockResolvedValue(mockEncryptionKey);
    (encryptMnemonic as jest.Mock).mockResolvedValue({
      encrypted: mockEncrypted,
      iv: mockIv,
      tag: mockTag,
    });
    (storePasskeyData as jest.Mock).mockResolvedValue(undefined);
    (setCurrentAccount as jest.Mock).mockResolvedValue(undefined);
    (backupToICloudWithVerification as jest.Mock).mockResolvedValue({
      success: true,
      debugInfo: 'Backup successful',
      verificationLog: 'Verified',
    });
    // Default: return pepper when asked, pinSalt for addPasskeyToExistingWallet
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === SECURE_KEYS.PASSKEY_PEPPER) return Promise.resolve(mockPepper);
      if (key === SECURE_KEYS.PIN_SALT) return Promise.resolve(mockPinSalt);
      return Promise.resolve(null);
    });
  });

  describe('createWalletWithPasskey', () => {
    it('should create wallet successfully with all steps', async () => {
      const result = await createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '123456',
      });

      expect(result.mnemonic).toBe(mockMnemonic);
      expect(result.addresses).toBeDefined();
      expect(result.credentialId).toBeDefined();
      expect(result.icloudBackupPromise).toBeDefined();

      // Verify all steps were called
      expect(isPasskeySupported).toHaveBeenCalled();
      expect(checkICloudAvailability).toHaveBeenCalled();
      expect(createPasskeyCredential).toHaveBeenCalledWith('test@example.com', 'Test User');
      expect(generateRandomMnemonic).toHaveBeenCalled();
      expect(mockSavePinWithHash).toHaveBeenCalledWith('123456');
      expect(deriveEncryptionKey).toHaveBeenCalledWith(
        mockCredentialId,
        mockUserHandle,
        mockHashedPin,
        mockPinSalt,
        true,
        null
      );
      expect(encryptMnemonic).toHaveBeenCalledWith(mockMnemonic, mockEncryptionKey);
      expect(storePasskeyData).toHaveBeenCalledWith({
        credentialId: mockCredentialId,
        userHandle: mockUserHandle,
        encrypted: mockEncrypted,
        iv: mockIv,
        tag: mockTag,
        creationMethod: 'passkey',
      });
      expect(setCurrentAccount).toHaveBeenCalledWith(0);
    });

    it('should throw error if passkeys not supported', async () => {
      (isPasskeySupported as jest.Mock).mockResolvedValue(false);

      await expect(createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '123456',
      })).rejects.toThrow('Passkeys not supported');
    });

    it('should throw error if iCloud not available', async () => {
      (checkICloudAvailability as jest.Mock).mockResolvedValue({
        available: false,
        error: 'Not signed in',
      });

      await expect(createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '123456',
      })).rejects.toThrow('iCloud not available');
    });

    it('should throw error if PIN is invalid', async () => {
      await expect(createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '123',
      })).rejects.toThrow('PIN is required');

      await expect(createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '',
      })).rejects.toThrow('PIN is required');
    });

    it('should throw error if PIN salt is invalid', async () => {
      mockSavePinWithHash.mockResolvedValue({
        hashedPin: mockHashedPin,
        salt: 'invalid-salt',
      });

      await expect(createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '123456',
      })).rejects.toThrow('Invalid or missing PIN salt');
    });

    it('should throw error if PIN salt is missing', async () => {
      mockSavePinWithHash.mockResolvedValue({
        hashedPin: mockHashedPin,
        salt: '',
      });

      await expect(createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '123456',
      })).rejects.toThrow('Invalid or missing PIN salt');
    });

    it('should return backup promise that resolves successfully', async () => {
      const result = await createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '123456',
      });

      const backupResult = await result.icloudBackupPromise;
      expect(backupResult.success).toBe(true);
      expect(backupResult.debugInfo).toBeDefined();
    });

    it('should return backup promise that handles failure gracefully', async () => {
      (backupToICloudWithVerification as jest.Mock).mockRejectedValue(
        new Error('iCloud backup failed')
      );

      const result = await createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '123456',
      });

      const backupResult = await result.icloudBackupPromise;
      expect(backupResult.success).toBe(false);
      expect(backupResult.error).toBe('iCloud backup failed');
    });

    it('should include debug log in error messages', async () => {
      (createPasskeyCredential as jest.Mock).mockRejectedValue(
        new Error('User cancelled')
      );

      await expect(createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '123456',
      })).rejects.toThrow('WALLET CREATION DEBUG LOG');
    });

    it('should preserve existing debug log in error', async () => {
      const errorWithDebugLog = new Error(
        '=== WALLET CREATION DEBUG LOG ===\nStep 1\n❌ ERROR: Custom error'
      );
      (isPasskeySupported as jest.Mock).mockRejectedValue(errorWithDebugLog);

      try {
        await createWalletWithPasskey({
          userName: 'test@example.com',
          userDisplayName: 'Test User',
          pin: '123456',
        });
      } catch (error) {
        expect(error).toBe(errorWithDebugLog);
      }
    });

    it('should pass backup data to iCloud with verification', async () => {
      await createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '123456',
      });

      // Wait for async backup to start
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(backupToICloudWithVerification).toHaveBeenCalledWith({
        encrypted: mockEncrypted,
        iv: mockIv,
        tag: mockTag,
        credentialId: mockCredentialId,
        userHandle: mockUserHandle,
        pinSalt: mockPinSalt,
        pepper: mockPepper,
        prfEnabled: false,
        derivationVersion: '4',
      });
    });

    it('should log debug messages at key steps', async () => {
      await createWalletWithPasskey({
        userName: 'test@example.com',
        userDisplayName: 'Test User',
        pin: '123456',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Creating wallet with passkey',
        { userName: 'test@example.com' }
      );
      expect(logger.debug).toHaveBeenCalledWith('Generating random mnemonic...');
      expect(logger.debug).toHaveBeenCalledWith('Random mnemonic generated successfully');
    });
  });

  describe('addPasskeyToExistingWallet', () => {
    beforeEach(() => {
      mockSavePin.mockResolvedValue(true);
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === SECURE_KEYS.PASSKEY_PEPPER) return Promise.resolve(mockPepper);
        if (key === SECURE_KEYS.PIN_SALT) return Promise.resolve(mockPinSalt);
        return Promise.resolve(mockPinSalt);
      });
      (backupToICloudWithVerification as jest.Mock).mockResolvedValue({ debugInfo: '', verificationLog: '' });
    });

    it('should add passkey to existing wallet successfully', async () => {
      const result = await addPasskeyToExistingWallet(
        mockMnemonic,
        'test@example.com',
        'Test User',
        '123456'
      );

      expect(result.credentialId).toBeDefined();
      expect(isPasskeySupported).toHaveBeenCalled();
      expect(bip39.validateMnemonic).toHaveBeenCalledWith(mockMnemonic);
      expect(createPasskeyCredential).toHaveBeenCalledWith('test@example.com', 'Test User');
      expect(deriveEncryptionKey).toHaveBeenCalled();
      expect(encryptMnemonic).toHaveBeenCalledWith(mockMnemonic, mockEncryptionKey);
      expect(storePasskeyData).toHaveBeenCalled();
      expect(backupToICloudWithVerification).toHaveBeenCalled();
    });

    it('should throw error if mnemonic is invalid', async () => {
      (bip39.validateMnemonic as jest.Mock).mockReturnValue(false);

      await expect(addPasskeyToExistingWallet(
        'invalid mnemonic',
        'test@example.com',
        'Test User',
        '123456'
      )).rejects.toThrow('Invalid mnemonic');
    });

    it('should throw error if passkeys not supported', async () => {
      (isPasskeySupported as jest.Mock).mockResolvedValue(false);

      await expect(addPasskeyToExistingWallet(
        mockMnemonic,
        'test@example.com',
        'Test User',
        '123456'
      )).rejects.toThrow('Passkeys are not supported');
    });

    it('should throw error if PIN is invalid', async () => {
      await expect(addPasskeyToExistingWallet(
        mockMnemonic,
        'test@example.com',
        'Test User',
        '123'
      )).rejects.toThrow('PIN is required');
    });

    it('should create new PIN salt if not exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === SECURE_KEYS.PASSKEY_PEPPER) return Promise.resolve(mockPepper);
        return Promise.resolve(null);
      });
      // After savePin is called, return the salt on subsequent calls
      mockSavePin.mockImplementation(async () => {
        (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
          if (key === SECURE_KEYS.PASSKEY_PEPPER) return Promise.resolve(mockPepper);
          if (key === SECURE_KEYS.PIN_SALT) return Promise.resolve(mockPinSalt);
          return Promise.resolve(null);
        });
        return true;
      });

      await addPasskeyToExistingWallet(
        mockMnemonic,
        'test@example.com',
        'Test User',
        '123456'
      );

      expect(mockSavePin).toHaveBeenCalledWith('123456');
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(SECURE_KEYS.PIN_SALT);
    });

    it('should use existing PIN salt if available', async () => {
      await addPasskeyToExistingWallet(
        mockMnemonic,
        'test@example.com',
        'Test User',
        '123456'
      );

      expect(mockSavePin).not.toHaveBeenCalled();
      expect(deriveEncryptionKey).toHaveBeenCalledWith(
        mockCredentialId,
        mockUserHandle,
        '123456',
        mockPinSalt,
        false,
        null
      );
    });

    it('should throw error if PIN salt is invalid format', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === SECURE_KEYS.PASSKEY_PEPPER) return Promise.resolve(mockPepper);
        return Promise.resolve('invalid-salt');
      });

      await expect(addPasskeyToExistingWallet(
        mockMnemonic,
        'test@example.com',
        'Test User',
        '123456'
      )).rejects.toThrow('Invalid or missing PIN salt');
    });

    it('should store passkey data without creation method', async () => {
      await addPasskeyToExistingWallet(
        mockMnemonic,
        'test@example.com',
        'Test User',
        '123456'
      );

      expect(storePasskeyData).toHaveBeenCalledWith({
        credentialId: mockCredentialId,
        userHandle: mockUserHandle,
        encrypted: mockEncrypted,
        iv: mockIv,
        tag: mockTag,
      });
    });

    it('should backup to iCloud with PIN salt', async () => {
      await addPasskeyToExistingWallet(
        mockMnemonic,
        'test@example.com',
        'Test User',
        '123456'
      );

      expect(backupToICloudWithVerification).toHaveBeenCalledWith({
        encrypted: mockEncrypted,
        iv: mockIv,
        tag: mockTag,
        credentialId: mockCredentialId,
        userHandle: mockUserHandle,
        pinSalt: mockPinSalt,
        pepper: mockPepper,
        prfEnabled: false,
        derivationVersion: '4',
      });
    });

    it('should throw error if iCloud backup fails', async () => {
      (backupToICloudWithVerification as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(addPasskeyToExistingWallet(
        mockMnemonic,
        'test@example.com',
        'Test User',
        '123456'
      )).rejects.toThrow('Failed to backup passkey to iCloud');
    });

    it('should log critical error when iCloud backup fails', async () => {
      (backupToICloudWithVerification as jest.Mock).mockRejectedValue(new Error('Network error'));

      try {
        await addPasskeyToExistingWallet(
          mockMnemonic,
          'test@example.com',
          'Test User',
          '123456'
        );
      } catch (error) {
        // Expected to throw
      }

      expect(logger.error).toHaveBeenCalledWith(
        'CRITICAL: iCloud backup failed when adding passkey to wallet',
        expect.objectContaining({
          error: 'Network error',
        })
      );
    });

    it('should return base64-encoded credential ID', async () => {
      const result = await addPasskeyToExistingWallet(
        mockMnemonic,
        'test@example.com',
        'Test User',
        '123456'
      );

      const expectedBase64 = Buffer.from(mockCredentialId).toString('base64');
      expect(result.credentialId).toBe(expectedBase64);
    });
  });
});
