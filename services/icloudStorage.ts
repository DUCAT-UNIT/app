/**
 * iCloud Storage Service
 * Provides encrypted backup storage to iCloud for wallet recovery across devices
 */

import iCloudStorage from 'react-native-icloudstore';
import { logger } from '../utils/logger';
import { Platform } from 'react-native';

export interface ICloudAvailabilityResult {
  available: boolean;
  error?: string;
}

export interface EncryptedBackupData {
  encrypted: string;
  iv: string;
  tag: string;
  credentialId: string;
  userHandle: string;
  pinSalt: string;
}

export interface LoadedBackupData extends EncryptedBackupData {
  _debugInfo: string;
}

interface ICloudError extends Error {
  code?: string;
  domain?: string;
}

/**
 * Check if iCloud is available and accessible
 * @returns Availability status with optional error message
 */
export const checkICloudAvailability = async (): Promise<ICloudAvailabilityResult> => {
  try {
    // Only works on iOS
    if (Platform.OS !== 'ios') {
      return { available: false, error: 'iCloud is only available on iOS' };
    }

    // Try to read a test key to verify iCloud access
    try {
      await iCloudStorage.getItem('__icloud_test_key__');
      return { available: true };
    } catch (error: unknown) {
      const iCloudError = error as ICloudError;
      if (iCloudError.code === 'ICLOUD_STORAGE_NOT_AVAILABLE') {
        return {
          available: false,
          error: 'iCloud is not available. Please sign into iCloud in Settings and enable iCloud Drive.',
        };
      }
      if (iCloudError.message && iCloudError.message.includes('not entitled')) {
        return {
          available: false,
          error: 'App is not entitled for iCloud access. This is a configuration issue.',
        };
      }
      // If we can access iCloud but the key doesn't exist, that's fine
      return { available: true };
    }
  } catch (error: unknown) {
    logger.error('Failed to check iCloud availability', { error: (error as Error).message });
    return {
      available: false,
      error: `Failed to check iCloud: ${(error as Error).message}`,
    };
  }
};

// iCloud keys
const ICLOUD_KEYS = {
  // V2: Atomic backup (single JSON object - prevents partial writes)
  ATOMIC_BACKUP: 'ducat_backup_v2',

  // V1: Legacy keys (deprecated - kept for migration only)
  ENCRYPTED_MNEMONIC: 'ducat_encrypted_mnemonic_v1',
  ENCRYPTION_IV: 'ducat_encryption_iv_v1',
  ENCRYPTION_TAG: 'ducat_encryption_tag_v1',
  CREDENTIAL_ID: 'ducat_credential_id_v1',
  USER_HANDLE: 'ducat_user_handle_v1',
  PIN_SALT: 'ducat_pin_salt_v1', // CRITICAL: Salt for 10k iteration PIN hashing
} as const;

// Backup version for atomic storage
const BACKUP_VERSION = 2;

interface AtomicBackupData {
  version: number;
  encrypted: string;
  iv: string;
  tag: string;
  credentialId: string;
  userHandle: string;
  pinSalt: string;
  timestamp: number;
}

/**
 * Save encrypted mnemonic to iCloud using atomic storage
 * @param data - Encrypted mnemonic data
 * @param data.encrypted - Base64 encrypted mnemonic
 * @param data.iv - Base64 IV
 * @param data.tag - Base64 authentication tag
 * @param data.credentialId - Base64 credential ID
 * @param data.userHandle - Base64 user handle
 * @param data.pinSalt - Hex PIN salt for 10k iteration hashing (CRITICAL for recovery)
 * @returns Debug information string
 */
