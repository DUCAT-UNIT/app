/**
 * Crypto Type Definitions
 *
 * Types for cryptographic operations including Web Crypto API
 * and passkey/WebAuthn related structures.
 */

/**
 * Opaque type for AES-GCM encryption keys
 * Represents a CryptoKey from the Web Crypto API
 *
 * Note: react-native-quick-crypto doesn't export types,
 * so we define our own opaque type for type safety.
 *
 * @example
 * const key: AesGcmKey = await deriveEncryptionKey(...);
 * await encryptMnemonic(mnemonic, key);
 */
export interface AesGcmKey {
  /** Marker to make this type nominally distinct */
  readonly __brand: 'AesGcmKey';
  /** Key algorithm info */
  readonly algorithm: { name: 'AES-GCM'; length: 256 };
  /** Whether key can be extracted */
  readonly extractable: boolean;
  /** Allowed key usages */
  readonly usages: readonly ('encrypt' | 'decrypt')[];
}

/**
 * Encrypted data result from AES-GCM encryption
 *
 * @property encrypted - Base64 encoded ciphertext
 * @property iv - Base64 encoded initialization vector (12 bytes)
 * @property tag - Base64 encoded authentication tag (16 bytes)
 */
export interface EncryptedMnemonicData {
  encrypted: string;
  iv: string;
  tag: string;
}

/**
 * iCloud backup data structure for passkey-protected wallets
 *
 * @property credentialId - Base64 encoded WebAuthn credential ID
 * @property userHandle - Base64 encoded user handle
 * @property pinSalt - Hex encoded PIN salt (64 chars = 32 bytes)
 * @property encrypted - Base64 encoded encrypted mnemonic
 * @property iv - Base64 encoded IV
 * @property tag - Base64 encoded auth tag
 */
export interface PasskeyBackupData {
  credentialId: string;
  userHandle: string;
  pinSalt: string;
  encrypted: string;
  iv: string;
  tag?: string;
  /** Hex-encoded pepper for key derivation (added in backup v3) */
  pepper?: string;
  /** Whether PRF extension was used for key derivation (added in backup v4) */
  prfEnabled?: boolean;
  /** Explicit derivation version metadata (added in backup v5) */
  derivationVersion?: string;
}

/**
 * WebAuthn/FIDO2 authentication request options
 *
 * Based on PublicKeyCredentialRequestOptions but with
 * required fields for our passkey implementation.
 */
export interface PasskeyAuthRequest {
  challenge: string;
  userVerification: 'required' | 'preferred' | 'discouraged';
  timeout: number;
  rpId?: string;
  allowCredentials?: Array<{
    id: string;
    type: 'public-key';
  }>;
}

/**
 * Result from passkey unlock operation
 *
 * @property mnemonic - Decrypted BIP39 mnemonic
 * @property addresses - Derived wallet addresses
 */
export interface UnlockResult {
  mnemonic: string;
  addresses: import('./wallet').WalletAddresses;
}
