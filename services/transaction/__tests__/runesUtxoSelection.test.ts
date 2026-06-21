/**
 * Tests for Runes UTXO Selection
 *
 * NOTE: This file uses type-safe fetch mock pattern.
 * See services/__tests__/testUtils/fetchMock.ts for the implementation.
 */

import { findRuneUtxo, findSatUtxo } from '../runesUtxoSelection';
import {
  setupMockFetch,
  getMockFetch,
  createMockResponse,
} from '../../__tests__/testUtils';

// Mock constants
jest.mock('../../../utils/constants', () => ({
  getOrdAddressUrl: jest.fn((address: string) => `https://ord.api/address/${address}`),
  getOrdOutputUrl: jest.fn((output: string) => `https://ord.api/output/${output}`),
  getTxOutspendUrl: jest.fn((txid: string, vout: number) => `https://api/tx/${txid}/outspend/${vout}`),
  getAddressUtxoUrl: jest.fn((address: string) => `https://api/address/${address}/utxo`),
  RUNES_CONFIG: {
    DUCAT_UNIT_RUNE_LABEL: 'DUCAT•UNIT•RUNE',
    DUCAT_UNIT_RUNE_ID: { block: 1527352n, tx: 1n },
  },
}));

describe('runesUtxoSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockFetch();
  });

  describe('findRuneUtxo', () => {
    it('should find rune UTXO in unconfirmed UTXOs', async () => {
      const taprootAddress = 'bc1ptaproot';
      const amountInRunes = 100;
      const unconfirmedUtxos = [
        { txid: 'unconfirmed1', vout: 0, value: 5000, runeAmount: 150 },
        { txid: 'unconfirmed2', vout: 1, value: 6000, runeAmount: 50 },
      ];
      const spentUtxos = new Set<string>();

      const result = await findRuneUtxo(taprootAddress, amountInRunes, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual([{
        transaction: 'unconfirmed1',
        vout: 0,
        value: 5000,
        runeAmount: 150,
        status: { confirmed: false },
      }]);
      // Should not call API if found in unconfirmed
      expect(getMockFetch()).not.toHaveBeenCalled();
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
      const unconfirmedUtxos: Array<{ txid: string; vout: number; value: number; runeAmount: number }> = [];
      const spentUtxos = new Set<string>();

      // Mock ord address response
      getMockFetch().mockResolvedValueOnce(
        createMockResponse({ outputs: ['txid1:0', 'txid2:1'] })
      );

      // Mock ord output response for first UTXO (txid1:0)
      getMockFetch().mockResolvedValueOnce(
        createMockResponse({
          transaction: 'txid1',
          value: 10000,
          runes: {
            'DUCAT•UNIT•RUNE': {
              amount: '150',
            },
          },
        })
      );

      // Mock ord output response for second UTXO (txid2:1) - fetched in parallel
      getMockFetch().mockResolvedValueOnce(
        createMockResponse({
          transaction: 'txid2',
          value: 5000,
          runes: {}, // No runes
        })
      );

      // Mock outspend check for txid1:0 (unspent)
      getMockFetch().mockResolvedValueOnce(
        createMockResponse({ spent: false })
      );

      const result = await findRuneUtxo(taprootAddress, amountInRunes, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual([{
        transaction: 'txid1',
        vout: 0,
        value: 10000,
        runeAmount: 150,
        status: { confirmed: true },
      }]);
    });

    it('should not select a UTXO for a different UNIT rune label', async () => {
      const taprootAddress = 'bc1ptaproot';
      const amountInRunes = 100;
      const unconfirmedUtxos: Array<{
        txid: string;
        vout: number;
        value: number;
        runeAmount: number;
      }> = [];
      const spentUtxos = new Set<string>();

      getMockFetch().mockResolvedValueOnce(
        createMockResponse({ outputs: ['txid1:0'] })
      );
      getMockFetch().mockResolvedValueOnce(
        createMockResponse({
          transaction: 'txid1',
          value: 10000,
          runes: {
            'DUCAT•UNIT•MTNY': {
              amount: '150',
            },
          },
        })
      );

      const result = await findRuneUtxo(
        taprootAddress,
        amountInRunes,
        unconfirmedUtxos,
        spentUtxos
      );

      expect(result).toBeNull();
    });

    it('should skip spent confirmed rune UTXOs', async () => {
      const taprootAddress = 'bc1ptaproot';
      const amountInRunes = 100;
      const unconfirmedUtxos: Array<{ txid: string; vout: number; value: number; runeAmount: number }> = [];
      const spentUtxos = new Set(['txid1:0']);

      // Mock ord address response
      getMockFetch().mockResolvedValueOnce(
        createMockResponse({ outputs: ['txid1:0', 'txid2:1'] })
      );

      // Mock ord output response for first UTXO (will be skipped as spent)
      getMockFetch().mockResolvedValueOnce(
        createMockResponse({
          transaction: 'txid1',
          value: 10000,
          runes: {
            'DUCAT•UNIT•RUNE': {
              amount: '150',
            },
          },
        })
      );

      // Mock ord output response for second UTXO
      getMockFetch().mockResolvedValueOnce(
        createMockResponse({
          transaction: 'txid2',
          value: 12000,
          runes: {
            'DUCAT•UNIT•RUNE': {
              amount: '200',
            },
          },
        })
      );

      // Mock outspend check (unspent)
      getMockFetch().mockResolvedValueOnce(
        createMockResponse({ spent: false })
      );

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
      const spentUtxos = new Set<string>();

      // Mock ord address response with no outputs
      getMockFetch().mockResolvedValueOnce(
        createMockResponse({ outputs: [] })
      );

      const result = await findRuneUtxo(taprootAddress, amountInRunes, unconfirmedUtxos, spentUtxos);

      expect(result).toBeNull();
    });
  });

  describe('findSatUtxo', () => {
    it('should find sat UTXO in unconfirmed UTXOs', async () => {
      const segwitAddress = 'bc1qsegwit';
      const unconfirmedUtxos = [
        { txid: 'unconfirmed1', vout: 0, value: 15000, status: { confirmed: true } },
        { txid: 'unconfirmed2', vout: 1, value: 20000, status: { confirmed: true } },
      ];
      const spentUtxos = new Set<string>();

      const result = await findSatUtxo(segwitAddress, unconfirmedUtxos, spentUtxos);

      expect(result).toEqual({
        txid: 'unconfirmed1',
        vout: 0,
        value: 15000,
        status: { confirmed: false },
      });
      // Should not call API if found in unconfirmed
      expect(getMockFetch()).not.toHaveBeenCalled();
    });

    it('should skip spent unconfirmed sat UTXOs', async () => {
      const segwitAddress = 'bc1qsegwit';
      const unconfirmedUtxos = [
        { txid: 'spent1', vout: 0, value: 15000, status: { confirmed: true } },
        { txid: 'unconfirmed2', vout: 1, value: 20000, status: { confirmed: true } },
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
        { txid: 'small1', vout: 0, value: 5000, status: { confirmed: true } }, // Less than MIN_FEE_SATS (12000)
      ];
      const spentUtxos = new Set<string>();

      // Mock blockchain UTXO response
      getMockFetch().mockResolvedValueOnce(
        createMockResponse([
          { txid: 'confirmed1', vout: 0, value: 15000, status: { confirmed: true } },
        ])
      );

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
      const unconfirmedUtxos: Array<{ txid: string; vout: number; value: number; status: { confirmed: boolean } }> = [];
      const spentUtxos = new Set<string>();

      // Mock blockchain UTXO response
      getMockFetch().mockResolvedValueOnce(
        createMockResponse([
          { txid: 'confirmed1', vout: 0, value: 15000, status: { confirmed: true } },
          { txid: 'confirmed2', vout: 1, value: 20000, status: { confirmed: true } },
        ])
      );

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
      const unconfirmedUtxos: Array<{ txid: string; vout: number; value: number; status: { confirmed: boolean } }> = [];
      const spentUtxos = new Set(['confirmed1:0']);

      // Mock blockchain UTXO response
      getMockFetch().mockResolvedValueOnce(
        createMockResponse([
          { txid: 'confirmed1', vout: 0, value: 15000, status: { confirmed: true } },
          { txid: 'confirmed2', vout: 1, value: 20000, status: { confirmed: true } },
        ])
      );

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
      const unconfirmedUtxos: Array<{ txid: string; vout: number; value: number; status: { confirmed: boolean } }> = [];
      const spentUtxos = new Set<string>();

      // Mock blockchain UTXO response with insufficient values
      getMockFetch().mockResolvedValueOnce(
        createMockResponse([
          { txid: 'small1', vout: 0, value: 5000, status: { confirmed: true } },
        ])
      );

      const result = await findSatUtxo(segwitAddress, unconfirmedUtxos, spentUtxos);

      expect(result).toBeNull();
    });
  });
});
