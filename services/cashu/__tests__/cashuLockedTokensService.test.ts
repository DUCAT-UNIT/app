/**
 * Tests for cashuLockedTokensService
 */

// Mock dependencies BEFORE imports
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock urlShortener for generateTurboDeeplink
jest.mock('../../urlShortener', () => ({
  shortenCashuToken: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import {
  saveSentLockedToken,
  getSentLockedTokens,
  deleteSentLockedToken,
  updateTokenClaimedStatus,
  clearSentLockedTokens,
  clearReceivedTokensHistory,
  clearLockedTokensHistory,
  generateTurboDeeplink,
  generateTurboQRData,
  saveReceivedToken,
  getReceivedTokens,
} from '../cashuLockedTokensService';

describe('cashuLockedTokensService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('saveSentLockedToken', () => {
    it('should save a new sent locked token', async () => {
      await saveSentLockedToken(
        'cashuBtoken123',
        'tb1precipient',
        1000,
        'txid123',
        'https://short.url',
        'tb1psender'
      );

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'sent_turbo_tokens',
        expect.any(String),
        expect.any(Object)
      );

      // Verify the token was saved with correct structure
      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        token: 'cashuBtoken123',
        recipient: 'tb1precipient',
        amount: 1000,
        txid: 'txid123',
        shortUrl: 'https://short.url',
        taprootAddress: 'tb1psender',
      });
      expect(savedData[0]).toHaveProperty('timestamp');
      expect(savedData[0]).toHaveProperty('id');
    });

    it('should append to existing tokens', async () => {
      const existingTokens = [
        { id: 'existing1', token: 'existing', timestamp: 1000 },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingTokens));

      await saveSentLockedToken('newToken', 'recipient', 500);

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(2);
    });

    it('should update an existing token instead of duplicating it', async () => {
      const existingTokens = [
        {
          id: 'existing1',
          token: 'cashuBtoken123',
          recipient: 'old-recipient',
          amount: 1000,
          timestamp: 1000,
          txid: null,
          shortUrl: null,
          taprootAddress: 'tb1psender',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingTokens));

      await saveSentLockedToken(
        'cashuBtoken123',
        'tb1precipient',
        1000,
        null,
        'https://short.url',
        'tb1psender'
      );

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        id: 'existing1',
        token: 'cashuBtoken123',
        recipient: 'tb1precipient',
        shortUrl: 'https://short.url',
        timestamp: 1000,
      });
    });

    it('should limit to MAX_STORED_TOKENS (100)', async () => {
      // Create 100 existing tokens
      const existingTokens = Array.from({ length: 100 }, (_, i) => ({
        id: `token${i}`,
        token: `token${i}`,
        timestamp: i,
        claimed: true,
      }));
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingTokens));

      await saveSentLockedToken('newToken', 'recipient', 500);

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(100); // Should still be 100 (kept last 100)
    });

    it('should keep the newest sent tokens when trimming storage', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
      const existingTokens = Array.from({ length: 100 }, (_, i) => ({
        id: `token${i}`,
        token: `token${i}`,
        recipient: 'recipient',
        amount: i,
        timestamp: i,
        claimed: true,
        txid: null,
        shortUrl: null,
        taprootAddress: 'tb1psender',
      }));
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingTokens));

      try {
        await saveSentLockedToken('newToken', 'recipient', 500);
      } finally {
        nowSpy.mockRestore();
      }

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(100);
      expect(savedData.some((token: any) => token.id === 'token0')).toBe(false);
      expect(savedData.some((token: any) => token.id === 'token99')).toBe(true);
      expect(savedData.some((token: any) => token.token === 'newToken')).toBe(true);
    });

    it('should not evict active unclaimed sent tokens when trimming storage', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
      const existingTokens = Array.from({ length: 100 }, (_, i) => ({
        id: `token${i}`,
        token: `token${i}`,
        recipient: 'recipient',
        amount: i,
        timestamp: i,
        claimed: i !== 0,
        txid: null,
        shortUrl: null,
        taprootAddress: 'tb1psender',
      }));
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingTokens));

      try {
        await saveSentLockedToken('newToken', 'recipient', 500);
      } finally {
        nowSpy.mockRestore();
      }

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(100);
      expect(savedData.some((token: any) => token.id === 'token0')).toBe(true);
      expect(savedData.some((token: any) => token.id === 'token1')).toBe(false);
      expect(savedData.some((token: any) => token.token === 'newToken')).toBe(true);
    });

    it('should throw on storage error', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage full'));

      await expect(
        saveSentLockedToken('token', 'recipient', 100)
      ).rejects.toThrow('Storage full');
    });

    it('should not overwrite corrupt sent token storage', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('{bad json');

      await expect(saveSentLockedToken('token', 'recipient', 100)).rejects.toThrow(
        'sent token storage corrupted'
      );

      expect((SecureStore.setItemAsync as jest.Mock).mock.calls).not.toContainEqual([
        'sent_turbo_tokens',
        expect.any(String),
        expect.any(Object),
      ]);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^sent_turbo_tokens_corrupt_/),
        '{bad json',
        expect.any(Object),
      );
    });
  });

  describe('getSentLockedTokens', () => {
    it('should return empty array when no tokens stored', async () => {
      const tokens = await getSentLockedTokens();

      expect(tokens).toEqual([]);
    });

    it('should return all tokens when no filter provided', async () => {
      const storedTokens = [
        { id: '1', token: 't1', timestamp: 100, taprootAddress: 'addr1' },
        { id: '2', token: 't2', timestamp: 200, taprootAddress: 'addr2' },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      const tokens = await getSentLockedTokens();

      expect(tokens).toHaveLength(2);
    });

    it('should filter by taproot address', async () => {
      const storedTokens = [
        { id: '1', token: 't1', timestamp: 100, taprootAddress: 'addr1' },
        { id: '2', token: 't2', timestamp: 200, taprootAddress: 'addr2' },
        { id: '3', token: 't3', timestamp: 300, taprootAddress: 'addr1' },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      const tokens = await getSentLockedTokens('addr1');

      expect(tokens).toHaveLength(2);
      expect(tokens.every((t: any) => t.taprootAddress === 'addr1')).toBe(true);
    });

    it('should exclude tokens without taprootAddress when filtering', async () => {
      const storedTokens = [
        { id: '1', token: 't1', timestamp: 100 }, // No taprootAddress
        { id: '2', token: 't2', timestamp: 200, taprootAddress: 'addr1' },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      const tokens = await getSentLockedTokens('addr1');

      expect(tokens).toHaveLength(1);
      expect(tokens[0].id).toBe('2');
    });

    it('should sort by timestamp descending (newest first)', async () => {
      const storedTokens = [
        { id: '1', token: 't1', timestamp: 100, taprootAddress: 'addr1' },
        { id: '2', token: 't2', timestamp: 300, taprootAddress: 'addr1' },
        { id: '3', token: 't3', timestamp: 200, taprootAddress: 'addr1' },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      const tokens = await getSentLockedTokens();

      expect(tokens[0].timestamp).toBe(300);
      expect(tokens[1].timestamp).toBe(200);
      expect(tokens[2].timestamp).toBe(100);
    });

    it('should return empty array on error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const tokens = await getSentLockedTokens();

      expect(tokens).toEqual([]);
    });

    it('should return empty array and quarantine corrupt sent token storage for display reads', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('not json');

      const tokens = await getSentLockedTokens();

      expect(tokens).toEqual([]);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^sent_turbo_tokens_corrupt_/),
        'not json',
        expect.any(Object),
      );
    });
  });

  describe('deleteSentLockedToken', () => {
    it('should delete token by ID', async () => {
      const storedTokens = [
        { id: 'token1', token: 't1', timestamp: 100 },
        { id: 'token2', token: 't2', timestamp: 200 },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      await deleteSentLockedToken('token1');

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('token2');
    });

    it('should do nothing if token ID not found', async () => {
      const storedTokens = [
        { id: 'token1', token: 't1', timestamp: 100 },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      await deleteSentLockedToken('nonexistent');

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
    });

    it('should throw on storage error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('[]');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(deleteSentLockedToken('token1')).rejects.toThrow('Storage error');
    });
  });

  describe('updateTokenClaimedStatus', () => {
    it('should update claimed status to true', async () => {
      const storedTokens = [
        { id: 'token1', token: 't1', timestamp: 100 },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      await updateTokenClaimedStatus('token1', true);

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData[0].claimed).toBe(true);
      expect(savedData[0].claimedAt).toBeDefined();
    });

    it('should update claimed status to false', async () => {
      const storedTokens = [
        { id: 'token1', token: 't1', timestamp: 100, claimed: true, claimedAt: 12345 },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      await updateTokenClaimedStatus('token1', false);

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData[0].claimed).toBe(false);
      expect(savedData[0].claimedAt).toBeNull();
    });

    it('should update received token claimed status when requested', async () => {
      const storedTokens = [
        { id: 'received1', token: 't1', sender: 'sender', timestamp: 100, taprootAddress: 'addr1', type: 'receive' },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      await updateTokenClaimedStatus('received1', true, 'received');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'received_turbo_tokens',
        expect.any(String),
        expect.any(Object)
      );
      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData[0].claimed).toBe(true);
      expect(savedData[0].claimedAt).toBeDefined();
    });

    it('should not modify other tokens', async () => {
      const storedTokens = [
        { id: 'token1', token: 't1', timestamp: 100 },
        { id: 'token2', token: 't2', timestamp: 200 },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      await updateTokenClaimedStatus('token1', true);

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      // Note: getSentLockedTokens sorts by timestamp DESC, so token2 comes first
      const token1 = savedData.find((t: any) => t.id === 'token1');
      const token2 = savedData.find((t: any) => t.id === 'token2');
      expect(token1.claimed).toBe(true);
      expect(token2.claimed).toBeUndefined();
    });

    it('should throw on storage error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('[]');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(updateTokenClaimedStatus('token1', true)).rejects.toThrow('Storage error');
    });
  });

  describe('clearSentLockedTokens', () => {
    it('should clear claimed sent tokens while preserving active unclaimed tokens', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify([
        {
          id: 'active-token',
          token: 'cashuBactive',
          recipient: 'tb1preceiver',
          amount: 100,
          timestamp: 1000,
          txid: null,
          shortUrl: 'ducat://turbo/cashuBactive',
          taprootAddress: 'tb1psender',
          claimed: false,
        },
        {
          id: 'claimed-token',
          token: 'cashuBclaimed',
          recipient: 'tb1preceiver',
          amount: 100,
          timestamp: 900,
          txid: null,
          shortUrl: null,
          taprootAddress: 'tb1psender',
          claimed: true,
        },
      ]));

      await clearSentLockedTokens();

      const saved = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('active-token');
    });

    it('should throw on storage error', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Write failed'));

      await expect(clearSentLockedTokens()).rejects.toThrow('Write failed');
    });
  });

  describe('clearReceivedTokensHistory', () => {
    it('should clear received token history', async () => {
      await clearReceivedTokensHistory();

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'received_turbo_tokens',
        '[]',
        expect.any(Object)
      );
    });

    it('should throw on storage error', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Write failed'));

      await expect(clearReceivedTokensHistory()).rejects.toThrow('Write failed');
    });
  });

  describe('clearLockedTokensHistory', () => {
    it('should preserve active outgoing tokens and clear received token history', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify([
        {
          id: 'active-token',
          token: 'cashuBactive',
          recipient: 'tb1preceiver',
          amount: 100,
          timestamp: 1000,
          claimed: false,
        },
        {
          id: 'claimed-token',
          token: 'cashuBclaimed',
          recipient: 'tb1preceiver',
          amount: 100,
          timestamp: 900,
          claimed: true,
        },
      ]));

      await clearLockedTokensHistory();

      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2);
      const savedSent = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedSent).toHaveLength(1);
      expect(savedSent[0].id).toBe('active-token');
      expect(SecureStore.setItemAsync).toHaveBeenNthCalledWith(
        2,
        'received_turbo_tokens',
        '[]',
        expect.any(Object)
      );
    });
  });

  describe('generateTurboDeeplink', () => {
    // Note: generateTurboDeeplink uses dynamic import for urlShortener
    // which bypasses static mocks. We test the fallback behavior.
    it('should return ducat:// deeplink as fallback', async () => {
      // Dynamic import will fail/fallback, returning the deeplink
      const result = await generateTurboDeeplink('cashuBtoken', 'recipient', 100);

      expect(result).toBe('ducat://turbo/cashuBtoken');
    });

    it('should construct correct deeplink format', async () => {
      const result = await generateTurboDeeplink('cashuBabcdef123', 'tb1precipient', 5000);

      expect(result).toMatch(/^ducat:\/\/turbo\/cashuB/);
      expect(result).toContain('cashuBabcdef123');
    });
  });

  describe('generateTurboQRData', () => {
    it('should return same result as generateTurboDeeplink', async () => {
      const deeplink = await generateTurboDeeplink('cashuBtoken', 'recipient', 100);
      const qrData = await generateTurboQRData('cashuBtoken', 'recipient', 100);

      expect(qrData).toBe(deeplink);
    });
  });

  describe('saveReceivedToken', () => {
    it('should save a received token', async () => {
      await saveReceivedToken('cashuBtoken', 'sender123', 500, 'tb1preceiver');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'received_turbo_tokens',
        expect.any(String),
        expect.any(Object)
      );

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        token: 'cashuBtoken',
        sender: 'sender123',
        amount: 500,
        taprootAddress: 'tb1preceiver',
        type: 'receive',
      });
    });

    it('should use "Unknown" for undefined sender', async () => {
      await saveReceivedToken('cashuBtoken', '', 500, 'tb1preceiver');

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData[0].sender).toBe('Unknown');
    });

    it('should append to existing received tokens', async () => {
      const existingTokens = [
        { id: 'existing1', token: 'existing', timestamp: 1000 },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingTokens));

      await saveReceivedToken('newToken', 'sender', 500, 'address');

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(2);
    });

    it('should update an existing received token instead of duplicating it', async () => {
      const existingTokens = [
        {
          id: 'received1',
          token: 'cashuBtoken',
          sender: 'Cashu Receive',
          amount: 500,
          timestamp: 1000,
          taprootAddress: 'tb1pold',
          unit: 'unit',
          type: 'receive',
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingTokens));

      await saveReceivedToken('cashuBtoken', 'Turbo Claim', 600, 'tb1pnew', 'sat');

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        id: 'received1',
        token: 'cashuBtoken',
        sender: 'Turbo Claim',
        amount: 600,
        timestamp: 1000,
        taprootAddress: 'tb1pnew',
        unit: 'sat',
        type: 'receive',
      });
    });

    it('should mark matching sent token claimed when a self-sent token is received', async () => {
      const sentTokens = [
        {
          id: 'sent1',
          token: 'cashuBself',
          recipient: 'tb1pself',
          amount: 500,
          timestamp: 1000,
          taprootAddress: 'tb1pself',
          unit: 'unit',
          txid: null,
          shortUrl: null,
        },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === 'received_turbo_tokens') return Promise.resolve(JSON.stringify([]));
        if (key === 'sent_turbo_tokens') return Promise.resolve(JSON.stringify(sentTokens));
        return Promise.resolve(null);
      });

      await saveReceivedToken('cashuBself', 'Turbo Claim', 500, 'tb1pself');

      const sentWrite = (SecureStore.setItemAsync as jest.Mock).mock.calls.find(
        ([key]) => key === 'sent_turbo_tokens'
      );
      expect(sentWrite).toBeTruthy();
      const savedSentTokens = JSON.parse(sentWrite[1]);
      expect(savedSentTokens[0]).toMatchObject({
        id: 'sent1',
        token: 'cashuBself',
        claimed: true,
      });
      expect(savedSentTokens[0].claimedAt).toEqual(expect.any(Number));
    });

    it('should limit to MAX_STORED_TOKENS (100)', async () => {
      const existingTokens = Array.from({ length: 100 }, (_, i) => ({
        id: `received_${i}`,
        token: `token${i}`,
        timestamp: i,
      }));
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingTokens));

      await saveReceivedToken('newToken', 'sender', 500, 'address');

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(100);
    });

    it('should throw on storage error', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(
        saveReceivedToken('token', 'sender', 100, 'address')
      ).rejects.toThrow('Storage error');
    });

    it('should not overwrite corrupt received token storage', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('not json');

      await expect(
        saveReceivedToken('token', 'sender', 100, 'address')
      ).rejects.toThrow('received token storage corrupted');

      expect((SecureStore.setItemAsync as jest.Mock).mock.calls).not.toContainEqual([
        'received_turbo_tokens',
        expect.any(String),
        expect.any(Object),
      ]);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^received_turbo_tokens_corrupt_/),
        'not json',
        expect.any(Object),
      );
    });
  });

  describe('getReceivedTokens', () => {
    it('should return empty array when no tokens stored', async () => {
      const tokens = await getReceivedTokens();

      expect(tokens).toEqual([]);
    });

    it('should return all tokens when no filter provided', async () => {
      const storedTokens = [
        { id: '1', token: 't1', taprootAddress: 'addr1' },
        { id: '2', token: 't2', taprootAddress: 'addr2' },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      const tokens = await getReceivedTokens();

      expect(tokens).toHaveLength(2);
    });

    it('should filter by taproot address', async () => {
      const storedTokens = [
        { id: '1', token: 't1', taprootAddress: 'addr1' },
        { id: '2', token: 't2', taprootAddress: 'addr2' },
        { id: '3', token: 't3', taprootAddress: 'addr1' },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(storedTokens));

      const tokens = await getReceivedTokens('addr1');

      expect(tokens).toHaveLength(2);
      expect(tokens.every((t: any) => t.taprootAddress === 'addr1')).toBe(true);
    });

    it('should return empty array on error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const tokens = await getReceivedTokens();

      expect(tokens).toEqual([]);
    });
  });
});