export const saveToICloud = async ({
  encrypted,
  iv,
  tag,
  credentialId,
  userHandle,
  pinSalt
}: EncryptedBackupData): Promise<string> => {
  let saveSteps = 'iCloud Save Debug (Atomic V2):\n';
  try {
    saveSteps += `Input validation:\n`;
    saveSteps += `  - encrypted: ${!!encrypted} (length: ${encrypted?.length || 0})\n`;
    saveSteps += `  - iv: ${!!iv} (length: ${iv?.length || 0})\n`;
    saveSteps += `  - tag: ${!!tag} (length: ${tag?.length || 0})\n`;
    saveSteps += `  - credentialId: ${!!credentialId} (length: ${credentialId?.length || 0})\n`;
    saveSteps += `  - userHandle: ${!!userHandle} (length: ${userHandle?.length || 0})\n`;
    saveSteps += `  - pinSalt: ${!!pinSalt} (length: ${pinSalt?.length || 0})\n`;

    logger.debug('Saving encrypted mnemonic to iCloud (atomic)', {
      hasEncrypted: !!encrypted,
      encryptedLength: encrypted?.length,
      hasIv: !!iv,
      hasTag: !!tag,
      hasCredentialId: !!credentialId,
      hasUserHandle: !!userHandle,
      hasPinSalt: !!pinSalt,
      pinSaltLength: pinSalt?.length,
      version: BACKUP_VERSION,
    });

    // Create atomic backup object
    const backupData: AtomicBackupData = {
      version: BACKUP_VERSION,
      encrypted,
      iv,
      tag,
      credentialId,
      userHandle,
      pinSalt,
      timestamp: Date.now(),
    };

    saveSteps += `\nCreating atomic backup (v${BACKUP_VERSION})...\n`;
    saveSteps += `  - Backup size: ${JSON.stringify(backupData).length} bytes\n`;
    saveSteps += `  - Timestamp: ${new Date(backupData.timestamp).toISOString()}\n`;

    try {
      saveSteps += `\nSaving atomic backup to iCloud...\n`;
      await iCloudStorage.setItem(ICLOUD_KEYS.ATOMIC_BACKUP, JSON.stringify(backupData));
      saveSteps += `  ✅ Atomic backup saved successfully\n`;

      // Clean up legacy keys if they exist (migration)
      saveSteps += `\nCleaning up legacy keys (if any)...\n`;
      try {
        await Promise.all([
          iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC),
          iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTION_IV),
          iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTION_TAG),
          iCloudStorage.removeItem(ICLOUD_KEYS.CREDENTIAL_ID),
          iCloudStorage.removeItem(ICLOUD_KEYS.USER_HANDLE),
          iCloudStorage.removeItem(ICLOUD_KEYS.PIN_SALT),
        ]);
        saveSteps += `  ✅ Legacy keys cleaned up\n`;
      } catch (cleanupError) {
        // Non-critical - legacy keys might not exist
        saveSteps += `  ⚠️ Legacy cleanup skipped (keys may not exist)\n`;
      }
    } catch (setError) {
      const err = setError as ICloudError;
      saveSteps += `  ❌ Failed: ${err.message}\n`;
      saveSteps += `  Error code: ${err.code || 'N/A'}\n`;
      throw setError;
    }

    saveSteps += `\n✅ Backup saved successfully with atomic write protection\n`;
    saveSteps += `Note: Data syncs to iCloud asynchronously (may take a few seconds)\n`;
    saveSteps += `\nBenefit: Single atomic write prevents data corruption if app crashes during save\n`;

    logger.debug('Successfully saved to iCloud with atomic write protection');

    // Return debug info for display
    return saveSteps;
  } catch (error: unknown) {
    const err = error as ICloudError;
    saveSteps += `\n❌ SAVE FAILED\n`;
    saveSteps += `Error: ${err.message}\n`;
    saveSteps += `Code: ${err.code || 'N/A'}\n`;
    saveSteps += `Name: ${err.name || 'N/A'}\n`;

    logger.error('Failed to save to iCloud', {
      error: err.message,
      errorCode: err.code,
      errorName: err.name,
    });
    throw new Error(saveSteps);
  }
};

/**
 * Load encrypted mnemonic from iCloud
 * Supports both atomic (v2) and legacy (v1) formats for backward compatibility
 * @returns Encrypted mnemonic data or null if not found
 */
export const loadFromICloud = async (): Promise<LoadedBackupData> => {
  let loadSteps = 'iCloud Load Debug:\n';
  try {
    logger.debug('Loading encrypted mnemonic from iCloud');

    // Try loading atomic backup first (v2)
    loadSteps += 'Checking for atomic backup (v2)...\n';
    const atomicBackupJson = await iCloudStorage.getItem(ICLOUD_KEYS.ATOMIC_BACKUP);

    if (atomicBackupJson) {
      loadSteps += '  ✅ Atomic backup found\n';
      try {
        const backupData = JSON.parse(atomicBackupJson) as AtomicBackupData;
        loadSteps += `  - Version: ${backupData.version}\n`;
        loadSteps += `  - Timestamp: ${new Date(backupData.timestamp).toISOString()}\n`;
        loadSteps += `  - Backup size: ${atomicBackupJson.length} bytes\n`;

        // Validate all required fields exist
        if (!backupData.encrypted || !backupData.iv || !backupData.credentialId ||
            !backupData.userHandle || !backupData.pinSalt) {
          logger.error('Atomic backup is missing required fields', {
            hasEncrypted: !!backupData.encrypted,
            hasIv: !!backupData.iv,
            hasCredentialId: !!backupData.credentialId,
            hasUserHandle: !!backupData.userHandle,
            hasPinSalt: !!backupData.pinSalt,
          });
          loadSteps += '\n❌ Atomic backup is corrupted (missing required fields)\n';
          throw new Error(loadSteps);
        }

        logger.debug('Successfully loaded atomic backup from iCloud', {
          version: backupData.version,
          timestamp: backupData.timestamp,
        });
        loadSteps += '\n✅ Atomic backup loaded successfully\n';

        return {
          encrypted: backupData.encrypted,
          iv: backupData.iv,
          tag: backupData.tag || '',
          credentialId: backupData.credentialId,
          userHandle: backupData.userHandle,
          pinSalt: backupData.pinSalt,
          _debugInfo: loadSteps,
        };
      } catch (parseError) {
        logger.error('Failed to parse atomic backup', { error: (parseError as Error).message });
        loadSteps += `  ❌ Failed to parse atomic backup: ${(parseError as Error).message}\n`;
        loadSteps += '  Falling back to legacy format...\n';
      }
    } else {
      loadSteps += '  ⚠️ No atomic backup found\n';
      loadSteps += '  Trying legacy format (v1)...\n';
    }

    // Fall back to legacy format (v1)
    loadSteps += '\nLoading legacy keys from iCloud:\n';

    loadSteps += '  1. Loading ENCRYPTED_MNEMONIC...\n';
    const encrypted = await iCloudStorage.getItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC);
    loadSteps += `     ${encrypted ? '✅' : '❌'} ${encrypted ? `Found (${encrypted.length} chars)` : 'Not found (null)'}\n`;

    if (!encrypted) {
      logger.debug('No backup found in iCloud (neither v2 nor v1)');
      throw new Error(loadSteps + '\n❌ No backup found in iCloud - backup does not exist');
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

    logger.debug('Successfully loaded legacy backup from iCloud (will be migrated on next save)');
    loadSteps += '\n✅ Legacy backup loaded successfully\n';
    loadSteps += '⚠️ Note: This backup will be automatically migrated to atomic format on next save\n';

    return {
      encrypted,
      iv,
      tag: tag || '',
      credentialId,
      userHandle,
      pinSalt,
      _debugInfo: loadSteps,
    };
  } catch (error: unknown) {
    logger.error('Failed to load from iCloud', { error: (error as Error).message });
    if (error instanceof Error && error.message.includes('iCloud Load Debug')) {
      throw error; // Already has debug info
    } else {
      const err = error as ICloudError;
      throw new Error(loadSteps + `\n❌ Load failed: ${err.message}\nCode: ${err.code || 'N/A'}`);
    }
  }
};

