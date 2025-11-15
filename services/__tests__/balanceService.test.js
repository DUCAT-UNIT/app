/**
 * Tests for Balance Service
 * Tests wallet balance fetching, UTXO retrieval, and BTC price fetching
 */

import {
  fetchWalletBalances,
  fetchUtxos,
  fetchBtcPrice,
} from '../balanceService';

// Mock dependencies
jest.mock('../../utils/api', () => ({
  fetchWithTimeout: jest.fn(),
}));

jest.mock('../../utils/retry', () => ({
  retrySilently: jest.fn((fn) => fn()),
}));

jest.mock('../../utils/constants', () => ({
  getAddressUrl: jest.fn((address) => `https://api.example.com/address/${address}`),
  getAddressUtxoUrl: jest.fn((address) => `https://api.example.com/address/${address}/utxo`),
  getOrdAddressUrl: jest.fn((address) => `https://api.example.com/ord/address/${address}`),
  API_KEYS: {
    COINGECKO: undefined, // No API key by default in tests
  },
}));

const { fetchWithTimeout } = require('../../utils/api');

describe('balanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('fetchWalletBalances', () => {
    it('should fetch balances for segwit and taproot addresses', async () => {
      const segwitAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const taprootAddress = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';

      const mockSegwitData = {
        chain_stats: {
          funded_txo_sum: 100000000,
          spent_txo_sum: 50000000,
        },
      };

      const mockTaprootData = {
        chain_stats: {
          funded_txo_sum: 200000000,
          spent_txo_sum: 100000000,
        },
      };

      const mockRunesData = {
        runes_balances: [
          { rune: 'UNIT', amount: '1000' },
        ],
      };

      fetchWithTimeout
        .mockResolvedValueOnce({
          json: async () => mockSegwitData,
        })
        .mockResolvedValueOnce({
          json: async () => mockTaprootData,
        })
        .mockResolvedValueOnce({
          json: async () => mockRunesData,
        });

      const result = await fetchWalletBalances(segwitAddress, taprootAddress);

      expect(result).toEqual({
        segwitBalance: 0.5,
        taprootBalance: 1,
        runesBalance: [{ rune: 'UNIT', amount: '1000' }],
      });

      expect(fetchWithTimeout).toHaveBeenCalledTimes(3);
    });

    it('should throw error if segwit address is missing', async () => {
      await expect(fetchWalletBalances(null, 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297'))
        .rejects.toThrow('Both segwit and taproot addresses are required');
    });

    it('should throw error if taproot address is missing', async () => {
      await expect(fetchWalletBalances('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', null))
        .rejects.toThrow('Both segwit and taproot addresses are required');
    });

    it('should handle missing chain_stats gracefully', async () => {
      const segwitAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const taprootAddress = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';

      fetchWithTimeout
        .mockResolvedValueOnce({
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          json: async () => ({}),
        });

      const result = await fetchWalletBalances(segwitAddress, taprootAddress);

      expect(result).toEqual({
        segwitBalance: 0,
        taprootBalance: 0,
        runesBalance: [],
      });
    });

    it('should handle partial failures gracefully', async () => {
      const segwitAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const taprootAddress = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';

      fetchWithTimeout
        .mockResolvedValueOnce({
          json: async () => ({
            chain_stats: {
              funded_txo_sum: 100000000,
              spent_txo_sum: 50000000,
            },
          }),
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          json: async () => ({ runes_balances: [] }),
        });

      const result = await fetchWalletBalances(segwitAddress, taprootAddress);

      expect(result).toEqual({
        segwitBalance: 0.5,
        taprootBalance: 0,
        runesBalance: [],
      });
    });

    it('should convert satoshis to BTC correctly', async () => {
      const segwitAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const taprootAddress = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';

      fetchWithTimeout
        .mockResolvedValueOnce({
          json: async () => ({
            chain_stats: {
              funded_txo_sum: 123456789,
              spent_txo_sum: 23456789,
            },
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            chain_stats: {
              funded_txo_sum: 1,
              spent_txo_sum: 0,
            },
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ runes_balances: [] }),
        });

      const result = await fetchWalletBalances(segwitAddress, taprootAddress);

      expect(result.segwitBalance).toBe(1);
      expect(result.taprootBalance).toBe(0.00000001);
    });
  });

  describe('fetchUtxos', () => {
    it('should fetch and format UTXOs for an address', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      const mockUtxos = [
        {
          txid: 'abc123',
          vout: 0,
          value: 50000,
          status: { confirmed: true },
        },
        {
          txid: 'def456',
          vout: 1,
          value: 100000,
          status: { confirmed: true },
        },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUtxos,
      });

      const result = await fetchUtxos(address);

      expect(result).toEqual([
        {
          txid: 'abc123',
          vout: 0,
          value: 50000,
          status: { confirmed: true },
        },
        {
          txid: 'def456',
          vout: 1,
          value: 100000,
          status: { confirmed: true },
        },
      ]);
    });

    it('should throw error if address is missing', async () => {
      await expect(fetchUtxos(null))
        .rejects.toThrow('Address is required');
    });

    it('should throw error if fetch fails', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      global.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(fetchUtxos(address))
        .rejects.toThrow('Failed to fetch UTXOs: Not Found');
    });

    it('should handle empty UTXO array', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await fetchUtxos(address);

      expect(result).toEqual([]);
    });
  });

  describe('fetchBtcPrice', () => {
    it('should fetch current BTC price in USD', async () => {
      const mockPriceData = {
        bitcoin: {
          usd: 45000.50,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPriceData,
      });

      const result = await fetchBtcPrice();

      expect(result).toBe(45000.50);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        { headers: {} }
      );
    });

    it('should return null if fetch fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
      });

      const result = await fetchBtcPrice();

      expect(result).toBeNull();
    });

    it('should return null if response is invalid', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await fetchBtcPrice();

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchBtcPrice();

      expect(result).toBeNull();
    });
  });
});
