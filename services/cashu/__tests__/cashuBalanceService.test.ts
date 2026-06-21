/**
 * Tests for cashuBalanceService
 */

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../cashuMintClient', () => ({
  getKeys: jest.fn(),
}));

jest.mock('../cashuProofManager', () => ({
  loadProofs: jest.fn(),
  loadProofsPartial: jest.fn(),
}));

jest.mock('../p2pk', () => ({
  isP2PKSecret: jest.fn(),
}));

jest.mock('../crypto', () => ({
  sumProofs: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrFetchKeys, getBalance } from '../cashuBalanceService';
import { getKeys } from '../cashuMintClient';
import { loadProofs, loadProofsPartial } from '../cashuProofManager';
import { isP2PKSecret } from '../p2pk';
import { sumProofs } from '../crypto';

describe('cashuBalanceService', () => {
  const balanceKeyData = {
    keysets: [
      { id: 'id1', unit: 'unit', active: true, keys: { 1: 'key1' } },
      { id: 'id2', unit: 'unit', active: true, keys: { 1: 'key2' } },
      { id: 'id3', unit: 'unit', active: true, keys: { 1: 'key3' } },
      { id: 'sat-keyset', unit: 'sat', active: true, keys: { 1: 'sat-key' } },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (getKeys as jest.Mock).mockResolvedValue(balanceKeyData);
  });

  describe('getOrFetchKeys', () => {
    it('should fetch fresh keys when cache is empty', async () => {
      const mockKeysetData = {
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      };
      (getKeys as jest.Mock).mockResolvedValue(mockKeysetData);

      const result = await getOrFetchKeys();

      expect(getKeys).toHaveBeenCalled();
      expect(result).toEqual(mockKeysetData);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should return cached keys when valid and not expired', async () => {
      const mockKeysetData = {
        keysets: [
          { id: 'unit-keyset', unit: 'unit', keys: { 1: 'key1' } },
          { id: 'sat-keyset', unit: 'sat', keys: { 1: 'key2' } },
        ],
      };
      const cachedData = {
        keysetData: mockKeysetData,
        timestamp: Date.now() - 1000, // 1 second ago (not expired)
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));

      const result = await getOrFetchKeys();

      expect(getKeys).not.toHaveBeenCalled();
      expect(result).toEqual(mockKeysetData);
    });

    it('should refetch when cached keys are missing the sat keyset', async () => {
      const cachedData = {
        keysetData: {
          keysets: [{ id: 'unit-keyset', unit: 'unit', keys: { 1: 'key1' } }],
        },
        timestamp: Date.now() - 1000,
      };
      const freshKeysetData = {
        keysets: [
          { id: 'unit-keyset', unit: 'unit', keys: { 1: 'key1' } },
          { id: 'sat-keyset', unit: 'sat', keys: { 1: 'key2' } },
        ],
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
      (getKeys as jest.Mock).mockResolvedValue(freshKeysetData);

      const result = await getOrFetchKeys();

      expect(getKeys).toHaveBeenCalled();
      expect(result).toEqual(freshKeysetData);
    });

    it('should refetch when cache is expired (line 30-32)', async () => {
      const mockKeysetData = {
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      };
      const cachedData = {
        keysetData: { keysets: [{ id: 'old' }] },
        timestamp: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago (expired)
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));
      (getKeys as jest.Mock).mockResolvedValue(mockKeysetData);

      const result = await getOrFetchKeys();

      expect(getKeys).toHaveBeenCalled();
      expect(result).toEqual(mockKeysetData);
    });

    it('should handle old cache format without timestamp (line 34)', async () => {
      // Old format without keysetData wrapper
      const oldFormatCache = { keysets: [{ id: 'old' }] };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(oldFormatCache));

      const mockKeysetData = {
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      };
      (getKeys as jest.Mock).mockResolvedValue(mockKeysetData);

      const result = await getOrFetchKeys();

      expect(getKeys).toHaveBeenCalled();
      expect(result).toEqual(mockKeysetData);
    });

    it('should handle JSON parse error gracefully (line 35-36)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json {{{');

      const mockKeysetData = {
        keysets: [{ id: 'keyset1', keys: { 1: 'key1' } }],
      };
      (getKeys as jest.Mock).mockResolvedValue(mockKeysetData);

      const { logger } = require('../../../utils/logger');

      const result = await getOrFetchKeys();

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to parse cached keys, will refetch',
        expect.any(Object)
      );
      expect(getKeys).toHaveBeenCalled();
      expect(result).toEqual(mockKeysetData);
    });

    it('should throw and log error on fetch failure (line 51-52)', async () => {
      const { logger } = require('../../../utils/logger');
      (getKeys as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(getOrFetchKeys()).rejects.toThrow('Network error');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get keys',
        expect.objectContaining({ error: 'Network error' })
      );
    });
  });

  describe('getBalance', () => {
    beforeEach(() => {
      (isP2PKSecret as jest.Mock).mockReturnValue(false);
      (sumProofs as jest.Mock).mockReturnValue(1);
    });

    it('should calculate balance from proofs', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([
        { amount: 64, secret: 's1', C: 'C1', id: 'id1' },
        { amount: 32, secret: 's2', C: 'C2', id: 'id2' },
        { amount: 4, secret: 's3', C: 'C3', id: 'id3' },
      ]);
      (sumProofs as jest.Mock).mockReturnValue(1);

      const result = await getBalance();

      expect(loadProofs).toHaveBeenCalled();
      expect(sumProofs).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should filter out P2PK locked proofs', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([
        { amount: 64, secret: 'normal', C: 'C1', id: 'id1' },
        { amount: 32, secret: '[\"P2PK\",{}]', C: 'C2', id: 'id2' },
      ]);
      (isP2PKSecret as jest.Mock).mockImplementation((secret: string) => secret.startsWith('[\"P2PK\"'));
      (sumProofs as jest.Mock).mockReturnValue(0.64);

      const result = await getBalance();

      // sumProofs should be called with only the non-P2PK proof
      expect(sumProofs).toHaveBeenCalledWith([
        { amount: 64, secret: 'normal', C: 'C1', id: 'id1' },
      ]);
      expect(result).toBe(0.64);
    });

    it('should filter out proofs whose keyset is not valid for the balance unit', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([
        { amount: 64, secret: 'valid', C: 'C1', id: 'id1' },
        { amount: 32, secret: 'stale', C: 'C2', id: 'stale-keyset' },
        { amount: 16, secret: 'sat', C: 'C3', id: 'sat-keyset' },
      ]);
      (sumProofs as jest.Mock).mockReturnValue(64);

      const result = await getBalance();

      expect(sumProofs).toHaveBeenCalledWith([
        { amount: 64, secret: 'valid', C: 'C1', id: 'id1' },
      ]);
      expect(result).toBe(64);
    });

    it('should return 0 when no proofs', async () => {
      (loadProofs as jest.Mock).mockResolvedValue([]);
      (sumProofs as jest.Mock).mockReturnValue(0);

      const result = await getBalance();

      expect(result).toBe(0);
    });

    it('should use partial load when fullLoad is false', async () => {
      (loadProofsPartial as jest.Mock).mockResolvedValue([{ amount: 64, secret: 's1', C: 'C1', id: 'id1' }]);
      (sumProofs as jest.Mock).mockReturnValue(0.64);

      const result = await getBalance(false);

      expect(loadProofsPartial).toHaveBeenCalledWith(25);
      expect(loadProofs).not.toHaveBeenCalled();
      expect(result).toBe(0.64);
    });
  });
});
