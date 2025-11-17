/**
 * Passkey Unlock - Functions for authenticating with passkeys
 */

import * as SecureStore from 'expo-secure-store';
import { Passkey } from 'react-native-passkey';
import { SECURE_KEYS } from '../../utils/constants';
import { PASSKEY } from '../../constants/security';
import { deriveAddressesFromMnemonic } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import { loadFromICloud, checkICloudAvailability } from '../icloudStorage';
import { getRandomValues } from 'react-native-quick-crypto';

import { PASSKEY_KEYS, toBase64Url, isPasskeySupported } from './core';
import { deriveEncryptionKey, decryptMnemonic } from './encryption';

/**
 * Authenticate with passkey and unlock wallet
 * Used for same-device unlock (faster - uses encrypted mnemonic)
 *
 * @param {string} pin - User's PIN (required for decryption)
 * @returns {Promise<{mnemonic: string, addresses: Object}>}
 */
export const unlockWithPasskey = async (pin) => {
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

    // Generate challenge for authentication
    const challenge = new Uint8Array(32);
    getRandomValues(challenge);

    // Create FIDO2 authentication request
    const requestJson = {
      challenge: toBase64Url(challenge),
      userVerification: PASSKEY.USER_VERIFICATION,
      allowCredentials: [
        {
          id: credentialIdBase64,
          type: 'public-key',
        },
      ],
      timeout: PASSKEY.TIMEOUT_MS,
    };

    // Only add rpId if configured (for production domain)
    if (PASSKEY.RP_ID) {
      requestJson.rpId = PASSKEY.RP_ID;
    }

    logger.debug('Authenticating with passkey...');

    // Authenticate with passkey
    const assertion = await Passkey.get(requestJson);

    logger.debug('Passkey authentication successful');

    // Verify the credential ID matches
    if (assertion.id !== credentialIdBase64) {
      throw new Error('Credential ID mismatch');
    }

    const credentialId = new Uint8Array(Buffer.from(credentialIdBase64, 'base64'));
    const userHandle = new Uint8Array(Buffer.from(userHandleBase64, 'base64'));

    // Validate PIN
    if (!pin || pin.length !== 6) {
      throw new Error('PIN is required to unlock wallet');
    }

    // Get the PIN salt for 10k iteration hashing
    const pinSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error('Invalid or corrupted PIN salt - wallet may need to be reset');
    }

    // Derive encryption key using passkey + PIN (with 10k iterations)
    const encryptionKey = await deriveEncryptionKey(credentialId, userHandle, pin, pinSalt);

    // Decrypt mnemonic
    const mnemonic = await decryptMnemonic(
      encryptedMnemonic,
      ivBase64,
      tagBase64 || '',
      encryptionKey
    );

    // Get current account index
    const accountIndex = parseInt(
      (await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT)) || '0',
      10
    );

    // Derive addresses
    const addresses = deriveAddressesFromMnemonic(mnemonic, accountIndex);

    logger.debug('Wallet unlocked with passkey successfully');

    return {
      mnemonic,
      addresses,
    };
  } catch (error) {
    logger.error('Failed to unlock with passkey', { error: error.message });
    throw error;
  }
};

/**
 * Recover wallet on new device with passkey
 * Loads encrypted backup from iCloud and decrypts with passkey + PIN
 *
 * @param {string} pin - User's PIN (required for decryption)
 * @returns {Promise<{mnemonic: string, addresses: Object}>}
 */
