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
  getCurrentCashuAccount: jest.fn(),
}));

jest.mock('../../cashuBalanceService', () => ({
  getOrFetchKeys: jest.fn().mockResolvedValue({ keysets: [{ id: 'keyset1' }] }),
}));

import { recoverLockedChange } from '../cashuRecoverLockedChange';
import { decodeToken, sumProofs } from '../../crypto';
import { isP2PKSecret } from '../../p2pk';
import { getSentLockedTokens } from '../../cashuLockedTokensService';
import { loadProofs, addProofs, getCurrentCashuAccount } from '../../cashuProofManager';

/**
 * Typed mock cast helper
 */
const mockFn = (fn: unknown): jest.Mock => fn as jest.Mock;

describe('cashuRecoverLockedChange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentCashuAccount as jest.Mock).mockReturnValue(null);
  });

  describe('recoverLockedChange', () => {
    it('should recover change proofs successfully', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([
        { secret: 'existing1' },
      ]);
      (getSentLockedTokens as jest.Mock).mockResolvedValue([
        { id: 'token1', token: 'cashuBtoken1...' },
      ]);
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: [
          { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
          { amount: 32, secret: 'change_secret', C: 'C', id: 'id' },
        ],
      });
      (isP2PKSecret as jest.Mock).mockImplementation((secret: string) => secret.startsWith('[\"P2PK\"'));
      (sumProofs as jest.Mock).mockReturnValue(32);

      const result = await recoverLockedChange();

      expect(result.recovered).toBe(1);
      expect(result.amount).toBe(32);
      expect(addProofs).toHaveBeenCalledWith([
        { amount: 32, secret: 'change_secret', C: 'C', id: 'id' },
      ]);
    });

    it('should return zero when no change proofs found', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (getSentLockedTokens as jest.Mock).mockResolvedValue([
        { id: 'token1', token: 'cashuBtoken1...' },
      ]);
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: [
          { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
        ],
      });
      (isP2PKSecret as jest.Mock).mockReturnValue(true);

      const result = await recoverLockedChange();

      expect(result.recovered).toBe(0);
      expect(result.amount).toBe(0);
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should skip change proofs already in wallet', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([
        { secret: 'change_secret' }, // Already have this
      ]);
      (getSentLockedTokens as jest.Mock).mockResolvedValue([
        { id: 'token1', token: 'cashuBtoken1...' },
      ]);
      (decodeToken as jest.Mock).mockReturnValue({
        proofs: [
          { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
          { amount: 32, secret: 'change_secret', C: 'C', id: 'id' },
        ],
      });
      (isP2PKSecret as jest.Mock).mockImplementation((secret: string) => secret.startsWith('[\"P2PK\"'));

      const result = await recoverLockedChange();

      expect(result.recovered).toBe(0);
      expect(result.amount).toBe(0);
    });

    it('should handle decode errors for individual tokens (line 62)', async () => {
      const { logger } = jest.requireMock('../../../../utils/logger') as { logger: { warn: jest.Mock } };

      mockFn(loadProofs).mockResolvedValue([]);
      mockFn(getSentLockedTokens).mockResolvedValue([
        { id: 'token1', token: 'invalid_token' },
        { id: 'token2', token: 'cashuBtoken2...' },
      ]);
      mockFn(decodeToken)
        .mockImplementationOnce(() => { throw new Error('Invalid token'); })
        .mockReturnValueOnce({
          proofs: [
            { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
            { amount: 32, secret: 'change_secret', C: 'C', id: 'id' },
          ],
        });
      mockFn(isP2PKSecret).mockImplementation((secret: string) => secret.startsWith('[\"P2PK\"'));
      mockFn(sumProofs).mockReturnValue(32);

      const result = await recoverLockedChange();

      // Should warn about first token but continue with second
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to decode sent token',
        expect.objectContaining({ tokenId: 'token1' })
      );
      expect(result.recovered).toBe(1);
    });

    it('should throw error on fatal failure (lines 99-100)', async () => {
      (loadProofs as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(recoverLockedChange()).rejects.toThrow('Storage error');
    });

    it('should handle empty sent tokens list', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (getSentLockedTokens as jest.Mock).mockResolvedValue([]);

      const result = await recoverLockedChange();

      expect(result.recovered).toBe(0);
      expect(result.message).toBe('No change proofs found in sent tokens');
    });

    it('should handle multiple tokens with change', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (getSentLockedTokens as jest.Mock).mockResolvedValue([
        { id: 'token1', token: 'cashuBtoken1...' },
        { id: 'token2', token: 'cashuBtoken2...' },
      ]);
      (decodeToken as jest.Mock)
        .mockReturnValueOnce({
          proofs: [
            { amount: 64, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
            { amount: 32, secret: 'change1', C: 'C', id: 'id' },
          ],
        })
        .mockReturnValueOnce({
          proofs: [
            { amount: 128, secret: '[\"P2PK\",{\"data\":\"pubkey2\"}]' },
            { amount: 16, secret: 'change2', C: 'C', id: 'id' },
          ],
        });
      (isP2PKSecret as jest.Mock).mockImplementation((secret: string) => secret.startsWith('[\"P2PK\"'));
      (sumProofs as jest.Mock).mockReturnValue(48);

      const result = await recoverLockedChange();

      expect(result.recovered).toBe(2);
      expect(addProofs).toHaveBeenCalledWith([
        { amount: 32, secret: 'change1', C: 'C', id: 'id' },
        { amount: 16, secret: 'change2', C: 'C', id: 'id' },
      ]);
    });

    it('should recover sat change into the sat proof store only', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (getSentLockedTokens as jest.Mock).mockResolvedValue([
        { id: 'unit-token', token: 'cashuBunit...' },
        { id: 'sat-token', token: 'cashuBsat...', unit: 'sat' },
      ]);
      (decodeToken as jest.Mock).mockReturnValue({
        unit: 'sat',
        proofs: [
          { amount: 1000, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
          { amount: 250, secret: 'sat_change', C: 'C', id: 'sat-id' },
        ],
      });
      (isP2PKSecret as jest.Mock).mockImplementation((secret: string) => secret.startsWith('[\"P2PK\"'));
      (sumProofs as jest.Mock).mockReturnValue(250);

      const result = await recoverLockedChange('sat');

      expect(result.recovered).toBe(1);
      expect(result.amount).toBe(250);
      expect(loadProofs).toHaveBeenCalledWith('sat');
      expect(addProofs).toHaveBeenCalledWith([
        { amount: 250, secret: 'sat_change', C: 'C', id: 'sat-id' },
      ], true, 'sat');
      expect(decodeToken).toHaveBeenCalledTimes(1);
    });

    it('should not recover change when token history unit does not match decoded token unit', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (getSentLockedTokens as jest.Mock).mockResolvedValue([
        { id: 'bad-sat-token', token: 'cashuBsat...', unit: 'sat' },
      ]);
      (decodeToken as jest.Mock).mockReturnValue({
        unit: 'unit',
        proofs: [
          { amount: 1000, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
          { amount: 250, secret: 'wrong_unit_change', C: 'C', id: 'unit-id' },
        ],
      });
      (isP2PKSecret as jest.Mock).mockImplementation((secret: string) => secret.startsWith('[\"P2PK\"'));

      const result = await recoverLockedChange('sat');

      expect(result.recovered).toBe(0);
      expect(addProofs).not.toHaveBeenCalled();
    });

    it('should not recover account-tagged change from a different wallet account', async () => {
      (getCurrentCashuAccount as jest.Mock).mockReturnValue('tb1pcurrent');
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (getSentLockedTokens as jest.Mock).mockResolvedValue([
        {
          id: 'other-account-token',
          token: 'cashuBother...',
          unit: 'sat',
          taprootAddress: 'tb1pother',
        },
        {
          id: 'current-account-token',
          token: 'cashuBcurrent...',
          unit: 'sat',
          taprootAddress: 'tb1pcurrent',
        },
      ]);
      (decodeToken as jest.Mock).mockReturnValue({
        unit: 'sat',
        proofs: [
          { amount: 1000, secret: '[\"P2PK\",{\"data\":\"pubkey\"}]' },
          { amount: 300, secret: 'current_sat_change', C: 'C', id: 'sat-id' },
        ],
      });
      (isP2PKSecret as jest.Mock).mockImplementation((secret: string) => secret.startsWith('[\"P2PK\"'));
      (sumProofs as jest.Mock).mockReturnValue(300);

      const result = await recoverLockedChange('sat');

      expect(result.recovered).toBe(1);
      expect(addProofs).toHaveBeenCalledWith([
        { amount: 300, secret: 'current_sat_change', C: 'C', id: 'sat-id' },
      ], true, 'sat');
      expect(decodeToken).toHaveBeenCalledTimes(1);
      expect(decodeToken).toHaveBeenCalledWith('cashuBcurrent...', ['keyset1']);
    });
  });
});
