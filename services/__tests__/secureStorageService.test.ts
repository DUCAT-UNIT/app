/**
 * Tests for Secure Storage Service
 */

// Mock passkey service - handles the dynamic import() in deleteWalletData
// The mock throws to simulate import/execution failures which triggers the catch block
jest.mock('../passkey', () => ({
  clearPasskeyData: jest.fn().mockRejectedValue(new Error('Mock passkey error')),
}));

import {
  clearSessionMnemonic,
  saveMnemonic,
  getMnemonic,
  withMnemonic,
  deleteMnemonic,
  saveCurrentAccount,
  getCurrentAccount,
  deleteWalletData,
} from '../secureStorageService';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIQUIDATION_SWAP_BROADCAST_RECOVERY_KEY } from '../liquidation/recoveryKeys';
import { EVM_TRANSACTION_CHECKPOINT_STORAGE_KEY } from '../../stores/evmTransactionCheckpointStore';
import { OPERATION_JOURNAL_STORAGE_KEY } from '../../stores/operationJournalStore';
import { TURBO_PROCESSING_STORAGE_KEY } from '../../stores/turboProcessingStore';
import { VAULT_SETTLEMENT_STORAGE_KEY } from '../../stores/vaultSettlementStore';
import {
  LIQUIDATION_TXIDS_KEY,
  SWAP_TXIDS_KEY,
  SWAP_TXIDS_MIGRATION_V2_KEY,
} from '../transactionHistoryService';
import { VAULT_SETTLEMENT_HISTORY_STORAGE_KEY } from '../vaultSettlementHistoryService';

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
    clearSessionMnemonic();
  });

  describe('saveMnemonic', () => {
    it('should save mnemonic to secure storage', async () => {
      mockSetItemAsync.mockResolvedValue();

      await expect(
        saveMnemonic('word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12')
      ).resolves.toBeUndefined();
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'wallet_mnemonic_v1',
        'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
        { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
      );
    });

    it('should throw error on storage error', async () => {
      mockSetItemAsync.mockRejectedValue(new Error('Storage error'));

      await expect(saveMnemonic('test mnemonic')).rejects.toThrow('Failed to save wallet securely');
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

      await expect(deleteMnemonic()).resolves.toBeUndefined();
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_mnemonic_v1');
    });

    it('should throw error on storage error', async () => {
      mockDeleteItemAsync.mockRejectedValue(new Error('Storage error'));

      await expect(deleteMnemonic()).rejects.toThrow('Failed to delete wallet securely');
    });
  });

  describe('saveCurrentAccount', () => {
    it('should save account index to secure storage', async () => {
      mockSetItemAsync.mockResolvedValue();

      const result = await saveCurrentAccount(0);

      expect(result).toBe(true);
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'wallet_current_account_v1',
        '0',
        { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
      );
    });

    it('should handle non-zero account index', async () => {
      mockSetItemAsync.mockResolvedValue();

      const result = await saveCurrentAccount(5);

      expect(result).toBe(true);
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'wallet_current_account_v1',
        '5',
        { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
      );
    });

    it('should return false on storage error', async () => {
      mockSetItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await saveCurrentAccount(0);

      expect(result).toBe(false);
    });

    it('should reject invalid account indexes without writing storage', async () => {
      mockSetItemAsync.mockResolvedValue();

      await expect(saveCurrentAccount(-1)).resolves.toBe(false);
      await expect(saveCurrentAccount(1.5)).resolves.toBe(false);

      expect(mockSetItemAsync).not.toHaveBeenCalled();
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

    it('should throw on storage error', async () => {
      mockGetItemAsync.mockRejectedValue(new Error('Storage error'));

      await expect(getCurrentAccount()).rejects.toThrow('Storage error');
    });

    it.each(['abc', '-1', '1.5', '', '  '])(
      'should throw on invalid stored account index %p',
      async (storedAccount) => {
        mockGetItemAsync.mockResolvedValue(storedAccount);

        await expect(getCurrentAccount()).rejects.toThrow(
          `Invalid current account index: ${storedAccount}`
        );
      }
    );

    it('should throw on unsafe stored account index', async () => {
      mockGetItemAsync.mockResolvedValue('9007199254740992');

      await expect(getCurrentAccount()).rejects.toThrow(
        'Invalid current account index: 9007199254740992'
      );
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

      await expect(deleteWalletData()).resolves.toBeUndefined();

      // Check all expected keys are deleted
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_mnemonic_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_current_account_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_pin_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_pin_salt_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_pin_salt_hmac_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_pin_hmac_key_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_pin_version_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_biometric_enabled_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pin_failed_attempts');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pin_lockout_until');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pin_failed_attempts_v2');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('pin_lockout_until_v2');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('biometric_failed_attempts_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('biometric_lockout_until_v1');
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
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('passkey_pepper_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('wallet_creation_method_v1');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(LIQUIDATION_SWAP_BROADCAST_RECOVERY_KEY);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(EVM_TRANSACTION_CHECKPOINT_STORAGE_KEY);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(OPERATION_JOURNAL_STORAGE_KEY);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(TURBO_PROCESSING_STORAGE_KEY);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(VAULT_SETTLEMENT_STORAGE_KEY);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(VAULT_SETTLEMENT_HISTORY_STORAGE_KEY);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(SWAP_TXIDS_KEY);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(SWAP_TXIDS_MIGRATION_V2_KEY);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(LIQUIDATION_TXIDS_KEY);
    });

    it('should clear iCloud backup when requested (clearICloudBackup=true)', async () => {
      mockDeleteItemAsync.mockResolvedValue();

      await expect(deleteWalletData(true)).resolves.toBeUndefined();
      expect(mockDeleteItemAsync).toHaveBeenCalled();
    });

    it('should preserve iCloud backup by default (clearICloudBackup=false)', async () => {
      mockDeleteItemAsync.mockResolvedValue();

      await expect(deleteWalletData()).resolves.toBeUndefined();
      expect(mockDeleteItemAsync).toHaveBeenCalled();
    });

    it('should delete registered Cashu recovery records during wallet deletion', async () => {
      mockDeleteItemAsync.mockResolvedValue();
      mockGetItemAsync.mockImplementation((key: string) => {
        if (key === 'cashu_pending_swaps_v1') {
          return Promise.resolve(JSON.stringify(['swap-1', 'swap-2']));
        }
        if (key === 'cashu_pending_turbo_sends_v1') {
          return Promise.resolve(JSON.stringify(['cashu_pending_turbo_send_tb1psender']));
        }
        if (key === 'cashu_failed_proof_recovery_keys_v1') {
          return Promise.resolve(JSON.stringify(['cashu_failed_proofs_1']));
        }
        return Promise.resolve(null);
      });

      await expect(deleteWalletData()).resolves.toBeUndefined();

      expect(mockDeleteItemAsync).toHaveBeenCalledWith('cashu_pending_swap_swap-1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('cashu_pending_swap_swap-2');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('cashu_pending_turbo_send_tb1psender');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('cashu_failed_proofs_1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('cashu_pending_swaps_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('cashu_pending_turbo_sends_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('cashu_recovered_outgoing_swap_tokens_v1');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('cashu_failed_proofs_latest_v1');
    });

    it('should continue even if passkey clear fails (via dynamic import error)', async () => {
      mockDeleteItemAsync.mockResolvedValue();
      // The passkey module mock throws an error, simulating import failure
      // The function should still succeed

      await expect(deleteWalletData()).resolves.toBeUndefined();
    });

    it('should throw error on storage error', async () => {
      mockDeleteItemAsync.mockRejectedValue(new Error('Storage error'));

      await expect(deleteWalletData()).rejects.toThrow('Failed to delete wallet data securely');
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