/**
 * Check if iCloud backup exists (checks both atomic v2 and legacy v1 formats)
 * @returns True if backup exists, false otherwise
 */
export const hasICloudBackup = async (): Promise<boolean> => {
  try {
    logger.debug('Checking for iCloud backup...');

    // Check for atomic backup first (v2)
    const atomicBackup = await iCloudStorage.getItem(ICLOUD_KEYS.ATOMIC_BACKUP);
    if (atomicBackup) {
      logger.debug('iCloud backup check result: atomic backup (v2) found', {
        backupSize: atomicBackup.length,
      });
      return true;
    }

    // Fall back to legacy format (v1)
    const encrypted = await iCloudStorage.getItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC);
    const hasData = !!encrypted;
    logger.debug('iCloud backup check result:', {
      hasData,
      format: hasData ? 'legacy (v1)' : 'none',
      encryptedLength: encrypted?.length,
    });
    return hasData;
  } catch (error: unknown) {
    const err = error as ICloudError;
    logger.error('Failed to check iCloud backup', {
      error: err.message,
      errorCode: err.code,
      errorName: err.name,
      errorDomain: err.domain,
      stack: err.stack
    });

    // Provide more helpful error messages for common issues
    if (err.code === 'ICLOUD_STORAGE_NOT_AVAILABLE') {
      throw new Error(`iCloud is not available. Please ensure:\n1. You're signed into iCloud in Settings\n2. iCloud Drive is enabled\n3. This app has iCloud permission\n\nOriginal error: ${err.message}`);
    } else if (err.message && err.message.includes('not entitled')) {
      throw new Error(`App not entitled for iCloud. This is a configuration issue - please contact support.\n\nError: ${err.message}`);
    }

    // Throw error instead of returning false so we can see what went wrong
    throw new Error(`iCloud access failed: ${err.message} (code: ${err.code || 'N/A'})`);
  }
};

/**
 * Clear all data from iCloud (for wallet deletion)
 * Clears both atomic (v2) and legacy (v1) formats
 */
export const clearICloud = async (): Promise<void> => {
  try {
    logger.debug('Clearing iCloud backup (both v2 and v1 formats)');

    // Clear all formats atomically using Promise.all
    await Promise.all([
      // V2: Atomic backup
      iCloudStorage.removeItem(ICLOUD_KEYS.ATOMIC_BACKUP),

      // V1: Legacy keys (for backward compatibility)
      iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTED_MNEMONIC),
      iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTION_IV),
      iCloudStorage.removeItem(ICLOUD_KEYS.ENCRYPTION_TAG),
      iCloudStorage.removeItem(ICLOUD_KEYS.CREDENTIAL_ID),
      iCloudStorage.removeItem(ICLOUD_KEYS.USER_HANDLE),
      iCloudStorage.removeItem(ICLOUD_KEYS.PIN_SALT),
    ]);

    logger.debug('iCloud backup cleared (all formats)');
  } catch (error: unknown) {
    logger.error('Failed to clear iCloud backup', { error: (error as Error).message });
    throw error;
  }
};
