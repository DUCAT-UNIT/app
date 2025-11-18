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
jest.mock('../../utils/apiClient', () => ({
  getWithRetry: jest.fn(),
  getJSON: jest.fn(),
  fetchParallel: jest.fn(),
}));

jest.mock('../../utils/constants', () => ({
  getAddressUrl: jest.fn((address) => `https://api.example.com/address/${address}`),
  getAddressUtxoUrl: jest.fn((address) => `https://api.example.com/address/${address}/utxo`),
  getOrdAddressUrl: jest.fn((address) => `https://api.example.com/ord/address/${address}`),
  API_KEYS: {
    COINGECKO: undefined, // No API key by default in tests
  },
}));

const { getJSON, fetchParallel } = require('../../utils/apiClient');

describe('balanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('fetchWalletBalances', () => {
    it('should fetch balances for segwit and taproot addresses', async () => {
      const segwitAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const taprootAddress = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';

      // Mock fetchParallel to return the results directly
      fetchParallel.mockResolvedValueOnce([
        0.5,  // segwitBalance
        1,    // taprootBalance
        [{ rune: 'UNIT', amount: '1000' }]  // runesBalance
      ]);

      const result = await fetchWalletBalances(segwitAddress, taprootAddress);

      expect(result).toEqual({
        segwitBalance: 0.5,
        taprootBalance: 1,
        runesBalance: [{ rune: 'UNIT', amount: '1000' }],
      });

      expect(fetchParallel).toHaveBeenCalledTimes(1);
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

      // Mock fetchParallel to return default values
      fetchParallel.mockResolvedValueOnce([0, 0, []]);

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

      // fetchParallel handles failures and returns defaultValue for failed fetches
      fetchParallel.mockResolvedValueOnce([
        0.5,  // segwitBalance (success)
        0,    // taprootBalance (failed, uses default)
        []    // runesBalance (success)
      ]);

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

      // Mock fetchParallel to return the already converted BTC values
      // 123456789 - 23456789 = 100000000 satoshis = 1 BTC
      // 1 - 0 = 1 satoshi = 0.00000001 BTC
      fetchParallel.mockResolvedValueOnce([
        1,              // segwitBalance (100000000 sats = 1 BTC)
        0.00000001,     // taprootBalance (1 sat = 0.00000001 BTC)
        []              // runesBalance
      ]);

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

      getJSON.mockResolvedValueOnce(mockUtxos);

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

      getJSON.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchUtxos(address))
        .rejects.toThrow('Network error');
    });

    it('should handle empty UTXO array', async () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

      getJSON.mockResolvedValueOnce([]);

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

      getJSON.mockResolvedValueOnce(mockPriceData);

      const result = await fetchBtcPrice();

      expect(result).toBe(45000.50);
      expect(getJSON).toHaveBeenCalledWith(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        expect.objectContaining({
          headers: {},
          description: 'Fetch BTC price'
        })
      );
    });

    it('should return null if fetch fails', async () => {
      getJSON.mockRejectedValueOnce(new Error('Service Unavailable'));

      const result = await fetchBtcPrice();

      expect(result).toBeNull();
    });

    it('should return null if response is invalid', async () => {
      getJSON.mockResolvedValueOnce({});

      const result = await fetchBtcPrice();

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      getJSON.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchBtcPrice();

      expect(result).toBeNull();
    });
  });
});
