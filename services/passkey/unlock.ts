/**
 * Passkey Unlock - Functions for authenticating with passkeys
 */

import * as SecureStore from 'expo-secure-store';
import type { PasskeyGetRequest } from 'react-native-passkey';
import { Passkey } from 'react-native-passkey';
import { DEFAULT_WALLET_DERIVATION_MODE } from '../../constants/bitcoin';
import { PASSKEY } from '../../constants/security';
import type { AesGcmKey, PasskeyBackupData } from '../../types/crypto';
import { deriveAddressesFromMnemonic } from '../../utils/bitcoin';
import { SECURE_KEYS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { checkICloudAvailability, loadFromICloud } from '../icloudStorage';
const { getRandomValues } = require('react-native-quick-crypto');

// Timeout for native passkey dialog to prevent indefinite hangs
// (iPad compatibility mode can cause the WebAuthn dialog to stall)
const PASSKEY_NATIVE_TIMEOUT_MS = 30000;

/**
 * Race a passkey operation against a timeout to prevent indefinite hangs.
 * The PASSKEY.TIMEOUT_MS in the request is a hint to the OS and not always enforced.
 */
const withPasskeyTimeout = <T>(promise: Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        reject(new Error('Passkey authentication timed out — please try again or use your PIN')),
      PASSKEY_NATIVE_TIMEOUT_MS
    );
    (timeout as { unref?: () => void }).unref?.();

    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });

import { loadLockoutState, recordFailedAttempt } from '../pinLockout';
import { savePinWithExistingSalt } from '../pinService';
import {
  cacheSessionMnemonic,
  saveMnemonic,
  saveCachedAddresses,
  saveCurrentAccount,
  saveToMultiAccountCache,
} from '../secureStorageService';
import { getWalletDerivationMode, setWalletDerivationMode } from '../walletDerivationService';

import {
  isLegacyPasskeyDerivationVersion,
  isPasskeySupported,
  PASSKEY_DERIVATION_VERSION,
  PASSKEY_KEYS,
  PRF_SALT,
  resolvePasskeyDerivationVersion,
  toBase64Url,
} from './core';
import { decryptMnemonic, deriveEncryptionKey } from './encryption';

const DEVICE_ONLY = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

interface UnlockResult {
  mnemonic: string;
  addresses: ReturnType<typeof deriveAddressesFromMnemonic>;
}

const persistMnemonicForAppUnlock = async (mnemonic: string): Promise<void> => {
  try {
    await saveMnemonic(mnemonic);
  } catch (error: unknown) {
    logger.warn('[PasskeyUnlock] Failed to backfill mnemonic for app unlock; using session cache', {
      error: error instanceof Error ? error.message : String(error),
    });
    cacheSessionMnemonic(mnemonic);
  }
};

const parseStoredCredentialId = (credentialIdBase64: string): Uint8Array =>
  new Uint8Array(Buffer.from(credentialIdBase64, 'base64'));

