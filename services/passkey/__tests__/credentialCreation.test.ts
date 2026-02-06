/**
 * Tests for Passkey Credential Creation Utilities
 * Uses the real crypto implementation from jest.setup.js for integration testing
 */

import { Passkey } from 'react-native-passkey';
import { PASSKEY } from '../../../constants/security';
import { logger } from '../../../utils/logger';

// Mock react-native-passkey
jest.mock('react-native-passkey', () => ({
  Passkey: {
    create: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Note: react-native-quick-crypto is mocked globally in jest.setup.js with real node:crypto functions

// Import after mocks
import {
  generateCredentialIds,
  buildRegistrationRequest,
  createPasskeyCredential,
} from '../credentialCreation';
import { toBase64Url, fromBase64Url } from '../core';

describe('Passkey Credential Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCredentialIds', () => {
    it('should generate challenge and userId', () => {
      const { challenge, userId } = generateCredentialIds();

      expect(challenge).toBeInstanceOf(Uint8Array);
      expect(userId).toBeInstanceOf(Uint8Array);
      expect(challenge.length).toBe(32);
      expect(userId.length).toBe(16);
    });

    it('should generate random challenge bytes', () => {
      const { challenge: challenge1 } = generateCredentialIds();
      const { challenge: challenge2 } = generateCredentialIds();

      // Challenges should be different (random)
      expect(Buffer.from(challenge1).toString('hex')).not.toBe(Buffer.from(challenge2).toString('hex'));
    });

    it('should generate random userId bytes', () => {
      const { userId: userId1 } = generateCredentialIds();
      const { userId: userId2 } = generateCredentialIds();

      // User IDs should be different (random)
      expect(Buffer.from(userId1).toString('hex')).not.toBe(Buffer.from(userId2).toString('hex'));
    });
  });

  describe('buildRegistrationRequest', () => {
    const challenge = new Uint8Array(32).fill(1);
    const userId = new Uint8Array(16).fill(2);

    it('should build a valid registration request', () => {
      const request = buildRegistrationRequest(
        challenge,
        userId,
        'testuser',
        'Test User'
      );

      expect(request.challenge).toBe(toBase64Url(challenge));
      expect(request.rp.id).toBe(PASSKEY.RP_ID || '');
      expect(request.rp.name).toBe(PASSKEY.RP_NAME);
      expect(request.user.id).toBe(toBase64Url(userId));
      expect(request.user.name).toBe('testuser');
      expect(request.user.displayName).toBe('Test User');
      expect(request.timeout).toBe(PASSKEY.TIMEOUT_MS);
    });

    it('should include correct pubKeyCredParams', () => {
      const request = buildRegistrationRequest(challenge, userId, 'user', 'User');

      expect(request.pubKeyCredParams).toEqual([
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ]);
    });

    it('should include correct authenticatorSelection', () => {
      const request = buildRegistrationRequest(challenge, userId, 'user', 'User');

      expect(request.authenticatorSelection).toEqual({
        authenticatorAttachment: 'platform',
        userVerification: PASSKEY.USER_VERIFICATION,
        residentKey: PASSKEY.RESIDENT_KEY,
      });
    });

    it('should include attestation setting', () => {
      const request = buildRegistrationRequest(challenge, userId, 'user', 'User');

      expect(request.attestation).toBe(PASSKEY.ATTESTATION);
    });

    it('should use fallback username when empty', () => {
      const request = buildRegistrationRequest(challenge, userId, '', 'Display');

      expect(request.user.name).toMatch(/^user-\d+$/);
    });

    it('should use fallback displayName when empty', () => {
      const request = buildRegistrationRequest(challenge, userId, 'user', '');

      expect(request.user.displayName).toBe('Ducat User');
    });
  });

  describe('createPasskeyCredential', () => {
    const mockCredentialId = 'mockCredentialId123';
    const mockCredentialIdBytes = Buffer.from(mockCredentialId, 'utf8');

    beforeEach(() => {
      (Passkey.create as jest.Mock).mockResolvedValue({
        id: toBase64Url(mockCredentialIdBytes),
        response: {
          clientDataJSON: 'mockClientDataJSON',
          attestationObject: 'mockAttestationObject',
        },
      });
    });

    it('should create a passkey credential successfully', async () => {
      const result = await createPasskeyCredential('testuser', 'Test User');

      expect(result.credentialId).toBeInstanceOf(Uint8Array);
      expect(result.userHandle).toBeInstanceOf(Uint8Array);
      expect(result.userId).toBeInstanceOf(Uint8Array);
    });

    it('should call Passkey.create with correct request', async () => {
      await createPasskeyCredential('testuser', 'Test User');

      expect(Passkey.create).toHaveBeenCalledTimes(1);
      const createCall = (Passkey.create as jest.Mock).mock.calls[0][0];

      expect(createCall.user.name).toBe('testuser');
      expect(createCall.user.displayName).toBe('Test User');
      expect(createCall.rp.name).toBe(PASSKEY.RP_NAME);
    });

    it('should log debug messages', async () => {
      await createPasskeyCredential('testuser', 'Test User');

      expect(logger.debug).toHaveBeenCalledWith('Creating passkey credential...');
      expect(logger.debug).toHaveBeenCalledWith('Passkey credential created', {
        credentialId: expect.any(String),
      });
    });

    it('should extract credential ID from response', async () => {
      const result = await createPasskeyCredential('user', 'User');

      // Verify credentialId was decoded from base64url
      expect(result.credentialId).toBeInstanceOf(Uint8Array);
      expect(result.credentialId.length).toBeGreaterThan(0);
    });

    it('should use userHandle from response when provided', async () => {
      const mockUserHandle = new Uint8Array([1, 2, 3, 4]);
      (Passkey.create as jest.Mock).mockResolvedValue({
        id: toBase64Url(mockCredentialIdBytes),
        response: {
          clientDataJSON: 'mockClientDataJSON',
          attestationObject: 'mockAttestationObject',
          userHandle: toBase64Url(mockUserHandle),
        },
      });

      const result = await createPasskeyCredential('user', 'User');

      expect(Buffer.from(result.userHandle)).toEqual(Buffer.from(mockUserHandle));
    });

    it('should fallback to userId when userHandle not provided', async () => {
      (Passkey.create as jest.Mock).mockResolvedValue({
        id: toBase64Url(mockCredentialIdBytes),
        response: {
          clientDataJSON: 'mockClientDataJSON',
          attestationObject: 'mockAttestationObject',
        },
      });

      const result = await createPasskeyCredential('user', 'User');

      // userHandle should equal userId when not returned by platform
      expect(result.userHandle).toEqual(result.userId);
    });

    it('should throw when Passkey.create fails', async () => {
      const error = new Error('User cancelled');
      (Passkey.create as jest.Mock).mockRejectedValue(error);

      await expect(createPasskeyCredential('user', 'User')).rejects.toThrow('User cancelled');
    });

    it('should handle platform-specific errors', async () => {
      const error = new Error('NotAllowedError: The operation was aborted');
      (Passkey.create as jest.Mock).mockRejectedValue(error);

      await expect(createPasskeyCredential('user', 'User')).rejects.toThrow(
        'NotAllowedError: The operation was aborted'
      );
    });
  });
});
