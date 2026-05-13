/**
 * Passkey Creation - Functions for creating wallets with passkeys
 */

import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../../utils/constants';
import { deriveAddressesFromMnemonic } from '../../utils/bitcoin';
import { DEFAULT_WALLET_DERIVATION_MODE } from '../../constants/bitcoin';
import { logger } from '../../utils/logger';
import { checkICloudAvailability } from '../icloudStorage';
import { savePinWithHash, savePin } from '../pinService';
import { setWalletDerivationMode } from '../walletDerivationService';

import {
  derivationVersionForPrf,
  isPasskeySupported,
  PASSKEY_KEYS,
} from './core';
import { generateRandomMnemonic, deriveEncryptionKey, encryptMnemonic } from './encryption';
import { createPasskeyCredential } from './credentialCreation';
import {
  storePasskeyData,
  backupToICloudWithVerification,
  setCurrentAccount,
} from './passkeyStorage';
import {
  cacheSessionMnemonic,
  saveCachedAddresses,
  saveMnemonic,
  saveToMultiAccountCache,
} from '../secureStorageService';

interface CreateWalletOptions {
  userName: string;
  userDisplayName: string;
  pin: string;
}

interface CreateWalletResult {
  mnemonic: string;
  addresses: ReturnType<typeof deriveAddressesFromMnemonic>;
  credentialId: string;
  icloudBackupPromise: Promise<{ success: boolean; debugInfo?: string; error?: string }>;
}

/**
 * Create a new wallet with passkey
 * Generates passkey → random mnemonic → encrypts with PIN-derived key → backs up to iCloud
 */