const credentialIdMatches = (
  expectedCredentialId: Uint8Array,
  actualCredentialId: string
): boolean => {
  const expectedBase64 = Buffer.from(expectedCredentialId).toString('base64');
  const expectedBase64Url = toBase64Url(expectedCredentialId);

  if (actualCredentialId === expectedBase64 || actualCredentialId === expectedBase64Url) {
    return true;
  }

  try {
    const actual = Buffer.from(actualCredentialId.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    return Buffer.from(expectedCredentialId).equals(actual);
  } catch {
    return false;
  }
};

/**
 * Authenticate with passkey and unlock wallet
 * Used for same-device unlock (faster - uses encrypted mnemonic)
 */
export const unlockWithPasskey = async (pin: string): Promise<UnlockResult> => {
  try {
    logger.debug('Unlocking wallet with passkey');

    // Check if passkey is enabled
    const passkeyEnabled = await SecureStore.getItemAsync(PASSKEY_KEYS.ENABLED);
    if (passkeyEnabled !== 'true') {
      throw new Error('Passkey is not enabled for this wallet');
    }

    // Retrieve stored credential info
    const credentialIdBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.CREDENTIAL_ID);
    const userHandleBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.USER_HANDLE);
    const encryptedMnemonic = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC);
    const ivBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTION_IV);
    const tagBase64 = await SecureStore.getItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG);

    if (!credentialIdBase64 || !userHandleBase64 || !encryptedMnemonic || !ivBase64) {
      throw new Error('Passkey data not found in storage');
    }

    const credentialId = parseStoredCredentialId(credentialIdBase64);
    const credentialIdBase64Url = toBase64Url(credentialId);

    // Check if PRF was enabled for this wallet
    const prfEnabledFlag = await SecureStore.getItemAsync(PASSKEY_KEYS.PRF_ENABLED);
    const storedDerivationVersion = await SecureStore.getItemAsync(PASSKEY_KEYS.DERIVATION_VERSION);
    const derivationVersion = resolvePasskeyDerivationVersion(
      storedDerivationVersion,
      prfEnabledFlag === 'true'
    );
    const usePrf = derivationVersion === PASSKEY_DERIVATION_VERSION.PRF_V5;

    // Generate challenge for authentication
    const challenge = new Uint8Array(32);
    getRandomValues(challenge);

    // Create FIDO2 authentication request
    const requestJson: PasskeyGetRequest = {
      challenge: toBase64Url(challenge),
      userVerification: PASSKEY.USER_VERIFICATION,
      allowCredentials: [
        {
          id: credentialIdBase64Url,
          type: 'public-key',
        },
      ],
      timeout: PASSKEY.TIMEOUT_MS,
      rpId: PASSKEY.RP_ID,
      ...(usePrf && {
        extensions: {
          prf: {
            eval: { first: PRF_SALT },
          },
        },
      }),
    };

    logger.debug('Authenticating with passkey...', { usePrf, derivationVersion });

    // Authenticate with passkey (with timeout to prevent indefinite hangs on iPad)
    let authResult;
    try {
      authResult = await withPasskeyTimeout(Passkey.get(requestJson));
    } catch (nativeError: unknown) {
      // react-native-passkey throws raw objects, not Error instances
      if (nativeError instanceof Error) throw nativeError;
      const msg =
        typeof nativeError === 'object' && nativeError !== null
          ? (nativeError as { message?: string }).message || JSON.stringify(nativeError)
          : String(nativeError);
      throw new Error(msg);
    }

    logger.debug('Passkey authentication successful');

    // Verify the credential ID matches
    if (!credentialIdMatches(credentialId, authResult.id)) {
      throw new Error('Credential ID mismatch');
    }

    // Defense-in-depth: verify authenticator data is present
    // (The OS already validates these, but we check as a safety net)
    if (!authResult.response?.authenticatorData) {
      logger.warn('[PasskeyUnlock] Missing authenticatorData in passkey assertion');
    }

    // Extract PRF result if PRF was requested
    let prfSecret: Uint8Array | null = null;
    if (usePrf) {
      const prfResultRaw = authResult.clientExtensionResults?.prf?.results?.first ?? null;
      prfSecret = prfResultRaw
        ? prfResultRaw instanceof Uint8Array
          ? prfResultRaw
          : new Uint8Array(prfResultRaw)
        : null;
      if (!prfSecret) {
        logger.error('PRF was enabled but authenticator returned no PRF result');
        throw new Error('PRF result missing from authenticator - cannot derive key');
      }
    }

    const userHandle = new Uint8Array(Buffer.from(userHandleBase64, 'base64'));

    // Validate PIN
    if (!pin || pin.length !== 6) {
      throw new Error('PIN is required to unlock wallet');
    }

    // Get the PIN salt for PBKDF2 hashing
    const pinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error('Invalid or corrupted PIN salt - wallet may need to be reset');
    }

    // Derive encryption key. If PRF is enabled, uses authenticator-derived secret;
    // otherwise falls back to credential IDs (legacy path).
    const encryptionKey = await deriveEncryptionKey(
      credentialId,
      userHandle,
      pin,
      pinSalt,
      false,
      prfSecret
    );

    if (isLegacyPasskeyDerivationVersion(derivationVersion)) {
      logger.warn('Unlock used legacy passkey derivation; passkey upgrade is recommended');
    }

    // Decrypt mnemonic
    const mnemonic = await decryptMnemonic(
      encryptedMnemonic,
      ivBase64,
      tagBase64 || '',
      encryptionKey
    );

    await persistMnemonicForAppUnlock(mnemonic);

    // Get current account index
    const accountIndex = parseInt(
      (await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT)) || '0',
      10
    );

    // Derive addresses
    const derivationMode = await getWalletDerivationMode();
    const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex, derivationMode);

    logger.debug('Wallet unlocked with passkey successfully');

    return {
      mnemonic,
      addresses,
    };
  } catch (error: unknown) {
    logger.error('Failed to unlock with passkey', { error: (error as Error).message });

    // Record failed passkey attempt for unified auth lockout tracking
    try {
      const { failedAttempts } = await loadLockoutState();
      await recordFailedAttempt(failedAttempts);
    } catch (lockoutError) {
      logger.warn('[PasskeyUnlock] Failed to record failed attempt for lockout', {
        error: (lockoutError as Error).message,
      });
    }

    throw error;
  }
};

