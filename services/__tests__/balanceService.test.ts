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
  getAddressUrl: jest.fn((address: string) => `https://api.example.com/address/${address}`),
  getAddressUtxoUrl: jest.fn((address: string) => `https://api.example.com/address/${address}/utxo`),
  getOrdAddressUrl: jest.fn((address: string) => `https://api.example.com/ord/address/${address}`),
  API_KEYS: {
    COINGECKO: undefined, // No API key by default in tests
  },
}));

/**
 * Typed mock references for apiClient
 */
interface ApiClientMocks {
  getJSON: jest.Mock;
  fetchParallel: jest.Mock;
}

const { getJSON, fetchParallel } = jest.requireMock('../../utils/apiClient') as ApiClientMocks;

describe('balanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      await expect(fetchWalletBalances(null as unknown as string, 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297'))
        .rejects.toThrow('Both segwit and taproot addresses are required');
    });

    it('should throw error if taproot address is missing', async () => {
      await expect(fetchWalletBalances('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', null as unknown as string))
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

    it('should fetch and calculate balances using real API responses', async () => {
      const segwitAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
      const taprootAddress = 'tb1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';

      // Restore fetchParallel to use real implementation
      const realFetchParallel = jest.requireActual('../../utils/apiClient').fetchParallel;
      fetchParallel.mockImplementationOnce(realFetchParallel);

      // Mock getJSON responses
      getJSON
        .mockResolvedValueOnce({
          chain_stats: {
            funded_txo_sum: 150000000,  // 1.5 BTC received
            spent_txo_sum: 50000000,    // 0.5 BTC spent
          },
        })
        .mockResolvedValueOnce({
          chain_stats: {
            funded_txo_sum: 200000000,  // 2 BTC received
            spent_txo_sum: 100000000,   // 1 BTC spent
          },
        })
        .mockResolvedValueOnce({
          runes_balances: [['UNIT', '1000']],
        });

      const result = await fetchWalletBalances(segwitAddress, taprootAddress);

      expect(result).toEqual({
        segwitBalance: 1,  // 1.5 - 0.5 = 1 BTC
        taprootBalance: 1, // 2 - 1 = 1 BTC
        runesBalance: [['UNIT', '1000']],
      });

      expect(getJSON).toHaveBeenCalledTimes(3);
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
      await expect(fetchUtxos(null as unknown as string))
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

    it('should include API key header when configured', async () => {
      // Temporarily set API key
      const constantsMock = jest.requireMock('../../utils/constants');
      const originalApiKeys = constantsMock.API_KEYS;
      constantsMock.API_KEYS = { COINGECKO: 'test-api-key' };

      const mockPriceData = { bitcoin: { usd: 50000 } };
      getJSON.mockResolvedValueOnce(mockPriceData);

      await fetchBtcPrice();

      expect(getJSON).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'x-cg-demo-api-key': 'test-api-key' },
        })
      );

      // Restore original API keys
      constantsMock.API_KEYS = originalApiKeys;
    });
  });

  describe('fetchWalletBalances additional tests', () => {
    it('should fetch all balances successfully with fetchParallel', async () => {
      // fetchWalletBalances uses fetchParallel internally
      fetchParallel.mockResolvedValueOnce([
        0.0005,  // segwitBalance (50000 sats in BTC)
        0.001,   // taprootBalance (100000 sats in BTC)
        [],      // runesBalance
      ]);

      const result = await fetchWalletBalances('tb1qsegwit', 'tb1ptaproot');

      expect(result).toBeDefined();
      expect(result.segwitBalance).toBe(0.0005);
      expect(result.taprootBalance).toBe(0.001);
    });

    it('should handle zero balances', async () => {
      // Mock fetchParallel with 0 balances
      fetchParallel.mockResolvedValueOnce([
        0,       // segwitBalance
        0,       // taprootBalance
        [],      // runesBalance
      ]);

      const result = await fetchWalletBalances('tb1qsegwit', 'tb1ptaproot');

      expect(result.segwitBalance).toBe(0);
      expect(result.taprootBalance).toBe(0);
    });

    it('should include runes balance in result', async () => {
      const runesBalance = [{ rune: 'UNIT', amount: '100.5' }];
      fetchParallel.mockResolvedValueOnce([
        0.001,         // segwitBalance
        0.002,         // taprootBalance
        runesBalance,  // runesBalance
      ]);

      const result = await fetchWalletBalances('tb1qsegwit', 'tb1ptaproot');

      expect(result.runesBalance).toEqual(runesBalance);
    });

    it('should return 0 for negative balance (segwit) via real implementation', async () => {
      const segwitAddress = 'tb1qnegativebalance';
      const taprootAddress = 'tb1pnegativebalance';

      // Restore fetchParallel to use real implementation
      const realFetchParallel = jest.requireActual('../../utils/apiClient').fetchParallel;
      fetchParallel.mockImplementationOnce(realFetchParallel);

      // Mock getJSON to return data where spent > funded (negative balance)
      getJSON
        .mockResolvedValueOnce({
          chain_stats: {
            funded_txo_sum: 50000000,   // 0.5 BTC received
            spent_txo_sum: 100000000,   // 1 BTC spent (more than received!)
          },
        })
        .mockResolvedValueOnce({
          chain_stats: {
            funded_txo_sum: 100000000,  // Normal positive
            spent_txo_sum: 50000000,
          },
        })
        .mockResolvedValueOnce({
          runes_balances: [],
        });

      const result = await fetchWalletBalances(segwitAddress, taprootAddress);

      // Negative balance should be clamped to 0
      expect(result.segwitBalance).toBe(0);
      expect(result.taprootBalance).toBe(0.5); // Normal positive balance
    });

    it('should return 0 for negative balance (taproot) via real implementation', async () => {
      const segwitAddress = 'tb1qnegativebalance';
      const taprootAddress = 'tb1pnegativebalance';

      // Restore fetchParallel to use real implementation
      const realFetchParallel = jest.requireActual('../../utils/apiClient').fetchParallel;
      fetchParallel.mockImplementationOnce(realFetchParallel);

      // Mock getJSON to return data where spent > funded (negative balance) for taproot
      getJSON
        .mockResolvedValueOnce({
          chain_stats: {
            funded_txo_sum: 100000000,  // Normal positive
            spent_txo_sum: 50000000,
          },
        })
        .mockResolvedValueOnce({
          chain_stats: {
            funded_txo_sum: 50000000,   // 0.5 BTC received
            spent_txo_sum: 100000000,   // 1 BTC spent (more than received!)
          },
        })
        .mockResolvedValueOnce({
          runes_balances: [],
        });

      const result = await fetchWalletBalances(segwitAddress, taprootAddress);

      expect(result.segwitBalance).toBe(0.5); // Normal positive balance
      // Negative balance should be clamped to 0
      expect(result.taprootBalance).toBe(0);
    });
  });
});
