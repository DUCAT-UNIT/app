/**
 * Passkey Core - Basic support checks and constants
 */

import { Passkey } from 'react-native-passkey';
import { logger } from '../../utils/logger';

// SecureStore keys for passkey data
export const PASSKEY_KEYS = {
  ENABLED: 'passkey_enabled_v1',
  CREDENTIAL_ID: 'passkey_credential_id_v1',
  USER_HANDLE: 'passkey_user_handle_v1',
  CREATION_METHOD: 'wallet_creation_method_v1', // 'passkey' or 'pin'
  ENCRYPTED_MNEMONIC: 'passkey_encrypted_mnemonic_v1',
  ENCRYPTION_IV: 'passkey_encryption_iv_v1',
  ENCRYPTION_TAG: 'passkey_encryption_tag_v1',
};

// Export for backward compatibility
export const PASSKEY_STORAGE_KEYS = PASSKEY_KEYS;

/**
 * Check if WebAuthn/Passkeys are supported on this device
 */
export const isPasskeySupported = async () => {
  try {
    const supported = Passkey.isSupported();
    logger.debug('Passkey support check', { supported });
    return supported;
  } catch (error) {
    logger.error('Failed to check passkey support', { error: error.message });
    return false;
  }
};

// Base64URL encoding helpers
export const toBase64Url = (buffer) => {
  const base64 = Buffer.from(buffer).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]/g, '');
};

export const fromBase64Url = (base64url) => {
  // Add padding if needed
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
};
