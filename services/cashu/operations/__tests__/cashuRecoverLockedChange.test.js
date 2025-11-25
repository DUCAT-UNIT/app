/**
 * Tests for cashuRecoverLockedChange
 */

jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../crypto', () => ({
  decodeToken: jest.fn(),
  sumProofs: jest.fn(),
}));

jest.mock('../../p2pk', () => ({
  isP2PKSecret: jest.fn(),
}));

jest.mock('../../cashuLockedTokensService', () => ({
  getSentLockedTokens: jest.fn(),
}));

jest.mock('../../cashuProofManager', () => ({
  loadProofs: jest.fn(),
  addProofs: jest.fn(),
}));

import { recoverLockedChange } from '../cashuRecoverLockedChange';
import { decodeToken, sumProofs } from '../../crypto';
import { isP2PKSecret } from '../../p2pk';
import { getSentLockedTokens } from '../../cashuLockedTokensService';
import { loadProofs, addProofs } from '../../cashuProofManager';

describe('cashuRecoverLockedChange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recoverLockedChange', () => {
    it('should recover change proofs successfully', async () => {
      loadProofs.mockResolvedValue([
        { secret: 'existing1' },
      ]);
      getSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'cashuAtoken1...' },
      ]);
      decodeToken.mockReturnValue({
        proofs: [
          { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
          { amount: 32, secret: 'change_secret' },
        ],
      });
      isP2PKSecret.mockImplementation(secret => secret.startsWith('[\"P2PK\"'));
      sumProofs.mockReturnValue(32);

      const result = await recoverLockedChange();

      expect(result.recovered).toBe(1);
      expect(result.amount).toBe(32);
      expect(addProofs).toHaveBeenCalledWith([
        { amount: 32, secret: 'change_secret' },
      ]);
    });

    it('should return zero when no change proofs found', async () => {
      loadProofs.mockResolvedValue([]);
      getSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'cashuAtoken1...' },
      ]);
      decodeToken.mockReturnValue({
        proofs: [
          { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
        ],
      });
      isP2PKSecret.mockReturnValue(true);

      const result = await recoverLockedChange();

      expect(result.recovered).toBe(0);
      expect(result.amount).toBe(0);
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should skip change proofs already in wallet', async () => {
      loadProofs.mockResolvedValue([
        { secret: 'change_secret' }, // Already have this
      ]);
      getSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'cashuAtoken1...' },
      ]);
      decodeToken.mockReturnValue({
        proofs: [
          { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
          { amount: 32, secret: 'change_secret' },
        ],
      });
      isP2PKSecret.mockImplementation(secret => secret.startsWith('[\"P2PK\"'));

      const result = await recoverLockedChange();

      expect(result.recovered).toBe(0);
      expect(result.amount).toBe(0);
    });

    it('should handle decode errors for individual tokens (line 62)', async () => {
      const { logger } = require('../../../../utils/logger');

      loadProofs.mockResolvedValue([]);
      getSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'invalid_token' },
        { id: 'token2', token: 'cashuAtoken2...' },
      ]);
      decodeToken
        .mockImplementationOnce(() => { throw new Error('Invalid token'); })
        .mockReturnValueOnce({
          proofs: [
            { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
            { amount: 32, secret: 'change_secret' },
          ],
        });
      isP2PKSecret.mockImplementation(secret => secret.startsWith('[\"P2PK\"'));
      sumProofs.mockReturnValue(32);

      const result = await recoverLockedChange();

      // Should warn about first token but continue with second
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to decode sent token',
        expect.objectContaining({ tokenId: 'token1' })
      );
      expect(result.recovered).toBe(1);
    });

    it('should throw error on fatal failure (lines 99-100)', async () => {
      loadProofs.mockRejectedValue(new Error('Storage error'));

      await expect(recoverLockedChange()).rejects.toThrow('Storage error');
    });

    it('should handle empty sent tokens list', async () => {
      loadProofs.mockResolvedValue([]);
      getSentLockedTokens.mockResolvedValue([]);

      const result = await recoverLockedChange();

      expect(result.recovered).toBe(0);
      expect(result.message).toBe('No change proofs found in sent tokens');
    });

    it('should handle multiple tokens with change', async () => {
      loadProofs.mockResolvedValue([]);
      getSentLockedTokens.mockResolvedValue([
        { id: 'token1', token: 'cashuAtoken1...' },
        { id: 'token2', token: 'cashuAtoken2...' },
      ]);
      decodeToken
        .mockReturnValueOnce({
          proofs: [
            { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
            { amount: 32, secret: 'change1' },
          ],
        })
        .mockReturnValueOnce({
          proofs: [
            { amount: 128, secret: '[\"P2PK\",{\"data\":\"pubkey2\"}]' },
            { amount: 16, secret: 'change2' },
          ],
        });
      isP2PKSecret.mockImplementation(secret => secret.startsWith('[\"P2PK\"'));
      sumProofs.mockReturnValue(48);

      const result = await recoverLockedChange();

      expect(result.recovered).toBe(2);
      expect(addProofs).toHaveBeenCalledWith([
        { amount: 32, secret: 'change1' },
        { amount: 16, secret: 'change2' },
      ]);
    });
  });
});