export const recoverWithPasskey = async (pin) => {
  let debugSteps = 'Starting recovery...\n';
  try {
    logger.debug('Recovering wallet with passkey on new device');

    // Check if passkeys are supported
    debugSteps += '1. Checking passkey support...\n';
    const supported = await isPasskeySupported();
    if (!supported) {
      throw new Error(`${debugSteps}❌ Passkeys not supported on this device`);
    }
    debugSteps += '✅ Passkeys supported\n';

    // Check iCloud availability first
    debugSteps += '2. Checking iCloud availability...\n';
    const iCloudCheck = await checkICloudAvailability();
    if (!iCloudCheck.available) {
      throw new Error(`${debugSteps}❌ iCloud not available: ${iCloudCheck.error}\n\nPlease check:\n1. Settings > [Your Name] > iCloud - ensure you're signed in\n2. Settings > [Your Name] > iCloud > iCloud Drive - ensure it's enabled\n3. This app has permission to use iCloud`);
    }
    debugSteps += '✅ iCloud is available\n';

    // Check if iCloud backup exists with detailed error
    debugSteps += '3. Checking iCloud backup...\n';
    let backup;
    try {
      backup = await loadFromICloud();
      if (!backup) {
        throw new Error(`${debugSteps}❌ No data in iCloud (loadFromICloud returned null)`);
      }
      debugSteps += `✅ Found iCloud data with keys: ${Object.keys(backup).join(', ')}\n`;
    } catch (icloudError) {
      throw new Error(`${debugSteps}❌ iCloud load failed: ${icloudError.message}`);
    }

    // Load encrypted backup from iCloud
    logger.debug('Loading encrypted backup from iCloud...');

    // Generate challenge
    debugSteps += '4. Authenticating with passkey...\n';
    const challenge = new Uint8Array(32);
    getRandomValues(challenge);

    // Create FIDO2 authentication request (discovery mode)
    const requestJson = {
      challenge: toBase64Url(challenge),
      userVerification: PASSKEY.USER_VERIFICATION,
      timeout: PASSKEY.TIMEOUT_MS,
    };

    // Only add rpId if configured
    if (PASSKEY.RP_ID) {
      requestJson.rpId = PASSKEY.RP_ID;
      debugSteps += `  Using rpId: ${PASSKEY.RP_ID}\n`;
    } else {
      debugSteps += '  No rpId (local mode)\n';
    }

    logger.debug('Authenticating with synced passkey...');

    // Authenticate with synced passkey
    let assertion;
    try {
      assertion = await Passkey.get(requestJson);
      debugSteps += '✅ Passkey authentication successful\n';
    } catch (passkeyError) {
      throw new Error(`${debugSteps}❌ Passkey auth failed: ${passkeyError.message}`);
    }

    logger.debug('Passkey authentication successful');

    // Extract credential info from backup (more reliable than assertion)
    debugSteps += '5. Extracting credentials from backup...\n';
    const credentialId = new Uint8Array(Buffer.from(backup.credentialId, 'base64'));
    const userHandle = new Uint8Array(Buffer.from(backup.userHandle, 'base64'));
    debugSteps += `  Credential ID length: ${credentialId.length}\n`;
    debugSteps += `  User handle length: ${userHandle.length}\n`;

    // Validate PIN
    debugSteps += '6. Validating PIN...\n';
    if (!pin || pin.length !== 6) {
      throw new Error(`${debugSteps}❌ Invalid PIN (length: ${pin?.length || 0})`);
    }
    debugSteps += '✅ PIN format valid\n';

    // Use the PIN salt from the backup (critical for 10k iteration hashing)
    debugSteps += '7. Checking PIN salt...\n';
    const pinSalt = backup.pinSalt;
    // Validate salt format: 32 bytes = 64 hex characters
    if (!pinSalt || pinSalt.length !== 64 || !/^[0-9a-f]{64}$/i.test(pinSalt)) {
      throw new Error(`${debugSteps}❌ Invalid PIN salt (length: ${pinSalt?.length || 0})`);
    }
    debugSteps += '✅ PIN salt valid\n';

    // Derive encryption key using passkey + PIN (with 10k iterations)
    debugSteps += '8. Deriving encryption key...\n';
    let encryptionKey;
    try {
      encryptionKey = await deriveEncryptionKey(credentialId, userHandle, pin, pinSalt);
      debugSteps += '✅ Encryption key derived\n';
    } catch (keyError) {
      throw new Error(`${debugSteps}❌ Key derivation failed: ${keyError.message}`);
    }

    // Decrypt mnemonic from iCloud backup
    debugSteps += '9. Decrypting mnemonic...\n';
    logger.debug('Decrypting mnemonic from backup...');
    let mnemonic;
    try {
      mnemonic = await decryptMnemonic(
        backup.encrypted,
        backup.iv,
        backup.tag || '',
        encryptionKey
      );
      debugSteps += '✅ Mnemonic decrypted successfully\n';
    } catch (decryptError) {
      throw new Error(`${debugSteps}❌ Decryption failed: ${decryptError.message}\n\nThis usually means wrong PIN.`);
    }

    logger.debug('Mnemonic decrypted successfully');

    // Derive addresses (account 0 by default)
    const addresses = deriveAddressesFromMnemonic(mnemonic, 0);

    // Store on new device
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENABLED, 'true');
    await SecureStore.setItemAsync(PASSKEY_KEYS.CREATION_METHOD, 'passkey');
    await SecureStore.setItemAsync(PASSKEY_KEYS.CREDENTIAL_ID, backup.credentialId);
    await SecureStore.setItemAsync(PASSKEY_KEYS.USER_HANDLE, backup.userHandle);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTED_MNEMONIC, backup.encrypted);
    await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_IV, backup.iv);
    if (backup.tag) {
      await SecureStore.setItemAsync(PASSKEY_KEYS.ENCRYPTION_TAG, backup.tag);
    }

    // Store in standard location
    await SecureStore.setItemAsync(SECURE_KEYS.MNEMONIC, mnemonic);
    await SecureStore.setItemAsync(SECURE_KEYS.CURRENT_ACCOUNT, '0');

    // Store the PIN salt from backup and save the PIN hash for daily unlock
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, pinSalt);
    const { savePinWithExistingSalt } = await import('../pinService');
    await savePinWithExistingSalt(pin, pinSalt);

    logger.debug('Wallet recovered successfully from iCloud', {
      segwitAddress: addresses.segwitAddress,
      taprootAddress: addresses.taprootAddress,
    });

    return {
      mnemonic,
      addresses,
    };
  } catch (error) {
    logger.error('Failed to recover with passkey', { error: error.message });
    // Re-throw with debug steps if not already included
    if (error.message && error.message.includes('Starting recovery')) {
      throw error;
    } else {
      throw new Error(`${debugSteps}❌ Error: ${error.message}`);
    }
  }
};
