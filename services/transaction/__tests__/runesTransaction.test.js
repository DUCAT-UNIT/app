/**
 * Tests for runesTransaction service - focused on spent UTXO branch coverage
 */

import { createUnitIntent } from '../runesTransaction';

// Mock modules
jest.mock('../../../utils/bitcoin', () => ({
  MUTINYNET_NETWORK: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: { public: 0x043587cf, private: 0x04358394 },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
  },
  validateAndNormalizeAddress: jest.fn((addr) => addr),
}));

jest.mock('../../../runestone-encoder', () => ({
  encodeRunestone: jest.fn(() => Buffer.from('mockrunestone')),
}));

// Mock global fetch
global.fetch = jest.fn();

describe('runesTransaction - spent UTXO branches', () => {
  const mockTaprootAddress = 'tb1ptestaddress';
  const mockSegwitAddress = 'tb1qtestaddress';
  const mockRecipient = 'tb1precipient';

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('spent UTXO handling', () => {
    it('should skip spent rune UTXOs in unconfirmed list (lines 145-152)', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const spentUtxos = new Set(['spenttx:0']);
      const unconfirmedTaprootUtxos = [
        { txid: 'spenttx', vout: 0, value: 1000, runeAmount: 100 }, // Spent - should be skipped
        // No other available unconfirmed rune UTXOs
      ];

      // Mock API calls - return empty to avoid finding runes
      global.fetch.mockImplementation((url) => {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      });

      // Expect error since no rune UTXO is available (test is about the branch being hit)
      await expect(
        createUnitIntent(
          mockRecipient,
          '50',
          mockTaprootAddress,
          mockSegwitAddress,
          0,
          unconfirmedTaprootUtxos,
          [],
          spentUtxos
        )
      ).rejects.toThrow();

      // KEY ASSERTION: Verify the spent UTXO branch was hit (this is what we're testing!)
      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️ Skipping spent rune UTXO:', 'spenttx:0');

      consoleLogSpy.mockRestore();
    });

  });
});
