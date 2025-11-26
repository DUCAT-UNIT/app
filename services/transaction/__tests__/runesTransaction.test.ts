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
((global as any).fetch = jest.fn();

describe('runesTransaction - spent UTXO branches', () => {
  const mockTaprootAddress = 'tb1ptestaddress';
  const mockSegwitAddress = 'tb1qtestaddress';
  const mockRecipient = 'tb1precipient';

  beforeEach(() => {
    jest.clearAllMocks();
    ((global as any).fetch.mockClear();
  });

  describe('spent UTXO handling', () => {
    it('should skip spent rune UTXOs in unconfirmed list (lines 145-152)', async () => {
      const spentUtxos = new Set(['spenttx:0']);
      const unconfirmedTaprootUtxos = [
        { txid: 'spenttx', vout: 0, value: 1000, runeAmount: 100 }, // Spent - should be skipped
        // No other available unconfirmed rune UTXOs
      ];

      // Mock API calls - return empty to avoid finding runes
      ((global as any).fetch.mockImplementation((url) => {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      });

      // Expect error since no rune UTXO is available (spent UTXO should be skipped)
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

      // Test verifies that spent UTXO is skipped by expecting an error when no valid UTXO is available
    });

  });
});
