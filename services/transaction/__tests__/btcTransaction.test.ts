/**
 * Tests for BTC Transaction Service
 */

// Mock dependencies before imports
jest.mock('bitcoinjs-lib', () => {
  const mockPsbt = {
    addInput: jest.fn(),
    addOutput: jest.fn(),
    toBase64: jest.fn(() => 'base64_psbt_string'),
  };
  (global as Record<string, unknown>).__mockFromHexIdx = 0;
  (global as Record<string, unknown>).__mockUtxoValues = {} as Record<string, number>;
  return {
    initEccLib: jest.fn(),
    Psbt: jest.fn(() => mockPsbt),
    Transaction: {
      fromHex: jest.fn(() => {
        // Extract txid from the corresponding tx-hex fetch URL so getId() matches utxo.txid
        const fetchMock = global.fetch as jest.Mock;
        const fetchCalls = fetchMock?.mock?.calls ?? [];
        const txHexCalls = fetchCalls.filter((c: unknown[]) =>
          /\/tx\/[^/]+\/hex/.test(String(c[0] ?? ''))
        );
        const idx = (global as Record<string, unknown>).__mockFromHexIdx as number;
        const callUrl = txHexCalls[idx] ? String(txHexCalls[idx][0]) : '';
        (global as Record<string, unknown>).__mockFromHexIdx = idx + 1;
        const match = callUrl.match(/\/tx\/([^/]+)\/hex/);
        const txid = match ? match[1] : 'tx1';

        // C-02: UTXO value verification - output values must match UTXO values
        const utxoValues = (global as Record<string, unknown>).__mockUtxoValues as Record<string, number>;
        const utxoValue = utxoValues[txid] ?? 100000;

        return {
          getId: jest.fn(() => txid),
          outs: [
            { script: Buffer.from('script1', 'hex'), value: utxoValue },
            { script: Buffer.from('script2', 'hex'), value: 50000 },
          ],
        };
      }),
    },
  };
});

jest.mock('@bitcoinerlab/secp256k1', () => ({}));

jest.mock('../../../utils/bitcoin', () => ({
  MUTINYNET_NETWORK: { bech32: 'tb' },
  validateAndNormalizeAddress: jest.fn((addr) => addr),
}));

jest.mock('../../balanceService', () => ({
  fetchUtxos: jest.fn(),
}));

jest.mock('../../../utils/messages', () => ({
  ERRORS: {
    INVALID_AMOUNT: 'Invalid amount',
    NO_CONFIRMED_FUNDS: 'No confirmed funds available',
    INSUFFICIENT_FUNDS: 'Insufficient funds',
  },
}));

jest.mock('../../../utils/constants', () => ({
  getTxHexUrl: jest.fn((txid) => `https://example.com/tx/${txid}/hex`),
  BITCOIN_TX: {
    DUST_LIMIT: 546,
    SATOSHIS_PER_BTC: 100_000_000,
    ESTIMATED_TX_FEE: 1_000,
    RUNE_OUTPUT_AMOUNT: 10_000,
    TX_TIMEOUT_BUFFER: 5_000,
  },
}));

jest.mock('../../feeEstimationService', () => ({
  getRecommendedFeeRate: jest.fn(async () => 1),
}));

// Mock fetch globally
global.fetch = jest.fn();

import { createBtcIntent } from '../btcTransaction';
import { fetchUtxos } from '../../balanceService';
import { validateAndNormalizeAddress } from '../../../utils/bitcoin';

