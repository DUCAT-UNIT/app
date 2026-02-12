/**
 * Tests for Runes PSBT Builder
 */

// Mock dependencies before imports
const mockAddInput = jest.fn();
const mockAddOutput = jest.fn();

jest.mock('bitcoinjs-lib', () => ({
  initEccLib: jest.fn(),
  Psbt: jest.fn(() => ({
    addInput: mockAddInput,
    addOutput: mockAddOutput,
    toBase64: jest.fn(() => 'base64_psbt'),
  })),
  Transaction: {
    fromHex: jest.fn(() => ({
      outs: [
        { script: Buffer.from('script0', 'hex'), value: 100000 },
        { script: Buffer.from('script1', 'hex'), value: 50000 },
      ],
    })),
  },
  address: {
    fromBech32: jest.fn(() => ({
      data: Buffer.alloc(32, 0xab),
    })),
    toOutputScript: jest.fn(() => Buffer.alloc(0)),
  },
}));

jest.mock('@bitcoinerlab/secp256k1', () => ({}));

jest.mock('../../../utils/bitcoin', () => ({
  MUTINYNET_NETWORK: { bech32: 'tb' },
}));

jest.mock('../../../utils/constants', () => ({
  getTxHexUrl: jest.fn((txid) => `https://example.com/tx/${txid}/hex`),
  RUNES_CONFIG: {
    DUCAT_UNIT_RUNE_ID: {
      block: 1527352n,
      tx: 1n,
    },
    DUCAT_UNIT_RUNE_LABEL: 'DUCAT•UNIT•RUNE',
  },
}));

