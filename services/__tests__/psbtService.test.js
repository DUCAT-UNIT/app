/**
 * Tests for psbtService
 */

import * as bitcoin from 'bitcoinjs-lib';
import {
  parsePSBT,
  buildFallbackOutputs,
  hasUnconfirmedInputs,
} from '../psbtService';

// Mock bitcoinjs-lib
jest.mock('bitcoinjs-lib', () => {
  const actual = jest.requireActual('bitcoinjs-lib');
  return {
    ...actual,
    Psbt: {
      fromBase64: jest.fn(),
    },
    address: {
      fromOutputScript: jest.fn(),
    },
    networks: {
      testnet: {},
    },
  };
});

describe('psbtService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parsePSBT', () => {
    it('should parse BTC transaction PSBT correctly', () => {
      const mockPsbt = {
        txOutputs: [
          {
            script: Buffer.from([0x00, 0x14]), // Not OP_RETURN
            value: BigInt(50000),
          },
          {
            script: Buffer.from([0x00, 0x14]),
            value: BigInt(30000),
          },
        ],
      };

      bitcoin.Psbt.fromBase64.mockReturnValue(mockPsbt);
      bitcoin.address.fromOutputScript.mockReturnValue('tb1qrecipient123');

      const sendIntent = {
        psbt: 'mock_psbt_base64',
        assetType: 'BTC',
        inputs: [
          { value: 100000, status: { confirmed: true } },
        ],
        sourceAddress: 'tb1qsource123',
        recipient: 'tb1qrecipient123',
      };

      const result = parsePSBT(sendIntent);

      expect(result.psbtInputs).toHaveLength(1);
      expect(result.psbtOutputs).toHaveLength(2);
      expect(result.actualFee).toBe(20000); // 100000 - 50000 - 30000
    });

    it('should parse UNIT transaction PSBT with OP_RETURN', () => {
      const mockPsbt = {
        txOutputs: [
          {
            script: Buffer.from([0x00, 0x14]),
            value: BigInt(10000),
          },
          {
            script: Buffer.from([0x00, 0x14]),
            value: BigInt(10000),
          },
          {
            script: Buffer.from([0x6a, 0x5d, 0x02]), // OP_RETURN (0x6a)
            value: BigInt(0),
          },
        ],
      };

      bitcoin.Psbt.fromBase64.mockReturnValue(mockPsbt);
      bitcoin.address.fromOutputScript.mockReturnValue('tb1p123');

      const sendIntent = {
        psbt: 'mock_psbt_base64',
        assetType: 'UNIT',
        runeUtxo: { value: 10000, runeAmount: 10000 },
        satUtxo: { value: 20000 },
        sourceAddress: 'tb1p123',
        feeAddress: 'tb1q456',
      };

      const result = parsePSBT(sendIntent);

      expect(result.psbtInputs).toHaveLength(2);
      expect(result.psbtOutputs).toHaveLength(3);
      expect(result.psbtOutputs[2].type).toBe('op_return');
      expect(result.psbtOutputs[2].address).toBe('OP_RETURN (Runestone)');
    });

    it('should handle PSBT parsing errors gracefully', () => {
      bitcoin.Psbt.fromBase64.mockImplementation(() => {
        throw new Error('Invalid PSBT');
      });

      const sendIntent = {
        psbt: 'invalid_psbt',
        assetType: 'BTC',
        inputs: [],
        sourceAddress: 'tb1q123',
      };

      const result = parsePSBT(sendIntent);

      expect(result.psbtInputs).toEqual([]);
      expect(result.psbtOutputs).toEqual([]);
      expect(result.actualFee).toBe(0);
    });

    it('should determine output types correctly for UNIT transactions', () => {
      const mockPsbt = {
        txOutputs: [
          { script: Buffer.from([0x00, 0x14]), value: BigInt(10000) }, // Index 0: rune_return
          { script: Buffer.from([0x00, 0x14]), value: BigInt(10000) }, // Index 1: recipient
          { script: Buffer.from([0x00, 0x14]), value: BigInt(5000) },  // Index 2: change
        ],
      };

      bitcoin.Psbt.fromBase64.mockReturnValue(mockPsbt);
      bitcoin.address.fromOutputScript.mockReturnValue('tb1p123');

      const sendIntent = {
        psbt: 'mock_psbt_base64',
        assetType: 'UNIT',
        runeUtxo: { value: 10000, runeAmount: 10000 },
        satUtxo: { value: 15000 },
        sourceAddress: 'tb1p123',
        feeAddress: 'tb1q456',
        recipient: 'tb1precipient',
      };

      const result = parsePSBT(sendIntent);

      expect(result.psbtOutputs[0].type).toBe('rune_return');
      expect(result.psbtOutputs[1].type).toBe('recipient');
      expect(result.psbtOutputs[2].type).toBe('change');
    });
  });

  describe('buildFallbackOutputs', () => {
    it('should build fallback outputs for BTC transaction', () => {
      const sendIntent = {
        recipient: 'tb1qrecipient',
        assetType: 'BTC',
        amountBTC: '0.001',
        sourceAddress: 'tb1qsource',
        change: 50000,
      };

      const result = buildFallbackOutputs(sendIntent);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        address: 'tb1qrecipient',
        value: 100000,
        type: 'recipient',
      });
      expect(result[1]).toEqual({
        address: 'tb1qsource',
        value: 50000,
        type: 'change',
      });
    });

    it('should build fallback outputs for UNIT transaction', () => {
      const sendIntent = {
        recipient: 'tb1precipient',
        assetType: 'UNIT',
        amount: 10000,
        sourceAddress: 'tb1psource',
        change: 5000,
      };

      const result = buildFallbackOutputs(sendIntent);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        address: 'tb1precipient',
        value: 10000,
        type: 'recipient',
      });
      expect(result[1]).toEqual({
        address: 'tb1psource',
        value: 5000,
        type: 'change',
      });
    });

    it('should not include change output if change is zero', () => {
      const sendIntent = {
        recipient: 'tb1qrecipient',
        assetType: 'BTC',
        amountBTC: '0.001',
        sourceAddress: 'tb1qsource',
        change: 0,
      };

      const result = buildFallbackOutputs(sendIntent);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('recipient');
    });

    it('should not include change output if change is negative', () => {
      const sendIntent = {
        recipient: 'tb1qrecipient',
        assetType: 'BTC',
        amountBTC: '0.001',
        sourceAddress: 'tb1qsource',
        change: -100,
      };

      const result = buildFallbackOutputs(sendIntent);

      expect(result).toHaveLength(1);
    });
  });

  describe('hasUnconfirmedInputs', () => {
    it('should return false if sendIntent is null', () => {
      const result = hasUnconfirmedInputs(null);
      expect(result).toBe(false);
    });

    it('should detect unconfirmed rune UTXO for UNIT transactions', () => {
      const sendIntent = {
        assetType: 'UNIT',
        runeUtxo: { status: { confirmed: false } },
        satUtxo: { status: { confirmed: true } },
      };

      const result = hasUnconfirmedInputs(sendIntent);
      expect(result).toBe(true);
    });

    it('should detect unconfirmed sat UTXO for UNIT transactions', () => {
      const sendIntent = {
        assetType: 'UNIT',
        runeUtxo: { status: { confirmed: true } },
        satUtxo: { status: { confirmed: false } },
      };

      const result = hasUnconfirmedInputs(sendIntent);
      expect(result).toBe(true);
    });

    it('should return false if all UNIT UTXOs are confirmed', () => {
      const sendIntent = {
        assetType: 'UNIT',
        runeUtxo: { status: { confirmed: true } },
        satUtxo: { status: { confirmed: true } },
      };

      const result = hasUnconfirmedInputs(sendIntent);
      expect(result).toBe(false);
    });

    it('should detect unconfirmed inputs for BTC transactions', () => {
      const sendIntent = {
        assetType: 'BTC',
        inputs: [
          { status: { confirmed: true } },
          { status: { confirmed: false } },
          { status: { confirmed: true } },
        ],
      };

      const result = hasUnconfirmedInputs(sendIntent);
      expect(result).toBe(true);
    });

    it('should return false if all BTC inputs are confirmed', () => {
      const sendIntent = {
        assetType: 'BTC',
        inputs: [
          { status: { confirmed: true } },
          { status: { confirmed: true } },
        ],
      };

      const result = hasUnconfirmedInputs(sendIntent);
      expect(result).toBe(false);
    });

    it('should return false if inputs array is empty', () => {
      const sendIntent = {
        assetType: 'BTC',
        inputs: [],
      };

      const result = hasUnconfirmedInputs(sendIntent);
      expect(result).toBe(false);
    });
  });
});
