// @ts-nocheck
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
        'cashuAtoken123',
        'tb1precipient',
        1000,
        'txid123',
        'https://short.url',
        'tb1psender'
      );

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'sent_turbo_tokens',
        expect.any(String)
      );

      // Verify the token was saved with correct structure
      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        token: 'cashuAtoken123',
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

    it('should limit to MAX_STORED_TOKENS (100)', async () => {
      // Create 100 existing tokens
      const existingTokens = Array.from({ length: 100 }, (_, i) => ({
        id: `token${i}`,
        token: `token${i}`,
        timestamp: i,
      }));
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(existingTokens));

      await saveSentLockedToken('newToken', 'recipient', 500);

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(100); // Should still be 100 (kept last 100)
    });

    it('should throw on storage error', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('Storage full'));

      await expect(
        saveSentLockedToken('token', 'recipient', 100)
      ).rejects.toThrow('Storage full');
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

    it('should exclude legacy tokens without taprootAddress when filtering', async () => {
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
    it('should delete all sent tokens', async () => {
      await clearSentLockedTokens();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('sent_turbo_tokens');
    });

    it('should throw on storage error', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      await expect(clearSentLockedTokens()).rejects.toThrow('Delete failed');
    });
  });

  describe('generateTurboDeeplink', () => {
    // Note: generateTurboDeeplink uses dynamic import for urlShortener
    // which bypasses static mocks. We test the fallback behavior.
    it('should return ducat:// deeplink as fallback', async () => {
      // Dynamic import will fail/fallback, returning the deeplink
      const result = await generateTurboDeeplink('cashuAtoken', 'recipient', 100);

      expect(result).toBe('ducat://turbo/cashuAtoken');
    });

    it('should construct correct deeplink format', async () => {
      const result = await generateTurboDeeplink('cashuAabcdef123', 'tb1precipient', 5000);

      expect(result).toMatch(/^ducat:\/\/turbo\/cashuA/);
      expect(result).toContain('cashuAabcdef123');
    });
  });

  describe('generateTurboQRData', () => {
    it('should return same result as generateTurboDeeplink', async () => {
      const deeplink = await generateTurboDeeplink('cashuAtoken', 'recipient', 100);
      const qrData = await generateTurboQRData('cashuAtoken', 'recipient', 100);

      expect(qrData).toBe(deeplink);
    });
  });

  describe('saveReceivedToken', () => {
    it('should save a received token', async () => {
      await saveReceivedToken('cashuAtoken', 'sender123', 500, 'tb1preceiver');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'received_turbo_tokens',
        expect.any(String)
      );

      const savedData = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        token: 'cashuAtoken',
        sender: 'sender123',
        amount: 500,
        taprootAddress: 'tb1preceiver',
        type: 'receive',
      });
    });

    it('should use "Unknown" for undefined sender', async () => {
      await saveReceivedToken('cashuAtoken', '', 500, 'tb1preceiver');

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