jest.mock('../../../utils/runestoneEncoder', () => ({
  encodeRunestone: jest.fn(() => ({
    encodedRunestone: Buffer.from('runestone', 'hex'),
  })),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    transaction: jest.fn(),
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

import { fetchTransactionHex, buildRunesPsbt } from '../runesPsbtBuilder';
import { encodeRunestone } from '../../../utils/runestoneEncoder';

describe('runesPsbtBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddInput.mockClear();
    mockAddOutput.mockClear();

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('0100000001abcd...'),
    });
  });

  describe('fetchTransactionHex', () => {
    it('should fetch transaction hex from API', async () => {
      const txid = 'abc123';

      const result = await fetchTransactionHex(txid);

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toBe('0100000001abcd...');
    });
  });

  describe('buildRunesPsbt', () => {
    const runeUtxo = {
      transaction: 'rune_tx_123',
      vout: 0,
      value: 546,
      runeAmount: 10000,
      status: { confirmed: true },
    };

    const satUtxo = {
      txid: 'sat_tx_456',
      vout: 0,
      value: 50000,
      status: { confirmed: true },
    };

    const taprootAddress = 'tb1ptaproot';
    const segwitAddress = 'tb1qsegwit';
    const recipient = 'tb1qrecipient';

    it('should build PSBT with single rune UTXO', async () => {
      const result = await buildRunesPsbt(
        runeUtxo,
        satUtxo,
        taprootAddress,
        segwitAddress,
        recipient,
        5000, // amountInRunes
        546,  // recipientSats
        546,  // runeReturnSats
        10000, // change
        546   // dustLimit
      );

      // Should have 2 inputs (1 sat + 1 rune)
      expect(mockAddInput).toHaveBeenCalledTimes(2);

      // Should have 4 outputs (return + recipient + change + OP_RETURN)
      expect(mockAddOutput).toHaveBeenCalledTimes(4);
    });

    it('should build PSBT with multiple rune UTXOs', async () => {
      const runeUtxos = [
        { transaction: 'rune_tx_1', vout: 0, value: 546, runeAmount: 5000, status: { confirmed: true } },
        { transaction: 'rune_tx_2', vout: 0, value: 546, runeAmount: 5000, status: { confirmed: true } },
      ];

      await buildRunesPsbt(
        runeUtxos,
        satUtxo,
        taprootAddress,
        segwitAddress,
        recipient,
        10000, // Total rune amount from both UTXOs
        546,
        546,
        10000,
        546
      );

      // Should have 3 inputs (1 sat + 2 runes)
      expect(mockAddInput).toHaveBeenCalledTimes(3);
    });

    it('should skip change output when below dust limit', async () => {
      await buildRunesPsbt(
        runeUtxo,
        satUtxo,
        taprootAddress,
        segwitAddress,
        recipient,
        5000,
        546,
        546,
        100,  // change below dust limit
        546   // dustLimit
      );

      // Should have 3 outputs (return + recipient + OP_RETURN, no change)
      expect(mockAddOutput).toHaveBeenCalledTimes(3);
    });

    it('should add change output when above dust limit', async () => {
      await buildRunesPsbt(
        runeUtxo,
        satUtxo,
        taprootAddress,
        segwitAddress,
        recipient,
        5000,
        546,
        546,
        1000, // change above dust limit
        546
      );

      // Should have 4 outputs (return + recipient + change + OP_RETURN)
      expect(mockAddOutput).toHaveBeenCalledTimes(4);
    });

    it('should encode runestone with correct edict', async () => {
      await buildRunesPsbt(
        runeUtxo,
        satUtxo,
        taprootAddress,
        segwitAddress,
        recipient,
        5000,
        546,
        546,
        10000,
        546
      );

      expect(encodeRunestone).toHaveBeenCalledWith({
        edicts: [
          {
            id: { block: 1527352n, tx: 1n },
            amount: 5000n,
            output: 1,
          },
        ],
      });
    });

    it('should add sat input first (P2WPKH for fees)', async () => {
      await buildRunesPsbt(
        runeUtxo,
        satUtxo,
        taprootAddress,
        segwitAddress,
        recipient,
        5000,
        546,
        546,
        10000,
        546
      );

      // First call should be for sat UTXO
      expect(mockAddInput).toHaveBeenNthCalledWith(1, expect.objectContaining({
        hash: 'sat_tx_456',
        index: 0,
      }));
    });

    it('should add rune input with tapInternalKey', async () => {
      await buildRunesPsbt(
        runeUtxo,
        satUtxo,
        taprootAddress,
        segwitAddress,
        recipient,
        5000,
        546,
        546,
        10000,
        546
      );

      // Second call should be for rune UTXO with tapInternalKey
      expect(mockAddInput).toHaveBeenNthCalledWith(2, expect.objectContaining({
        hash: 'rune_tx_123',
        index: 0,
        tapInternalKey: expect.any(Buffer),
      }));
    });

    it('should add outputs in correct order', async () => {
      await buildRunesPsbt(
        runeUtxo,
        satUtxo,
        taprootAddress,
        segwitAddress,
        recipient,
        5000,
        546,
        546,
        10000,
        546
      );

      // Output 0: Rune return to taproot
      expect(mockAddOutput).toHaveBeenNthCalledWith(1, expect.objectContaining({
        address: taprootAddress,
      }));

      // Output 1: Recipient
      expect(mockAddOutput).toHaveBeenNthCalledWith(2, expect.objectContaining({
        address: recipient,
      }));

      // Output 2: Change to segwit
      expect(mockAddOutput).toHaveBeenNthCalledWith(3, expect.objectContaining({
        address: segwitAddress,
      }));

      // Output 3: OP_RETURN (runestone)
      expect(mockAddOutput).toHaveBeenNthCalledWith(4, expect.objectContaining({
        script: expect.any(Buffer),
        value: 0n,
      }));
    });

    it('should return a PSBT object', async () => {
      const result = await buildRunesPsbt(
        runeUtxo,
        satUtxo,
        taprootAddress,
        segwitAddress,
        recipient,
        5000,
        546,
        546,
        10000,
        546
      );

      expect(result).toBeDefined();
    });

    it('should fetch tx hex for each input', async () => {
      const runeUtxos = [
        { transaction: 'rune_tx_1', vout: 0, value: 546, runeAmount: 5000, status: { confirmed: true } },
        { transaction: 'rune_tx_2', vout: 0, value: 546, runeAmount: 5000, status: { confirmed: true } },
      ];

      await buildRunesPsbt(
        runeUtxos,
        satUtxo,
        taprootAddress,
        segwitAddress,
        recipient,
        10000,
        546,
        546,
        10000,
        546
      );

      // 1 for sat + 2 for runes = 3 fetches
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
