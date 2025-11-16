/**
 * iCloud Storage Service
 * Provides encrypted backup storage to iCloud for wallet recovery across devices
 */

import iCloudStorage from 'react-native-icloudstore';
import { logger } from '../utils/logger';

// iCloud keys
const ICLOUD_KEYS = {
  ENCRYPTED_MNEMONIC: 'ducat_encrypted_mnemonic_v1',
  ENCRYPTION_IV: 'ducat_encryption_iv_v1',
  ENCRYPTION_TAG: 'ducat_encryption_tag_v1',
  CREDENTIAL_ID: 'ducat_credential_id_v1',
  USER_HANDLE: 'ducat_user_handle_v1',
  PIN_SALT: 'ducat_pin_salt_v1', // CRITICAL: Salt for 10k iteration PIN hashing
};

/**
 * Save encrypted mnemonic to iCloud
 * @param {Object} data - Encrypted mnemonic data
 * @param {string} data.encrypted - Base64 encrypted mnemonic
 * @param {string} data.iv - Base64 IV
 * @param {string} data.tag - Base64 authentication tag
 * @param {string} data.credentialId - Base64 credential ID
 * @param {string} data.userHandle - Base64 user handle
 * @param {string} data.pinSalt - Hex PIN salt for 10k iteration hashing (CRITICAL for recovery)
 */
export const saveToICloud = async ({ encrypted, iv, tag, credentialId, userHandle, pinSalt }) => {
  let saveSteps = 'iCloud Save Debug:\n';
  try {
    saveSteps += `Input validation:\n`;
    saveSteps += `  - encrypted: ${!!encrypted} (length: ${encrypted?.length || 0})\n`;
    saveSteps += `  - iv: ${!!iv} (length: ${iv?.length || 0})\n`;
    saveSteps += `  - tag: ${!!tag} (length: ${tag?.length || 0})\n`;
    saveSteps += `  - credentialId: ${!!credentialId} (length: ${credentialId?.length || 0})\n`;
    saveSteps += `  - userHandle: ${!!userHandle} (length: ${userHandle?.length || 0})\n`;
    saveSteps += `  - pinSalt: ${!!pinSalt} (length: ${pinSalt?.length || 0})\n`;

    logger.debug('Saving encrypted mnemonic to iCloud', {
      hasEncrypted: !!encrypted,
      encryptedLength: encrypted?.length,
      hasIv: !!iv,
      hasTag: !!tag,
      hasCredentialId: !!credentialId,
      hasUserHandle: !!userHandle,
      hasPinSalt: !!pinSalt,
      pinSaltLength: pinSalt?.length,
    });

    saveSteps += `Saving to iCloud keys:\n`;
    try {
      saveSteps += `  1. Saving ENCRYPTED_MNEMONIC...\n`;
      await iCloudStorage.setItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC, encrypted);
      saveSteps += `     ✅ Saved\n`;

      saveSteps += `  2. Saving ENCRYPTION_IV...\n`;
      await iCloudStorage.setItem(ICLOUD_KEYS.ENCRYPTION_IV, iv);
      saveSteps += `     ✅ Saved\n`;

      saveSteps += `  3. Saving ENCRYPTION_TAG...\n`;
      await iCloudStorage.setItem(ICLOUD_KEYS.ENCRYPTION_TAG, tag);
      saveSteps += `     ✅ Saved\n`;

      saveSteps += `  4. Saving CREDENTIAL_ID...\n`;
      await iCloudStorage.setItem(ICLOUD_KEYS.CREDENTIAL_ID, credentialId);
      saveSteps += `     ✅ Saved\n`;

      saveSteps += `  5. Saving USER_HANDLE...\n`;
      await iCloudStorage.setItem(ICLOUD_KEYS.USER_HANDLE, userHandle);
      saveSteps += `     ✅ Saved\n`;

      saveSteps += `  6. Saving PIN_SALT...\n`;
      await iCloudStorage.setItem(ICLOUD_KEYS.PIN_SALT, pinSalt);
      saveSteps += `     ✅ Saved\n`;
    } catch (setError) {
      saveSteps += `     ❌ Failed: ${setError.message}\n`;
      saveSteps += `     Error code: ${setError.code || 'N/A'}\n`;
      throw setError;
    }

    saveSteps += `\n✅ All 6 keys saved successfully\n`;
    saveSteps += `Note: Data syncs to iCloud asynchronously (may take a few seconds)\n`;

    logger.debug('Successfully saved to iCloud (data will sync asynchronously)');

    // Return debug info for display
    return saveSteps;
  } catch (error) {
    saveSteps += `\n❌ SAVE FAILED\n`;
    saveSteps += `Error: ${error.message}\n`;
    saveSteps += `Code: ${error.code || 'N/A'}\n`;
    saveSteps += `Name: ${error.name || 'N/A'}\n`;

    logger.error('Failed to save to iCloud', {
      error: error.message,
      errorCode: error.code,
      errorName: error.name,
    });
    throw new Error(saveSteps);
  }
};