export const createWalletWithPasskey = async ({
  userName,
  userDisplayName,
  pin,
}: CreateWalletOptions): Promise<CreateWalletResult> => {
  let createDebugLog = '=== WALLET CREATION DEBUG LOG ===\n\n';
  try {
    createDebugLog += `Step 1: Checking passkey support...\n`;
    logger.debug('Creating wallet with passkey', { userName });

    // Check if passkeys are supported
    const supported = await isPasskeySupported();
    if (!supported) {
      throw new Error(createDebugLog + '❌ Passkeys not supported on this device');
    }
    createDebugLog += `✅ Passkeys supported\n\n`;

    // Check iCloud availability
    createDebugLog += `Step 2: Checking iCloud availability...\n`;
    const iCloudCheck = await checkICloudAvailability();
    if (!iCloudCheck.available) {
      throw new Error(createDebugLog + `❌ iCloud not available: ${iCloudCheck.error}\n\nPlease check:\n1. Settings > [Your Name] > iCloud - ensure you're signed in\n2. Settings > [Your Name] > iCloud > iCloud Drive - ensure it's enabled`);
    }
    createDebugLog += `✅ iCloud is available\n\n`;

    // Create passkey credential (includes PRF extension request)
    const { credentialId, userHandle, prfEnabled, prfResult } =
      await createPasskeyCredential(userName, userDisplayName);

    logger.debug('Generating random mnemonic...');

    // Generate random BIP39 mnemonic (NOT derived from passkey)
    const mnemonic = generateRandomMnemonic();

    logger.debug('Random mnemonic generated successfully');

    // Derive wallet addresses (account 0)
    const addresses = deriveAddressesFromMnemonic(mnemonic, 0, DEFAULT_WALLET_DERIVATION_MODE);

    // Validate PIN
    if (!pin || pin.length !== 6) {
      throw new Error('PIN is required for passkey wallet creation');
    }

    // Save PIN for daily unlock (generates and saves salt + hash)
    // OPTIMIZATION: Returns the hashed PIN to avoid re-hashing (310k iterations = ~500ms)
    const { hashedPin, salt: pinSalt } = await savePinWithHash(pin);

    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error('Invalid or missing PIN salt - wallet creation failed');
    }

    // Determine PRF secret for key derivation
    const prfSecret = (prfEnabled && prfResult) ? prfResult : null;
    const derivationVersion = derivationVersionForPrf(!!prfSecret);
    if (prfSecret) {
      logger.debug('Using PRF secret for key derivation (v5 salt)');
    } else {
      logger.warn('PRF not supported by authenticator, using legacy key derivation (v4 salt)');
    }

    // Derive encryption key from PRF secret (or credential IDs) + hashed PIN + device pepper (HKDF).
    // OPTIMIZATION: Pass pre-hashed PIN to skip 310k PBKDF2 iterations (~500ms saved)
    const encryptionKey = await deriveEncryptionKey(
      credentialId, userHandle, hashedPin, pinSalt, true, prfSecret
    );

    // Encrypt mnemonic for storage
    const { encrypted, iv, tag } = await encryptMnemonic(mnemonic, encryptionKey);

    // Store passkey data in SecureStore
    await storePasskeyData({
      credentialId,
      userHandle,
      encrypted,
      iv,
      tag,
      creationMethod: 'passkey',
    });

    await SecureStore.setItemAsync(PASSKEY_KEYS.PRF_ENABLED, prfSecret ? 'true' : 'false', {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(PASSKEY_KEYS.DERIVATION_VERSION, derivationVersion, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    await setWalletDerivationMode(DEFAULT_WALLET_DERIVATION_MODE);

    cacheSessionMnemonic(mnemonic);

    // Save current account (always 0 for new wallets)
    await setCurrentAccount(0);
    await Promise.all([
      saveCachedAddresses(0, addresses, DEFAULT_WALLET_DERIVATION_MODE),
      saveToMultiAccountCache(0, addresses, DEFAULT_WALLET_DERIVATION_MODE),
    ]);

    logger.debug('Wallet created with passkey successfully (before iCloud backup)', {
      segwitAddress: addresses.segwitAddress,
      taprootAddress: addresses.taprootAddress,
    });

    // Read pepper for inclusion in iCloud backup (critical for cross-device recovery)
    const pepper = await SecureStore.getItemAsync(SECURE_KEYS.PASSKEY_PEPPER);
    if (!pepper) {
      logger.error('Pepper not found after key derivation - backup will lack pepper');
    }

    // Return immediately with backup promise for async execution
    // This allows UI to proceed while backup happens in background
    const backupPromise = backupToICloudWithVerification({
      encrypted,
      iv,
      tag,
      credentialId,
      userHandle,
      pinSalt,
      pepper: pepper || undefined,
      prfEnabled: !!prfSecret,
      derivationVersion,
    }).then((backup) => {
      logger.debug('iCloud backup succeeded', backup);
      return { success: true, debugInfo: backup.debugInfo + backup.verificationLog };
    }).catch((icloudError) => {
      logger.error('iCloud backup failed (non-blocking)', { error: icloudError.message });
      return { success: false, error: icloudError.message };
    });

    return {
      mnemonic,
      addresses,
      credentialId: Buffer.from(credentialId).toString('base64'),
      icloudBackupPromise: backupPromise, // Return promise for background execution
    };
  } catch (error: unknown) {
    logger.error('Failed to create wallet with passkey', { error: (error as Error).message });
    // Include full debug log in error
    const errorMessage = (error as Error).message;
    if (errorMessage && errorMessage.includes('=== WALLET CREATION DEBUG LOG ===')) {
      throw error;
    } else {
      throw new Error(createDebugLog + `\n\n❌ ERROR: ${errorMessage}\nStack: ${(error as Error).stack || 'N/A'}`);
    }
  }
};

/**
 * Add passkey to existing wallet (migration)
 * Encrypts existing mnemonic with PIN-derived key for future passkey-gated unlocks
 */
export const addPasskeyToExistingWallet = async (
  mnemonic: string,
  userName: string,
  userDisplayName: string,
  pin: string
): Promise<{ credentialId: string }> => {
  try {
    logger.debug('Adding passkey to existing wallet');

    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }

    // Check if passkeys are supported
    const supported = await isPasskeySupported();
    if (!supported) {
      throw new Error('Passkeys are not supported on this device');
    }

    const existingStandardMnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);

    // Create passkey credential (includes PRF extension request)
    const { credentialId, userHandle, prfEnabled, prfResult } =
      await createPasskeyCredential(userName, userDisplayName);

    // Validate PIN
    if (!pin || pin.length !== 6) {
      throw new Error('PIN is required for passkey encryption');
    }

    // Check if PIN salt already exists, or create new one
    let pinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    if (!pinSalt) {
      // No existing salt - save PIN to create one
      await savePin(pin);
      pinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    }

    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error('Invalid or missing PIN salt - cannot add passkey to wallet');
    }

    // Determine PRF secret for key derivation
    const prfSecret = (prfEnabled && prfResult) ? prfResult : null;
    const derivationVersion = derivationVersionForPrf(!!prfSecret);
    if (prfSecret) {
      logger.debug('Using PRF secret for migration key derivation (v5 salt)');
    } else {
      logger.warn('PRF not supported by authenticator, using legacy key derivation (v4 salt)');
    }

    // Derive encryption key from PRF secret (or credential IDs) + PIN + device pepper (310k PBKDF2 iterations)
    const encryptionKey = await deriveEncryptionKey(
      credentialId, userHandle, pin, pinSalt, false, prfSecret
    );

    // Encrypt existing mnemonic
    const { encrypted, iv, tag } = await encryptMnemonic(mnemonic, encryptionKey);

    // Store passkey data (no creation method - wallet already exists)
    await storePasskeyData({
      credentialId,
      userHandle,
      encrypted,
      iv,
      tag,
    });

    if (existingStandardMnemonic) {
      await saveMnemonic(mnemonic);
      await SecureStore.setItemAsync(PASSKEY_KEYS.CREATION_METHOD, 'pin', {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    }

    await SecureStore.setItemAsync(PASSKEY_KEYS.PRF_ENABLED, prfSecret ? 'true' : 'false', {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(PASSKEY_KEYS.DERIVATION_VERSION, derivationVersion, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });

    // Read pepper for inclusion in iCloud backup (critical for cross-device recovery)
    const pepper = await SecureStore.getItemAsync(SECURE_KEYS.PASSKEY_PEPPER);
    if (!pepper) {
      logger.error('Pepper not found after key derivation - backup will lack pepper');
    }

    // Backup to iCloud (including PIN salt and pepper)
    // NOTE: This intentionally blocks and re-throws on failure, unlike createWalletWithPasskey
    // which fires the backup in the background. During migration the user already has a wallet,
    // so we can afford to wait and surface the error immediately rather than letting them
    // proceed with a false sense of backup security.
    try {
      await backupToICloudWithVerification({
        encrypted,
        iv,
        tag,
        credentialId,
        userHandle,
        pinSalt,
        pepper: pepper || undefined,
        prfEnabled: !!prfSecret,
        derivationVersion,
      });
      logger.debug('Passkey backup saved to iCloud');
    } catch (icloudError) {
      logger.error('CRITICAL: iCloud backup failed when adding passkey to wallet', {
        error: (icloudError as Error).message,
        recommendation: 'User should check iCloud settings and retry adding passkey',
      });
      // Re-throw so caller knows backup failed
      throw new Error(`Failed to backup passkey to iCloud: ${(icloudError as Error).message}. Recovery may not work on new devices.`);
    }

    logger.debug('Passkey added to wallet successfully');

    return {
      credentialId: Buffer.from(credentialId).toString('base64'),
    };
  } catch (error: unknown) {
    logger.error('Failed to add passkey to wallet', { error: (error as Error).message });
    throw error;
  }
};