/**
 * Recover wallet on new device using passkey authentication + PIN decryption.
 * Passkey authenticates the user; PIN + credential IDs + pepper derive the decryption key.
 */
export const recoverWithPasskey = async (pin: string): Promise<UnlockResult> => {
  let debugSteps = 'Starting recovery...\n';
  try {
    logger.debug('Recovering wallet with passkey on new device');

    // Check if passkeys are supported
    debugSteps += '1. Checking passkey support...\n';
    const supported = await isPasskeySupported();
    if (!supported) {
      throw new Error(`${debugSteps}Passkeys not supported on this device`);
    }
    debugSteps += 'Passkeys supported\n';

    // Check iCloud availability first
    debugSteps += '2. Checking iCloud availability...\n';
    const iCloudCheck = await checkICloudAvailability();
    if (!iCloudCheck.available) {
      throw new Error(
        `${debugSteps}iCloud not available: ${iCloudCheck.error}\n\nPlease check:\n1. Settings > [Your Name] > iCloud - ensure you're signed in\n2. Settings > [Your Name] > iCloud > iCloud Drive - ensure it's enabled\n3. This app has permission to use iCloud`
      );
    }
    debugSteps += 'iCloud is available\n';

    // Check if iCloud backup exists with detailed error
    debugSteps += '3. Checking iCloud backup...\n';
    let backup: PasskeyBackupData;
    try {
      const loadedBackup = await loadFromICloud();
      if (!loadedBackup) {
        throw new Error(`${debugSteps}No data in iCloud (loadFromICloud returned null)`);
      }
      backup = loadedBackup as PasskeyBackupData;
      debugSteps += `Found iCloud data with keys: ${Object.keys(backup).join(', ')}\n`;
    } catch (icloudError: unknown) {
      throw new Error(`${debugSteps}iCloud load failed: ${(icloudError as Error).message}`);
    }

    // Load encrypted backup from iCloud
    logger.debug('Loading encrypted backup from iCloud...');

    // Check if backup was created with PRF enabled
    const derivationVersion = resolvePasskeyDerivationVersion(
      backup.derivationVersion,
      backup.prfEnabled === true
    );
    const usePrf = derivationVersion === PASSKEY_DERIVATION_VERSION.PRF_V5;
    debugSteps += `  Derivation version in backup: ${derivationVersion}\n`;
    debugSteps += `  PRF enabled in backup: ${usePrf}\n`;

    // Generate challenge
    debugSteps += '4. Authenticating with passkey...\n';
    const challenge = new Uint8Array(32);
    getRandomValues(challenge);

    // Create FIDO2 authentication request (discovery mode)
    const requestJson: PasskeyGetRequest = {
      challenge: toBase64Url(challenge),
      userVerification: PASSKEY.USER_VERIFICATION,
      timeout: PASSKEY.TIMEOUT_MS,
      rpId: PASSKEY.RP_ID,
      ...(usePrf && {
        extensions: {
          prf: {
            eval: { first: PRF_SALT },
          },
        },
      }),
    };

    // Log rpId status
    if (PASSKEY.RP_ID) {
      debugSteps += `  Using rpId: ${PASSKEY.RP_ID}\n`;
    } else {
      debugSteps += '  No rpId (local mode)\n';
    }

    logger.debug('Authenticating with synced passkey...', { usePrf });

    // Authenticate with synced passkey (with timeout to prevent indefinite hangs on iPad)
    let prfSecret: Uint8Array | null = null;
    try {
      const authResult = await withPasskeyTimeout(Passkey.get(requestJson));
      debugSteps += 'Passkey authentication successful\n';

      // Extract PRF result if PRF was requested
      if (usePrf) {
        const prfResultRaw = authResult.clientExtensionResults?.prf?.results?.first ?? null;
        prfSecret = prfResultRaw
          ? prfResultRaw instanceof Uint8Array
            ? prfResultRaw
            : new Uint8Array(prfResultRaw)
          : null;
        if (!prfSecret) {
          throw new Error('PRF result missing from authenticator during recovery');
        }
        debugSteps += 'PRF secret extracted from authenticator\n';
      }
    } catch (passkeyError) {
      throw new Error(`${debugSteps}Passkey auth failed: ${(passkeyError as Error).message}`);
    }

    logger.debug('Passkey authentication successful');

    // Extract credential identifiers from backup (more reliable than assertion).
    // These are static IDs used as HKDF inputs, not cryptographic secrets from the passkey.
    debugSteps += '5. Extracting credentials from backup...\n';
    const credentialId = new Uint8Array(Buffer.from(backup.credentialId, 'base64'));
    const userHandle = new Uint8Array(Buffer.from(backup.userHandle, 'base64'));
    debugSteps += `  Credential ID length: ${credentialId.length}\n`;
    debugSteps += `  User handle length: ${userHandle.length}\n`;

    // Validate PIN
    debugSteps += '6. Validating PIN...\n';
    if (!pin || pin.length !== 6) {
      throw new Error(`${debugSteps}Invalid PIN (length: ${pin?.length || 0})`);
    }
    debugSteps += 'PIN format valid\n';

    // Use the PIN salt from the backup (critical for PBKDF2 hashing)
    debugSteps += '7. Checking PIN salt...\n';
    const pinSalt = backup.pinSalt;
    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error(`${debugSteps}Invalid PIN salt (length: ${pinSalt?.length || 0})`);
    }
    debugSteps += 'PIN salt valid\n';

    // Restore pepper from backup before key derivation (critical for cross-device recovery)
    // Save existing pepper so we can restore it if decryption fails
    debugSteps += '7b. Checking pepper...\n';
    let previousPepper: string | null = null;
    if (backup.pepper) {
      previousPepper = await SecureStore.getItemAsync(SECURE_KEYS.PASSKEY_PEPPER);
      await SecureStore.setItemAsync(SECURE_KEYS.PASSKEY_PEPPER, backup.pepper, DEVICE_ONLY);
      debugSteps += `Pepper restored from backup (length: ${backup.pepper.length})\n`;
      logger.debug('Pepper restored from iCloud backup for key derivation');
    } else {
      logger.warn(
        'No pepper in iCloud backup (v2 format) - key derivation will generate a new one, decryption will likely fail'
      );
      debugSteps += 'No pepper in backup (v2 format) - recovery may fail\n';
    }

    // Derive encryption key. If PRF is enabled, uses authenticator-derived secret;
    // otherwise falls back to credential IDs (legacy path).
    debugSteps += '8. Deriving encryption key...\n';
    if (prfSecret) {
      debugSteps += '  Using PRF secret (v5 salt)\n';
    } else {
      debugSteps += '  Using legacy credential IDs (v4 salt)\n';
    }
    let encryptionKey: AesGcmKey;
    try {
      encryptionKey = await deriveEncryptionKey(
        credentialId,
        userHandle,
        pin,
        pinSalt,
        false,
        prfSecret
      );
      debugSteps += 'Encryption key derived\n';
    } catch (keyError: unknown) {
      // Restore previous pepper if key derivation failed
      if (previousPepper !== null) {
        await SecureStore.setItemAsync(SECURE_KEYS.PASSKEY_PEPPER, previousPepper, DEVICE_ONLY);
      }
      throw new Error(`${debugSteps}Key derivation failed: ${(keyError as Error).message}`);
    }

    // Decrypt mnemonic from iCloud backup
    debugSteps += '9. Decrypting mnemonic...\n';
    logger.debug('Decrypting mnemonic from backup...');
    let mnemonic: string;
    try {
      mnemonic = await decryptMnemonic(
        backup.encrypted,
        backup.iv,
        backup.tag || '',
        encryptionKey
      );
      debugSteps += 'Mnemonic decrypted successfully\n';
    } catch (decryptError) {
      // Restore previous pepper since decryption failed
      if (previousPepper !== null) {
        await SecureStore.setItemAsync(SECURE_KEYS.PASSKEY_PEPPER, previousPepper, DEVICE_ONLY);
      }
      // Provide a more specific error if pepper was missing from backup
      if (!backup.pepper) {
        throw new Error(
          `${debugSteps}Decryption failed (backup missing pepper).\n\n` +
            'This backup was created before the pepper fix (v2 format). ' +
            'The device-bound pepper used during encryption was not included in the backup, ' +
            'so cross-device recovery is not possible. ' +
            'Please restore from the original device where the wallet was created.'
        );
      }
      throw new Error(
        `${debugSteps}Decryption failed: ${(decryptError as Error).message}\n\nThis usually means wrong PIN.`
      );
    }

    logger.debug('Mnemonic decrypted successfully');

    // Derive addresses (account 0 by default)
    const addresses = deriveAddressesFromMnemonic(mnemonic, 0, DEFAULT_WALLET_DERIVATION_MODE);

    // Store on new device
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENABLED, 'true', DEVICE_ONLY);
    await SecureStore.setItemAsync(PASSKEY_KEYS.CREATION_METHOD, 'passkey', DEVICE_ONLY);
    await SecureStore.setItemAsync(PASSKEY_KEYS.CREDENTIAL_ID, backup.credentialId, DEVICE_ONLY);
    await SecureStore.setItemAsync(PASSKEY_KEYS.USER_HANDLE, backup.userHandle, DEVICE_ONLY);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC, backup.encrypted, DEVICE_ONLY);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_IV, backup.iv, DEVICE_ONLY);
    if (backup.tag) {
      await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG, backup.tag, DEVICE_ONLY);
    }
    await SecureStore.setItemAsync(
      PASSKEY_KEYS.PRF_ENABLED,
      usePrf ? 'true' : 'false',
      DEVICE_ONLY
    );
    await SecureStore.setItemAsync(PASSKEY_KEYS.DERIVATION_VERSION, derivationVersion, DEVICE_ONLY);
    await setWalletDerivationMode(DEFAULT_WALLET_DERIVATION_MODE);

    await saveMnemonic(mnemonic);
    const savedAccount = await saveCurrentAccount(0);
    if (!savedAccount) {
      throw new Error('Failed to save current account securely');
    }

    // Store the PIN salt from backup and save the PIN hash for daily unlock
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, pinSalt, DEVICE_ONLY);
    await savePinWithExistingSalt(pin, pinSalt);

    await Promise.all([
      saveCachedAddresses(0, addresses, DEFAULT_WALLET_DERIVATION_MODE),
      saveToMultiAccountCache(0, addresses, DEFAULT_WALLET_DERIVATION_MODE),
    ]);

    logger.debug('Wallet recovered successfully from iCloud');

    return {
      mnemonic,
      addresses,
    };
  } catch (error: unknown) {
    logger.error('Failed to recover with passkey', { error: (error as Error).message });
    // Re-throw with debug steps if not already included
    const errorMessage = (error as Error).message;
    if (errorMessage && errorMessage.includes('Starting recovery')) {
      throw error;
    } else {
      throw new Error(`${debugSteps}Error: ${errorMessage}`);
    }
  }
};