describe('btcTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as Record<string, unknown>).__mockFromHexIdx = 0;
    (global as Record<string, unknown>).__mockUtxoValues = {};

    // Default mock for fetch - returns tx hex
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('0100000001abcd...'), // Mock tx hex
    });
  });

  // Helper to register UTXO values so the mock Transaction.fromHex returns matching output values
  const registerUtxoValues = (utxos: Array<{ txid: string; value: number }>) => {
    const values = (global as Record<string, unknown>).__mockUtxoValues as Record<string, number>;
    for (const utxo of utxos) {
      values[utxo.txid] = utxo.value;
    }
  };

  describe('createBtcIntent', () => {
    const segwitAddress = 'tb1qtest123';
    const recipient = 'tb1qrecipient';
    const amount = '0.001'; // 100,000 sats

    it('should create a valid BTC intent', async () => {
      const utxos = [{ txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);
      registerUtxoValues(utxos);

      const result = await createBtcIntent(recipient, amount, segwitAddress, 0);

      expect(result).toMatchObject({
        type: 'send',
        assetType: 'BTC',
        amount: 100000,
        amountBTC: '0.00100000',
        recipient,
        addressType: 'segwit',
        sourceAddress: segwitAddress,
      });
      expect(result.psbt).toBe('base64_psbt_string');
      expect(result.inputCount).toBeGreaterThan(0);
    });

    it('should handle comma as decimal separator', async () => {
      const utxos = [{ txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);
      registerUtxoValues(utxos);

      const result = await createBtcIntent(recipient, '0,001', segwitAddress, 0);

      expect(result.amount).toBe(100000); // 0.001 BTC = 100,000 sats
    });

    it('should throw error for invalid amount', async () => {
      (fetchUtxos as jest.Mock).mockResolvedValue([
        { txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } },
      ]);

      await expect(createBtcIntent(recipient, 'invalid', segwitAddress, 0))
        .rejects.toThrow('Invalid amount');
    });

    it('should throw error for zero amount', async () => {
      (fetchUtxos as jest.Mock).mockResolvedValue([
        { txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } },
      ]);

      await expect(createBtcIntent(recipient, '0', segwitAddress, 0))
        .rejects.toThrow('Invalid amount');
    });

    it('should throw error for negative amount', async () => {
      (fetchUtxos as jest.Mock).mockResolvedValue([
        { txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } },
      ]);

      await expect(createBtcIntent(recipient, '-0.001', segwitAddress, 0))
        .rejects.toThrow('Invalid amount');
    });

    it('should throw error when no UTXOs available', async () => {
      (fetchUtxos as jest.Mock).mockResolvedValue([]);

      await expect(createBtcIntent(recipient, amount, segwitAddress, 0))
        .rejects.toThrow('No confirmed funds available');
    });

    it('should throw error for insufficient funds', async () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 600, status: { confirmed: true } }, // Only 600 sats — below dust after fee
      ];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);
      registerUtxoValues(utxos);

      await expect(createBtcIntent(recipient, '1.0', segwitAddress, 0)) // 1 BTC = 100M sats
        .rejects.toThrow('Insufficient funds');
    });

    it('should use unconfirmed UTXOs when provided', async () => {
      (fetchUtxos as jest.Mock).mockResolvedValue([]);
      const unconfirmedUtxos = [
        { txid: 'unconf_tx', vout: 0, value: 200000, status: { confirmed: false } },
      ];
      registerUtxoValues(unconfirmedUtxos);

      const result = await createBtcIntent(recipient, amount, segwitAddress, 0, unconfirmedUtxos);

      expect(result.inputs[0].txid).toBe('unconf_tx');
    });

    it('should filter out spent UTXOs', async () => {
      const utxos = [
        { txid: 'spent_tx', vout: 0, value: 200000, status: { confirmed: true } },
        { txid: 'available_tx', vout: 0, value: 200000, status: { confirmed: true } },
      ];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);
      registerUtxoValues(utxos);
      const spentUtxos = new Set(['spent_tx:0']);

      const result = await createBtcIntent(recipient, amount, segwitAddress, 0, [], spentUtxos);

      expect(result.inputs.some(i => i.txid === 'spent_tx')).toBe(false);
      expect(result.inputs.some(i => i.txid === 'available_tx')).toBe(true);
    });

    it('should include fee and change in result', async () => {
      const utxos = [{ txid: 'tx1', vout: 0, value: 500000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);
      registerUtxoValues(utxos);

      const result = await createBtcIntent(recipient, amount, segwitAddress, 0);

      expect(result.fee).toBeGreaterThan(0);
      expect(result.change).toBeGreaterThanOrEqual(0);
      expect(result.totalInput).toBe(500000);
    });

    it('should validate recipient address', async () => {
      const utxos = [{ txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);
      registerUtxoValues(utxos);

      await createBtcIntent(recipient, amount, segwitAddress, 0);

      expect(validateAndNormalizeAddress).toHaveBeenCalledWith(recipient);
    });

    it('should throw error when fetch tx hex fails', async () => {
      (fetchUtxos as jest.Mock).mockResolvedValue([
        { txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } },
      ]);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(createBtcIntent(recipient, amount, segwitAddress, 0))
        .rejects.toThrow('Failed to fetch transaction tx1: HTTP 404');
    });

    it('should use multiple UTXOs when needed', async () => {
      const utxos = [
        { txid: 'tx1', vout: 0, value: 50000, status: { confirmed: true } },
        { txid: 'tx2', vout: 0, value: 50000, status: { confirmed: true } },
        { txid: 'tx3', vout: 0, value: 50000, status: { confirmed: true } },
      ];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);
      registerUtxoValues(utxos);

      const result = await createBtcIntent(recipient, amount, segwitAddress, 0);

      expect(result.inputCount).toBeGreaterThan(1);
    });

    it('should prefer confirmed UTXOs over unconfirmed', async () => {
      const confirmedUtxos = [
        { txid: 'confirmed_tx', vout: 0, value: 200000, status: { confirmed: true } },
      ];
      (fetchUtxos as jest.Mock).mockResolvedValue(confirmedUtxos);
      const unconfirmedUtxos = [
        { txid: 'unconfirmed_tx', vout: 0, value: 200000, status: { confirmed: false } },
      ];
      registerUtxoValues([...confirmedUtxos, ...unconfirmedUtxos]);

      const result = await createBtcIntent(recipient, amount, segwitAddress, 0, unconfirmedUtxos);

      // Confirmed should be selected first
      expect(result.inputs[0].txid).toBe('confirmed_tx');
    });

    it('should include timestamp in result', async () => {
      const utxos = [{ txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);
      registerUtxoValues(utxos);

      const before = Date.now();
      const result = await createBtcIntent(recipient, amount, segwitAddress, 0);
      const after = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });

    it('should include id in result', async () => {
      const utxos = [{ txid: 'tx1', vout: 0, value: 200000, status: { confirmed: true } }];
      (fetchUtxos as jest.Mock).mockResolvedValue(utxos);
      registerUtxoValues(utxos);

      const result = await createBtcIntent(recipient, amount, segwitAddress, 0);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
    });
  });
});