/**
 * Load encrypted mnemonic from iCloud
 * @returns {Promise<Object|null>} Encrypted mnemonic data or null if not found
 */
export const loadFromICloud = async () => {
  let loadSteps = 'iCloud Load Debug:\n';
  try {
    logger.debug('Loading encrypted mnemonic from iCloud');

    loadSteps += 'Loading keys from iCloud:\n';

    loadSteps += '  1. Loading ENCRYPTED_MNEMONIC...\n';
    const encrypted = await iCloudStorage.getItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC);
    loadSteps += `     ${encrypted ? '✅' : '❌'} ${encrypted ? `Found (${encrypted.length} chars)` : 'Not found (null)'}\n`;

    if (!encrypted) {
      logger.debug('No backup found in iCloud');
      throw new Error(loadSteps + '\n❌ No encrypted mnemonic in iCloud - backup does not exist');
    }

    loadSteps += '  2. Loading ENCRYPTION_IV...\n';
    const iv = await iCloudStorage.getItem(ICLOUD_KEYS.ENCRYPTION_IV);
    loadSteps += `     ${iv ? '✅' : '❌'} ${iv ? `Found (${iv.length} chars)` : 'Not found'}\n`;

    loadSteps += '  3. Loading ENCRYPTION_TAG...\n';
    const tag = await iCloudStorage.getItem(ICLOUD_KEYS.ENCRYPTION_TAG);
    loadSteps += `     ${tag ? '✅' : '⚠️'} ${tag ? `Found (${tag.length} chars)` : 'Not found (optional)'}\n`;

    loadSteps += '  4. Loading CREDENTIAL_ID...\n';
    const credentialId = await iCloudStorage.getItem(ICLOUD_KEYS.CREDENTIAL_ID);
    loadSteps += `     ${credentialId ? '✅' : '❌'} ${credentialId ? `Found (${credentialId.length} chars)` : 'Not found'}\n`;

    loadSteps += '  5. Loading USER_HANDLE...\n';
    const userHandle = await iCloudStorage.getItem(ICLOUD_KEYS.USER_HANDLE);
    loadSteps += `     ${userHandle ? '✅' : '❌'} ${userHandle ? `Found (${userHandle.length} chars)` : 'Not found'}\n`;

    loadSteps += '  6. Loading PIN_SALT...\n';
    const pinSalt = await iCloudStorage.getItem(ICLOUD_KEYS.PIN_SALT);
    loadSteps += `     ${pinSalt ? '✅' : '❌'} ${pinSalt ? `Found (${pinSalt.length} chars)` : 'Not found'}\n`;

    if (!iv || !credentialId || !userHandle || !pinSalt) {
      logger.error('Incomplete backup data in iCloud', {
        hasIv: !!iv,
        hasCredentialId: !!credentialId,
        hasUserHandle: !!userHandle,
        hasPinSalt: !!pinSalt,
      });
      loadSteps += '\n❌ INCOMPLETE DATA - Missing required keys\n';
      throw new Error(loadSteps);
    }

    logger.debug('Successfully loaded from iCloud');
    loadSteps += '\n✅ All required keys loaded successfully\n';

    return {
      encrypted,
      iv,
      tag,
      credentialId,
      userHandle,
      pinSalt,
      _debugInfo: loadSteps, // Include debug info in return
    };
  } catch (error) {
    logger.error('Failed to load from iCloud', { error: error.message });
    if (error.message && error.message.includes('iCloud Load Debug')) {
      throw error; // Already has debug info
    } else {
      throw new Error(loadSteps + `\n❌ Load failed: ${error.message}\nCode: ${error.code || 'N/A'}`);
    }
  }
};

/**
 * Check if iCloud backup exists
 * @returns {Promise<boolean>}
 */
export const hasICloudBackup = async () => {
  try {
    logger.debug('Checking for iCloud backup...');
    const encrypted = await iCloudStorage.getItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC);
    const hasData = !!encrypted;
    logger.debug('iCloud backup check result:', { hasData, encryptedLength: encrypted?.length });
    return hasData;
  } catch (error) {
    logger.error('Failed to check iCloud backup', {
      error: error.message,
      errorCode: error.code,
      errorName: error.name,
      stack: error.stack
    });
    // Throw error instead of returning false so we can see what went wrong
    throw new Error(`iCloud access failed: ${error.message} (code: ${error.code})`);
  }
};

/**
 * Clear all data from iCloud (for wallet deletion)
 */
export const clearICloud = async () => {
  try {
    logger.debug('Clearing iCloud backup');

    await iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC);
    await iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTION_IV);
    await iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTION_TAG);
    await iCloudStorage.removeItem(ICLOUD_KEYS.CREDENTIAL_ID);
    await iCloudStorage.removeItem(ICLOUD_KEYS.USER_HANDLE);
    await iCloudStorage.removeItem(ICLOUD_KEYS.PIN_SALT);

    logger.debug('iCloud backup cleared');
  } catch (error) {
    logger.error('Failed to clear iCloud backup', { error: error.message });
    throw error;
  }
};
