/**
 * Passkey Credential Creation Utilities
 * Shared functions for creating FIDO2 passkey credentials
 */

import { Passkey } from 'react-native-passkey';
import type { PasskeyCreateRequest } from 'react-native-passkey';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getRandomValues } = require('react-native-quick-crypto');
import { PASSKEY } from '../../constants/security';
import { logger } from '../../utils/logger';
import { toBase64Url, fromBase64Url } from './core';

/**
 * Generate cryptographic challenge and user ID for FIDO2
 */
export const generateCredentialIds = (): { challenge: Uint8Array; userId: Uint8Array } => {
  const challenge = new Uint8Array(32);
  getRandomValues(challenge);

  const userId = new Uint8Array(16);
  getRandomValues(userId);

  return { challenge, userId };
};

/**
 * Build FIDO2 registration request JSON
 */
export const buildRegistrationRequest = (
  challenge: Uint8Array,
  userId: Uint8Array,
  userName: string,
  userDisplayName: string
): PasskeyCreateRequest => {
  const rp: PasskeyCreateRequest['rp'] = { id: PASSKEY.RP_ID || '', name: PASSKEY.RP_NAME };

  return {
    challenge: toBase64Url(challenge),
    rp,
    user: {
      id: toBase64Url(userId),
      name: userName || `user-${Date.now()}`,
      displayName: userDisplayName || 'Ducat User',
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    timeout: PASSKEY.TIMEOUT_MS,
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: PASSKEY.USER_VERIFICATION,
      residentKey: PASSKEY.RESIDENT_KEY,
    },
    attestation: PASSKEY.ATTESTATION,
  };
};

/**
 * Create a passkey credential and extract identifiers
 */
export const createPasskeyCredential = async (
  userName: string,
  userDisplayName: string
): Promise<{ credentialId: Uint8Array; userHandle: Uint8Array; userId: Uint8Array }> => {
  logger.debug('Creating passkey credential...');

  // Generate challenge and user ID
  const { challenge, userId } = generateCredentialIds();

  // Build registration request
  const requestJson = buildRegistrationRequest(challenge, userId, userName, userDisplayName);

  // Create passkey credential
  const result = await Passkey.create(requestJson);

  logger.debug('Passkey credential created', { credentialId: result.id });

  // Extract stable identifiers from credential
  const credentialId = new Uint8Array(fromBase64Url(result.id));
  // userHandle may be returned by some platform implementations but isn't in the standard type
  const responseWithUserHandle = result.response as typeof result.response & { userHandle?: string };
  const userHandle = responseWithUserHandle.userHandle
    ? new Uint8Array(fromBase64Url(responseWithUserHandle.userHandle))
    : userId; // Fallback to userId if userHandle not provided

  return { credentialId, userHandle, userId };
};
