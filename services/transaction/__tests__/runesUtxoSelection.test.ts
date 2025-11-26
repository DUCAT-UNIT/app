/**
 * Tests for Runes UTXO Selection
 */

import { findRuneUtxo, findSatUtxo } from '../runesUtxoSelection';

// Mock constants
jest.mock('../../../utils/constants', () => ({
  getOrdAddressUrl: jest.fn((address) => `https://ord.api/address/${address}`),
  getOrdOutputUrl: jest.fn((output) => `https://ord.api/output/${output}`),
  getTxOutspendUrl: jest.fn((txid, vout) => `https://api/tx/${txid}/outspend/${vout}`),
  getAddressUtxoUrl: jest.fn((address) => `https://api/address/${address}/utxo`),
}));

describe('runesUtxoSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ((global as any).fetch = jest.fn();
  });

  describe('findRuneUtxo', () => {
    it('should find rune UTXO in unconfirmed UTXOs', async () => {
      const taprootAddress = 'bc1ptaproot';
      const amountInRunes = 100;
      const unconfirmedUtxos = [
        { txid: 'unconfirmed1', vout: 0, value: 5000, runeAmount: 150 },
        { txid: 'unconfirmed2', vout: 1, value: 6000, runeAmount: 50 },
      ];
      const spentUtxos = new Set();

      const result = await findRuneUtxo(taprootAddress, amountInRunes, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual([{
        transaction: 'unconfirmed1',
        vout: 0,
        value: 5000,
        runeAmount: 150,
        status: { confirmed: false },
      }]);
      // Should not call API if found in unconfirmed
      expect(((global as any).fetch).not.toHaveBeenCalled();
    });

    it('should skip spent unconfirmed UTXOs', async () => {
      const taprootAddress = 'bc1ptaproot';
      const amountInRunes = 100;
      const unconfirmedUtxos = [
        { txid: 'spent1', vout: 0, value: 5000, runeAmount: 150 },
        { txid: 'unconfirmed2', vout: 1, value: 6000, runeAmount: 120 },
      ];
      const spentUtxos = new Set(['spent1:0']);

      const result = await findRuneUtxo(taprootAddress, amountInRunes, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual([{
        transaction: 'unconfirmed2',
        vout: 1,
        value: 6000,
        runeAmount: 120,
        status: { confirmed: false },
      }]);
    });

    it('should find confirmed rune UTXO from ord API', async () => {
      const taprootAddress = 'bc1ptaproot';
      const amountInRunes = 100;
      const unconfirmedUtxos = [];
      const spentUtxos = new Set();

      // Mock ord address response
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ({
          outputs: ['txid1:0', 'txid2:1'],
        }),
      });

      // Mock ord output response for first UTXO
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ({
          transaction: 'txid1',
          value: 10000,
          runes: {
            'DUCAT•UNIT•RUNE': {
              amount: '150',
            },
          },
        }),
      });

      // Mock outspend check (unspent)
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ({ spent: false }),
      });

      const result = await findRuneUtxo(taprootAddress, amountInRunes, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual([{
        transaction: 'txid1',
        vout: 0,
        value: 10000,
        runeAmount: 150,
        status: { confirmed: true },
      }]);
    });

    it('should skip spent confirmed rune UTXOs', async () => {
      const taprootAddress = 'bc1ptaproot';
      const amountInRunes = 100;
      const unconfirmedUtxos = [];
      const spentUtxos = new Set(['txid1:0']);

      // Mock ord address response
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ({
          outputs: ['txid1:0', 'txid2:1'],
        }),
      });

      // Mock ord output response for first UTXO (will be skipped as spent)
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ({
          transaction: 'txid1',
          value: 10000,
          runes: {
            'DUCAT•UNIT•RUNE': {
              amount: '150',
            },
          },
        }),
      });

      // Mock ord output response for second UTXO
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ({
          transaction: 'txid2',
          value: 12000,
          runes: {
            'DUCAT•UNIT•RUNE': {
              amount: '200',
            },
          },
        }),
      });

      // Mock outspend check (unspent)
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ({ spent: false }),
      });

      const result = await findRuneUtxo(taprootAddress, amountInRunes, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual([{
        transaction: 'txid2',
        vout: 1,
        value: 12000,
        runeAmount: 200,
        status: { confirmed: true },
      }]);
    });

    it('should return null if no suitable UTXO found', async () => {
      const taprootAddress = 'bc1ptaproot';
      const amountInRunes = 100;
      const unconfirmedUtxos = [
        { txid: 'unconfirmed1', vout: 0, value: 5000, runeAmount: 50 }, // Insufficient
      ];
      const spentUtxos = new Set();

      // Mock ord address response with no outputs
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ({ outputs: [] }),
      });

      const result = await findRuneUtxo(taprootAddress, amountInRunes, unconfirmedUtxos, spentUtxos);

      expect(result).toBeNull();
    });
  });

  describe('findSatUtxo', () => {
    it('should find sat UTXO in unconfirmed UTXOs', async () => {
      const segwitAddress = 'bc1qsegwit';
      const unconfirmedUtxos = [
        { txid: 'unconfirmed1', vout: 0, value: 15000 },
        { txid: 'unconfirmed2', vout: 1, value: 20000 },
      ];
      const spentUtxos = new Set();

      const result = await findSatUtxo(segwitAddress, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual({
        txid: 'unconfirmed1',
        vout: 0,
        value: 15000,
        status: { confirmed: false },
      });
      // Should not call API if found in unconfirmed
      expect(((global as any).fetch).not.toHaveBeenCalled();
    });

    it('should skip spent unconfirmed sat UTXOs', async () => {
      const segwitAddress = 'bc1qsegwit';
      const unconfirmedUtxos = [
        { txid: 'spent1', vout: 0, value: 15000 },
        { txid: 'unconfirmed2', vout: 1, value: 20000 },
      ];
      const spentUtxos = new Set(['spent1:0']);

      const result = await findSatUtxo(segwitAddress, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual({
        txid: 'unconfirmed2',
        vout: 1,
        value: 20000,
        status: { confirmed: false },
      });
    });

    it('should skip unconfirmed UTXOs with insufficient value', async () => {
      const segwitAddress = 'bc1qsegwit';
      const unconfirmedUtxos = [
        { txid: 'small1', vout: 0, value: 5000 }, // Less than MIN_FEE_SATS (12000)
      ];
      const spentUtxos = new Set();

      // Mock blockchain UTXO response
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ([
          { txid: 'confirmed1', vout: 0, value: 15000, status: { confirmed: true } },
        ]),
      });

      const result = await findSatUtxo(segwitAddress, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual({
        txid: 'confirmed1',
        vout: 0,
        value: 15000,
        status: { confirmed: true },
      });
    });

    it('should find confirmed sat UTXO from blockchain', async () => {
      const segwitAddress = 'bc1qsegwit';
      const unconfirmedUtxos = [];
      const spentUtxos = new Set();

      // Mock blockchain UTXO response
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ([
          { txid: 'confirmed1', vout: 0, value: 15000, status: { confirmed: true } },
          { txid: 'confirmed2', vout: 1, value: 20000, status: { confirmed: true } },
        ]),
      });

      const result = await findSatUtxo(segwitAddress, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual({
        txid: 'confirmed1',
        vout: 0,
        value: 15000,
        status: { confirmed: true },
      });
    });

    it('should skip spent confirmed sat UTXOs', async () => {
      const segwitAddress = 'bc1qsegwit';
      const unconfirmedUtxos = [];
      const spentUtxos = new Set(['confirmed1:0']);

      // Mock blockchain UTXO response
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ([
          { txid: 'confirmed1', vout: 0, value: 15000, status: { confirmed: true } },
          { txid: 'confirmed2', vout: 1, value: 20000, status: { confirmed: true } },
        ]),
      });

      const result = await findSatUtxo(segwitAddress, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual({
        txid: 'confirmed2',
        vout: 1,
        value: 20000,
        status: { confirmed: true },
      });
    });

    it('should return null if no suitable UTXO found', async () => {
      const segwitAddress = 'bc1qsegwit';
      const unconfirmedUtxos = [];
      const spentUtxos = new Set();

      // Mock blockchain UTXO response with insufficient values
      ((global as any).fetch.mockResolvedValueOnce({
        json: async () => ([
          { txid: 'small1', vout: 0, value: 5000, status: { confirmed: true } },
        ]),
      });

      const result = await findSatUtxo(segwitAddress, unconfirmedUtxos, spentUtxos);

      expect(result).toBeNull();
    });
  });
});
