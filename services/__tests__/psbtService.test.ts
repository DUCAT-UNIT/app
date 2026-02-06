/**
 * Tests for psbtService
 */

import * as bitcoin from 'bitcoinjs-lib';
import {
  parsePSBT,
  buildFallbackOutputs,
  hasUnconfirmedInputs,
  type SendIntent,
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

// Typed mock references
const mockPsbtFromBase64 = bitcoin.Psbt.fromBase64 as jest.Mock;
const mockAddressFromOutputScript = bitcoin.address.fromOutputScript as jest.Mock;

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

      mockPsbtFromBase64.mockReturnValue(mockPsbt);
      mockAddressFromOutputScript.mockReturnValue('tb1qrecipient123');

      const sendIntent = {
        psbt: 'mock_psbt_base64',
        assetType: 'BTC' as const,
        inputs: [
          { value: 100000, status: { confirmed: true } },
        ],
        sourceAddress: 'tb1qsource123',
        recipient: 'tb1qrecipient123',
      };

      const result = parsePSBT(sendIntent as SendIntent);

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

      mockPsbtFromBase64.mockReturnValue(mockPsbt);
      mockAddressFromOutputScript.mockReturnValue('tb1p123');

      const sendIntent = {
        psbt: 'mock_psbt_base64',
        assetType: 'UNIT' as const,
        runeUtxo: { value: 10000, runeAmount: 10000 },
        satUtxo: { value: 20000, status: { confirmed: true } },
        sourceAddress: 'tb1p123',
        feeAddress: 'tb1q456',
      };

      const result = parsePSBT(sendIntent as SendIntent);

      expect(result.psbtInputs).toHaveLength(2);
      expect(result.psbtOutputs).toHaveLength(3);
      expect(result.psbtOutputs[2].type).toBe('op_return');
      expect(result.psbtOutputs[2].address).toBe('OP_RETURN (Runestone)');
    });

    it('should handle PSBT parsing errors gracefully', () => {
      mockPsbtFromBase64.mockImplementation(() => {
        throw new Error('Invalid PSBT');
      });

      const sendIntent = {
        psbt: 'invalid_psbt',
        assetType: 'BTC' as const,
        inputs: [],
        sourceAddress: 'tb1q123',
      };

      const result = parsePSBT(sendIntent as any);

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

      mockPsbtFromBase64.mockReturnValue(mockPsbt);
      mockAddressFromOutputScript.mockReturnValue('tb1p123');

      const sendIntent = {
        psbt: 'mock_psbt_base64',
        assetType: 'UNIT' as const,
        runeUtxo: { value: 10000, runeAmount: 10000 },
        satUtxo: { value: 15000, status: { confirmed: true } },
        sourceAddress: 'tb1p123',
        feeAddress: 'tb1q456',
        recipient: 'tb1precipient',
      };

      const result = parsePSBT(sendIntent as SendIntent);

      expect(result.psbtOutputs[0].type).toBe('rune_return');
      expect(result.psbtOutputs[1].type).toBe('recipient');
      expect(result.psbtOutputs[2].type).toBe('change');
    });
  });

  describe('buildFallbackOutputs', () => {
    it('should build fallback outputs for BTC transaction', () => {
      const sendIntent = {
        psbt: '',
        recipient: 'tb1qrecipient',
        assetType: 'BTC' as const,
        amountBTC: '0.001',
        sourceAddress: 'tb1qsource',
        change: 50000,
      };

      const result = buildFallbackOutputs(sendIntent as SendIntent);

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
        psbt: '',
        recipient: 'tb1precipient',
        assetType: 'UNIT' as const,
        amount: 10000,
        sourceAddress: 'tb1psource',
        change: 5000,
      };

      const result = buildFallbackOutputs(sendIntent as SendIntent);

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
        psbt: '',
        recipient: 'tb1qrecipient',
        assetType: 'BTC' as const,
        amountBTC: '0.001',
        sourceAddress: 'tb1qsource',
        change: 0,
      };

      const result = buildFallbackOutputs(sendIntent as SendIntent);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('recipient');
    });

    it('should not include change output if change is negative', () => {
      const sendIntent = {
        psbt: '',
        recipient: 'tb1qrecipient',
        assetType: 'BTC' as const,
        amountBTC: '0.001',
        sourceAddress: 'tb1qsource',
        change: -100,
      };

      const result = buildFallbackOutputs(sendIntent as SendIntent);

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
        psbt: '',
        assetType: 'UNIT' as const,
        runeUtxo: { status: { confirmed: false } },
        satUtxo: { status: { confirmed: true } },
      } as Parameters<typeof hasUnconfirmedInputs>[0];

      const result = hasUnconfirmedInputs(sendIntent);
      expect(result).toBe(true);
    });

    it('should detect unconfirmed sat UTXO for UNIT transactions', () => {
      const sendIntent = {
        psbt: '',
        assetType: 'UNIT' as const,
        runeUtxo: { status: { confirmed: true } },
        satUtxo: { status: { confirmed: false } },
      } as Parameters<typeof hasUnconfirmedInputs>[0];

      const result = hasUnconfirmedInputs(sendIntent);
      expect(result).toBe(true);
    });

    it('should return false if all UNIT UTXOs are confirmed', () => {
      const sendIntent = {
        psbt: '',
        assetType: 'UNIT' as const,
        runeUtxo: { status: { confirmed: true } },
        satUtxo: { status: { confirmed: true } },
      } as Parameters<typeof hasUnconfirmedInputs>[0];

      const result = hasUnconfirmedInputs(sendIntent);
      expect(result).toBe(false);
    });

    it('should detect unconfirmed inputs for BTC transactions', () => {
      const sendIntent = {
        psbt: '',
        assetType: 'BTC' as const,
        inputs: [
          { status: { confirmed: true } },
          { status: { confirmed: false } },
          { status: { confirmed: true } },
        ],
      } as Parameters<typeof hasUnconfirmedInputs>[0];

      const result = hasUnconfirmedInputs(sendIntent);
      expect(result).toBe(true);
    });

    it('should return false if all BTC inputs are confirmed', () => {
      const sendIntent = {
        psbt: '',
        assetType: 'BTC' as const,
        inputs: [
          { status: { confirmed: true } },
          { status: { confirmed: true } },
        ],
      } as Parameters<typeof hasUnconfirmedInputs>[0];

      const result = hasUnconfirmedInputs(sendIntent);
      expect(result).toBe(false);
    });

    it('should return false if inputs array is empty', () => {
      const result = hasUnconfirmedInputs({
        psbt: '',
        assetType: 'BTC' as const,
        inputs: [],
      } as any);
      expect(result).toBe(false);
    });
  });
});
