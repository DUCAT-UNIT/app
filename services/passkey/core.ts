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
  PRF_ENABLED: 'passkey_prf_enabled_v1',
  DERIVATION_VERSION: 'passkey_derivation_version_v1',
};

export const PASSKEY_DERIVATION_VERSION = {
  LEGACY_V4: '4',
  PRF_V5: '5',
} as const;

export type PasskeyDerivationVersion =
  typeof PASSKEY_DERIVATION_VERSION[keyof typeof PASSKEY_DERIVATION_VERSION];

// Fixed, application-specific salt for the WebAuthn PRF extension.
// The authenticator returns HMAC-SHA-256(passkey_private_key, PRF_SALT),
// giving us deterministic cryptographic output that syncs via iCloud Keychain.
export const PRF_SALT = new Uint8Array(Buffer.from('ducat-wallet-prf-v1', 'utf8'));

// Export for backward compatibility
export const PASSKEY_STORAGE_KEYS = PASSKEY_KEYS;

export const derivationVersionForPrf = (prfEnabled: boolean): PasskeyDerivationVersion => (
  prfEnabled ? PASSKEY_DERIVATION_VERSION.PRF_V5 : PASSKEY_DERIVATION_VERSION.LEGACY_V4
);

export const resolvePasskeyDerivationVersion = (
  storedVersion: string | null | undefined,
  prfEnabled: boolean
): PasskeyDerivationVersion => {
  if (
    storedVersion === PASSKEY_DERIVATION_VERSION.LEGACY_V4 ||
    storedVersion === PASSKEY_DERIVATION_VERSION.PRF_V5
  ) {
    return storedVersion;
  }

  return derivationVersionForPrf(prfEnabled);
};

export const isLegacyPasskeyDerivationVersion = (
  version: PasskeyDerivationVersion
): boolean => version === PASSKEY_DERIVATION_VERSION.LEGACY_V4;

/**
 * Check if WebAuthn/Passkeys are supported on this device
 */
export const isPasskeySupported = async (): Promise<boolean> => {
  try {
    const supported = Passkey.isSupported();
    logger.debug('Passkey support check', { supported });
    return supported;
  } catch (error: unknown) {
    logger.error('Failed to check passkey support', { error: (error as Error).message });
    return false;
  }
};

// Base64URL encoding helpers
export const toBase64Url = (buffer: Uint8Array): string => {
  const base64 = Buffer.from(buffer).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]/g, '');
};

export const fromBase64Url = (base64url: string): Buffer => {
  // Add padding if needed
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
};
