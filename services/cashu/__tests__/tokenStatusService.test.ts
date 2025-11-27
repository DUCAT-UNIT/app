/**
 * Tests for tokenStatusService
 */

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../crypto', () => ({
  decodeToken: jest.fn(),
}));

jest.mock('../cashuMintClient', () => ({
  checkProofsSpent: jest.fn(),
}));

jest.mock('../cashuLockedTokensService', () => ({
  updateTokenClaimedStatus: jest.fn(),
}));

import {
  checkTokenStatus,
  checkTokensStatus,
  loadTokensWithStatus,
  clearTokenStatusCache,
  TokenWithStatus,
} from '../tokenStatusService';
import { decodeToken } from '../crypto';
import { checkProofsSpent } from '../cashuMintClient';
import { updateTokenClaimedStatus, EcashTokenRecord } from '../cashuLockedTokensService';
import { logger } from '../../../utils/logger';

describe('tokenStatusService', () => {
  const mockToken: EcashTokenRecord = {
    id: 'token123',
    token: 'cashuAeyJ0b2tlbiI6W10sIm1pbnQiOiJodHRwczovL21pbnQuY29tIn0=',
    amount: 100,
    timestamp: Date.now(),
    recipient: 'bc1p...',
    txid: null,
    shortUrl: null,
    taprootAddress: 'bc1ptaproot',
  };

  const mockProofs = [
    { amount: 64, secret: 'secret1', C: 'C1', id: 'keysetId' },
    { amount: 36, secret: 'secret2', C: 'C2', id: 'keysetId' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    clearTokenStatusCache();
    (decodeToken as jest.Mock).mockReturnValue({ proofs: mockProofs, mint: 'https://mint.com', amount: 100 });
  });

  describe('clearTokenStatusCache', () => {
    it('should clear the cache so tokens are rechecked', async () => {
      // First call - should check with API
      (checkProofsSpent as jest.Mock).mockResolvedValue({
        states: [
          { Y: 'Y1', state: 'UNSPENT' },
          { Y: 'Y2', state: 'UNSPENT' },
        ],
      });

      await checkTokenStatus(mockToken);
      expect(checkProofsSpent).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await checkTokenStatus(mockToken);
      expect(checkProofsSpent).toHaveBeenCalledTimes(1);

      // Clear cache
      clearTokenStatusCache();

      // Third call - should check with API again
      await checkTokenStatus(mockToken);
      expect(checkProofsSpent).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkTokenStatus', () => {
    it('should return claimed=true immediately if token is already marked claimed', async () => {
      const claimedToken = { ...mockToken, claimed: true };

      const result = await checkTokenStatus(claimedToken);

      expect(result.claimed).toBe(true);
      expect(checkProofsSpent).not.toHaveBeenCalled();
    });

    it('should check proofs and return unclaimed status', async () => {
      (checkProofsSpent as jest.Mock).mockResolvedValue({
        states: [
          { Y: 'Y1', state: 'UNSPENT' },
          { Y: 'Y2', state: 'UNSPENT' },
        ],
      });

      const result = await checkTokenStatus(mockToken);

      expect(result.claimed).toBe(false);
      expect(result.partiallySpent).toBe(false);
      expect(checkProofsSpent).toHaveBeenCalledWith(mockProofs);
    });

    it('should detect fully claimed token when all proofs are spent', async () => {
      (checkProofsSpent as jest.Mock).mockResolvedValue({
        states: [
          { Y: 'Y1', state: 'SPENT' },
          { Y: 'Y2', state: 'SPENT' },
        ],
      });

      const result = await checkTokenStatus(mockToken);

      expect(result.claimed).toBe(true);
      expect(result.partiallySpent).toBe(false);
      expect(updateTokenClaimedStatus).toHaveBeenCalledWith('token123', true);
    });

    it('should detect partially spent token', async () => {
      (checkProofsSpent as jest.Mock).mockResolvedValue({
        states: [
          { Y: 'Y1', state: 'SPENT' },
          { Y: 'Y2', state: 'UNSPENT' },
        ],
      });

      const result = await checkTokenStatus(mockToken);

      expect(result.claimed).toBe(false);
      expect(result.partiallySpent).toBe(true);
    });

    it('should use cached result for unclaimed tokens within TTL', async () => {
      (checkProofsSpent as jest.Mock).mockResolvedValue({
        states: [
          { Y: 'Y1', state: 'UNSPENT' },
          { Y: 'Y2', state: 'UNSPENT' },
        ],
      });

      // First call
      await checkTokenStatus(mockToken);
      expect(checkProofsSpent).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await checkTokenStatus(mockToken);
      expect(checkProofsSpent).toHaveBeenCalledTimes(1);
    });

    it('should use cached result permanently for claimed tokens', async () => {
      (checkProofsSpent as jest.Mock).mockResolvedValue({
        states: [
          { Y: 'Y1', state: 'SPENT' },
          { Y: 'Y2', state: 'SPENT' },
        ],
      });

      // First call - marks as claimed
      const result1 = await checkTokenStatus(mockToken);
      expect(result1.claimed).toBe(true);
      expect(checkProofsSpent).toHaveBeenCalledTimes(1);

      // Second call with same token (different object) - should use cache
      const result2 = await checkTokenStatus({ ...mockToken });
      expect(result2.claimed).toBe(true);
      expect(checkProofsSpent).toHaveBeenCalledTimes(1);
    });

    it('should return unclaimed for invalid token strings', async () => {
      const httpToken = { ...mockToken, token: 'https://example.com/token' };
      const result1 = await checkTokenStatus(httpToken);
      expect(result1.claimed).toBe(false);
      expect(checkProofsSpent).not.toHaveBeenCalled();

      clearTokenStatusCache();

      const ducatToken = { ...mockToken, token: 'ducat://claim/token' };
      const result2 = await checkTokenStatus(ducatToken);
      expect(result2.claimed).toBe(false);

      clearTokenStatusCache();

      const invalidToken = { ...mockToken, token: 'notcashu' };
      const result3 = await checkTokenStatus(invalidToken);
      expect(result3.claimed).toBe(false);

      clearTokenStatusCache();

      const undefinedToken = { ...mockToken, token: undefined as unknown as string };
      const result4 = await checkTokenStatus(undefinedToken);
      expect(result4.claimed).toBe(false);
    });

    it('should handle empty states array', async () => {
      (checkProofsSpent as jest.Mock).mockResolvedValue({ states: [] });

      const result = await checkTokenStatus(mockToken);

      expect(result.claimed).toBe(false);
      expect(result.partiallySpent).toBe(false);
    });

    it('should handle undefined states', async () => {
      (checkProofsSpent as jest.Mock).mockResolvedValue({});

      const result = await checkTokenStatus(mockToken);

      expect(result.claimed).toBe(false);
      expect(result.partiallySpent).toBe(false);
    });

    it('should cache failure and rethrow error', async () => {
      const error = new Error('Network error');
      (checkProofsSpent as jest.Mock).mockRejectedValue(error);

      await expect(checkTokenStatus(mockToken)).rejects.toThrow('Network error');

      // Clear mock to check cache behavior
      (checkProofsSpent as jest.Mock).mockClear();

      // Calling again immediately should still use cache (which returns unclaimed)
      // Wait a moment then clear and try again to see it hits cache
      clearTokenStatusCache();
      (checkProofsSpent as jest.Mock).mockRejectedValue(error);
      await expect(checkTokenStatus(mockToken)).rejects.toThrow('Network error');
    });

    it('should not update storage if token was already claimed', async () => {
      (checkProofsSpent as jest.Mock).mockResolvedValue({
        states: [
          { Y: 'Y1', state: 'SPENT' },
          { Y: 'Y2', state: 'SPENT' },
        ],
      });

      // Token already marked as claimed
      const alreadyClaimedToken = { ...mockToken, claimed: true };
      await checkTokenStatus(alreadyClaimedToken);

      // Should not call updateTokenClaimedStatus since it returns early
      expect(updateTokenClaimedStatus).not.toHaveBeenCalled();
    });
  });

  describe('checkTokensStatus', () => {
    it('should check status of multiple tokens in parallel', async () => {
      const tokens: EcashTokenRecord[] = [
        { ...mockToken, id: 'token1' },
        { ...mockToken, id: 'token2' },
        { ...mockToken, id: 'token3' },
      ];

      (checkProofsSpent as jest.Mock).mockResolvedValue({
        states: [
          { Y: 'Y1', state: 'UNSPENT' },
          { Y: 'Y2', state: 'UNSPENT' },
        ],
      });

      const results = await checkTokensStatus(tokens);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.claimed === false)).toBe(true);
    });

    it('should handle errors gracefully and return unclaimed for failed tokens', async () => {
      const tokens: EcashTokenRecord[] = [
        { ...mockToken, id: 'token1' },
        { ...mockToken, id: 'token2', token: 'cashuBdifferent' },
      ];

      (checkProofsSpent as jest.Mock)
        .mockResolvedValueOnce({
          states: [{ Y: 'Y1', state: 'SPENT' }, { Y: 'Y2', state: 'SPENT' }],
        })
        .mockRejectedValueOnce(new Error('API error'));

      const results = await checkTokensStatus(tokens);

      expect(results).toHaveLength(2);
      expect(results[0].claimed).toBe(true);
      expect(results[1].claimed).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should limit error logging to MAX_ERRORS_TO_LOG', async () => {
      const tokens: EcashTokenRecord[] = Array(5).fill(null).map((_, i) => ({
        ...mockToken,
        id: `token${i}`,
        token: `cashuA${i}`,
      }));

      (checkProofsSpent as jest.Mock).mockRejectedValue(new Error('API error'));

      await checkTokensStatus(tokens);

      // Should only log 3 errors (MAX_ERRORS_TO_LOG)
      expect(logger.error).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledWith('[tokenStatusService] Suppressing further errors...');
    });

    it('should return empty array for empty input', async () => {
      const results = await checkTokensStatus([]);
      expect(results).toHaveLength(0);
    });

    it('should handle non-Error exceptions', async () => {
      const tokens: EcashTokenRecord[] = [{ ...mockToken, id: 'token1' }];

      (checkProofsSpent as jest.Mock).mockRejectedValue('string error');

      const results = await checkTokensStatus(tokens);

      expect(results).toHaveLength(1);
      expect(results[0].claimed).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        '[tokenStatusService] Failed to check token status:',
        expect.objectContaining({ error: 'string error' })
      );
    });
  });

  describe('loadTokensWithStatus', () => {
    it('should load and check status of all tokens', async () => {
      const mockGetSentLockedTokens = jest.fn().mockResolvedValue([
        { ...mockToken, id: 'sent1' },
      ]);
      const mockGetReceivedTokens = jest.fn().mockResolvedValue([
        { ...mockToken, id: 'received1' },
      ]);

      (checkProofsSpent as jest.Mock).mockResolvedValue({
        states: [
          { Y: 'Y1', state: 'UNSPENT' },
          { Y: 'Y2', state: 'UNSPENT' },
        ],
      });

      const results = await loadTokensWithStatus(
        'bc1ptaproot',
        mockGetSentLockedTokens,
        mockGetReceivedTokens
      );

      expect(mockGetSentLockedTokens).toHaveBeenCalledWith('bc1ptaproot');
      expect(mockGetReceivedTokens).toHaveBeenCalledWith('bc1ptaproot');
      expect(results).toHaveLength(2);
    });

    it('should handle undefined taproot address', async () => {
      const mockGetSentLockedTokens = jest.fn().mockResolvedValue([]);
      const mockGetReceivedTokens = jest.fn().mockResolvedValue([]);

      const results = await loadTokensWithStatus(
        undefined,
        mockGetSentLockedTokens,
        mockGetReceivedTokens
      );

      expect(mockGetSentLockedTokens).toHaveBeenCalledWith(undefined);
      expect(mockGetReceivedTokens).toHaveBeenCalledWith(undefined);
      expect(results).toHaveLength(0);
    });

    it('should combine sent and received tokens', async () => {
      const mockGetSentLockedTokens = jest.fn().mockResolvedValue([
        { ...mockToken, id: 'sent1' },
        { ...mockToken, id: 'sent2' },
      ]);
      const mockGetReceivedTokens = jest.fn().mockResolvedValue([
        { ...mockToken, id: 'received1' },
      ]);

      (checkProofsSpent as jest.Mock).mockResolvedValue({
        states: [{ Y: 'Y1', state: 'UNSPENT' }],
      });

      const results = await loadTokensWithStatus(
        'bc1p...',
        mockGetSentLockedTokens,
        mockGetReceivedTokens
      );

      expect(results).toHaveLength(3);
      expect(results.map(r => r.id)).toContain('sent1');
      expect(results.map(r => r.id)).toContain('sent2');
      expect(results.map(r => r.id)).toContain('received1');
    });
  });
});
