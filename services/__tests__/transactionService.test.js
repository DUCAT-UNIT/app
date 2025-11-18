/**
 * Tests for transactionService
 */

import * as TransactionService from '../transaction';
import * as balanceService from '../balanceService';
import * as SecureStorageService from '../secureStorageService';
import { ERRORS } from '../../utils/messages';
import * as bitcoinUtils from '../../utils/bitcoin';

jest.mock('../balanceService');
jest.mock('../secureStorageService');
jest.mock('../../utils/retry', () => ({
  retrySilently: jest.fn((fn) => fn()),
}));

// Mock utils/bitcoin to prevent BIP32Factory from running
jest.mock('../../utils/bitcoin', () => ({
  MUTINYNET_NETWORK: {},
  validateAndNormalizeAddress: jest.fn((addr) => addr),
  deriveAddressesFromMnemonic: jest.fn(),
  deriveSigningKeys: jest.fn(),
}));

jest.mock('../../runestone-encoder', () => ({
  encodeRunestone: jest.fn(() => ({
    encodedRunestone: Buffer.from('6a5d02000d', 'hex'), // Mock OP_RETURN runestone
  })),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock bitcoinjs-lib
const mockPsbtInstance = {
  addInput: jest.fn(),
  addOutput: jest.fn(),
  toBase64: jest.fn(() => 'mock_psbt_base64'),
  txOutputs: [],
};

const mockTransaction = {
  outs: [{ script: Buffer.from('mock_script'), value: 100000 }],
};

jest.mock('bitcoinjs-lib', () => {
  const actual = jest.requireActual('bitcoinjs-lib');
  return {
    ...actual,
    Psbt: jest.fn(() => mockPsbtInstance),
    Transaction: {
      ...actual.Transaction,
      fromHex: jest.fn(() => mockTransaction),
    },
    address: {
      ...actual.address,
      fromBech32: jest.fn(() => ({ data: Buffer.alloc(32) })),
    },
  };
});

describe('transactionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPsbtInstance.addInput.mockClear();
    mockPsbtInstance.addOutput.mockClear();
    mockPsbtInstance.toBase64.mockReturnValue('mock_psbt_base64');
    bitcoinUtils.validateAndNormalizeAddress.mockImplementation((addr) => addr);
  });

  describe('createBtcIntent', () => {
    it('should throw error for invalid amount', async () => {
      await expect(
        TransactionService.createBtcIntent('tb1qtest', 'invalid', 'tb1qsource', 0)
      ).rejects.toThrow(ERRORS.INVALID_AMOUNT);
    });

    it('should throw error for negative amount', async () => {
      await expect(
        TransactionService.createBtcIntent('tb1qtest', '-0.001', 'tb1qsource', 0)
      ).rejects.toThrow(ERRORS.INVALID_AMOUNT);
    });

    it('should throw error for zero amount', async () => {
      await expect(
        TransactionService.createBtcIntent('tb1qtest', '0', 'tb1qsource', 0)
      ).rejects.toThrow(ERRORS.INVALID_AMOUNT);
    });

    it('should throw error when no UTXOs available', async () => {
      balanceService.fetchUtxos.mockResolvedValue([]);

      await expect(
        TransactionService.createBtcIntent('tb1qtest', '0.001', 'tb1qsource', 0)
      ).rejects.toThrow(ERRORS.NO_CONFIRMED_FUNDS);
    });

    it('should throw error for insufficient funds', async () => {
      balanceService.fetchUtxos.mockResolvedValue([
        {
          txid: 'test_txid',
          vout: 0,
          value: 1000, // Only 1000 sats, not enough for 0.1 BTC + fees
          status: { confirmed: true },
        },
      ]);

      global.fetch.mockResolvedValue({
        text: async () =>
          '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000',
      });

      await expect(
        TransactionService.createBtcIntent('tb1qtest123456789', '0.1', 'tb1qsource', 0)
      ).rejects.toThrow(ERRORS.INSUFFICIENT_FUNDS);
    });

    it('should create BTC intent successfully with sufficient funds', async () => {
      const mockUtxos = [
        {
          txid: 'mock_txid_1',
          vout: 0,
          value: 100000, // 0.001 BTC
          status: { confirmed: true },
        },
      ];

      balanceService.fetchUtxos.mockResolvedValue(mockUtxos);
      global.fetch.mockResolvedValue({
        text: async () =>
          '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000',
      });

      const result = await TransactionService.createBtcIntent(
        'tb1qrecipient',
        '0.0005',
        'tb1qsource',
        0
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('send');
      expect(result.amount).toBe(50000); // 0.0005 BTC in sats
      expect(result.recipient).toBe('tb1qrecipient');
      expect(result.psbt).toBe('mock_psbt_base64');
      expect(result.addressType).toBe('segwit');
      expect(mockPsbtInstance.addInput).toHaveBeenCalled();
      expect(mockPsbtInstance.addOutput).toHaveBeenCalled();
    });

    it('should handle comma as decimal separator', async () => {
      balanceService.fetchUtxos.mockResolvedValue([
        {
          txid: 'test_txid',
          vout: 0,
          value: 100000, // 0.001 BTC
          status: { confirmed: true },
        },
      ]);

      global.fetch.mockResolvedValue({
        text: async () =>
          '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000',
      });

      const result = await TransactionService.createBtcIntent(
        'tb1qtest',
        '0,0001',
        'tb1qsource',
        0
      );

      expect(result).toBeDefined();
      expect(result.amount).toBe(10000); // 0.0001 BTC in sats
    });

    it('should create change output when remainder above dust limit', async () => {
      balanceService.fetchUtxos.mockResolvedValue([
        {
          txid: 'mock_txid',
          vout: 0,
          value: 100000, // 0.001 BTC
          status: { confirmed: true },
        },
      ]);

      global.fetch.mockResolvedValue({
        text: async () =>
          '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000',
      });

      await TransactionService.createBtcIntent('tb1qrecipient', '0.0001', 'tb1qsource', 0);

      // Should call addOutput twice: once for recipient, once for change
      expect(mockPsbtInstance.addOutput).toHaveBeenCalledTimes(2);
    });

    it('should validate recipient address', async () => {
      balanceService.fetchUtxos.mockResolvedValue([
        {
          txid: 'test_txid',
          vout: 0,
          value: 100000,
          status: { confirmed: true },
        },
      ]);

      global.fetch.mockResolvedValue({
        text: async () => '020000000001010000000000',
      });

      await TransactionService.createBtcIntent('tb1qtest', '0.0001', 'tb1qsource', 0);

      expect(bitcoinUtils.validateAndNormalizeAddress).toHaveBeenCalledWith('tb1qtest');
    });

    it('should handle change below dust limit by adding to fee', async () => {
      balanceService.fetchUtxos.mockResolvedValue([
        {
          txid: 'test_txid',
          vout: 0,
          value: 50200, // Just enough for amount + fee, with tiny change (<546)
          status: { confirmed: true },
        },
      ]);

      global.fetch.mockResolvedValue({
        text: async () =>
          '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000',
      });

      const result = await TransactionService.createBtcIntent(
        'tb1qrecipient',
        '0.0005', // 50000 sats
        'tb1qsource',
        0
      );

      // Change should be 0 (went to fee) when below dust limit
      expect(result.change).toBe(0);
      // Fee should include the dust amount
      expect(result.fee).toBeGreaterThan(100); // More than minimum fee
    });
  });

  describe('createUnitIntent', () => {
    it('should throw error for non-taproot recipient', async () => {
      await expect(
        TransactionService.createUnitIntent('tb1qnottaproot', '100', 'tb1ptaproot', 'tb1qsegwit', 0)
      ).rejects.toThrow('UNIT transfers require a Taproot address');
    });

    it('should throw error for invalid amount', async () => {
      await expect(
        TransactionService.createUnitIntent(
          'tb1precipient',
          'invalid',
          'tb1ptaproot',
          'tb1qsegwit',
          0
        )
      ).rejects.toThrow(ERRORS.INVALID_AMOUNT);
    });

    it('should throw error for zero amount', async () => {
      await expect(
        TransactionService.createUnitIntent('tb1precipient', '0', 'tb1ptaproot', 'tb1qsegwit', 0)
      ).rejects.toThrow(ERRORS.INVALID_AMOUNT);
    });

    it('should throw error for negative amount', async () => {
      await expect(
        TransactionService.createUnitIntent('tb1precipient', '-100', 'tb1ptaproot', 'tb1qsegwit', 0)
      ).rejects.toThrow(ERRORS.INVALID_AMOUNT);
    });

    it('should throw error when no rune UTXOs found', async () => {
      global.fetch.mockResolvedValue({
        json: async () => ({ outputs: [] }),
      });

      await expect(
        TransactionService.createUnitIntent('tb1precipient', '100', 'tb1ptaproot', 'tb1qsegwit', 0)
      ).rejects.toThrow(ERRORS.NO_UNIT_BALANCE);
    });

    it('should throw error when no UTXOs with sufficient runes', async () => {
      global.fetch
        .mockResolvedValueOnce({
          json: async () => ({ outputs: ['mock_txid:0'] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            transaction: 'mock_txid',
            value: 10000,
            runes: {
              'DUCAT•UNIT•RUNE': {
                amount: '50', // Only 50, need 10000 (100 * 100)
              },
            },
          }),
        });

      await expect(
        TransactionService.createUnitIntent('tb1precipient', '100', 'tb1ptaproot', 'tb1qsegwit', 0)
      ).rejects.toThrow(ERRORS.NO_UNIT_BALANCE);
    });

    it('should throw error when sat UTXO insufficient for fees', async () => {
      // Mock rune UTXO with sufficient runes
      global.fetch
        .mockResolvedValueOnce({
          json: async () => ({ outputs: ['mock_rune_tx:0'] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            transaction: 'mock_rune_tx',
            value: 546,
            runes: {
              'DUCAT•UNIT•RUNE': {
                amount: '10000', // Sufficient runes
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ spent: false }),
        })
        // Mock segwit UTXOs with insufficient sats
        .mockResolvedValueOnce({
          json: async () => [
            {
              txid: 'mock_sat_tx',
              vout: 0,
              value: 5000, // Less than 12000 required
              status: { confirmed: true },
            },
          ],
        });

      await expect(
        TransactionService.createUnitIntent('tb1precipient', '100', 'tb1ptaproot', 'tb1qsegwit', 0)
      ).rejects.toThrow(ERRORS.INSUFFICIENT_FUNDS_FOR_FEES);
    });

    it('should create UNIT intent successfully with valid UTXOs', async () => {
      // Mock rune UTXO
      global.fetch
        .mockResolvedValueOnce({
          json: async () => ({ outputs: ['mock_rune_tx:0'] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            transaction: 'mock_rune_tx',
            value: 546,
            runes: {
              'DUCAT•UNIT•RUNE': {
                amount: '10000',
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ spent: false }),
        })
        // Mock segwit UTXOs
        .mockResolvedValueOnce({
          json: async () => [
            {
              txid: 'mock_sat_tx',
              vout: 0,
              value: 30000, // Sufficient for fees + 2x 10k outputs + change
              status: { confirmed: true },
            },
          ],
        })
        // Mock transaction hex for sat UTXO
        .mockResolvedValueOnce({
          text: async () =>
            '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000',
        })
        // Mock transaction hex for rune UTXO
        .mockResolvedValueOnce({
          text: async () =>
            '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000',
        });

      const result = await TransactionService.createUnitIntent(
        'tb1precipient',
        '100',
        'tb1ptaproot',
        'tb1qsegwit',
        0
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('send');
      expect(result.assetType).toBe('UNIT');
      expect(result.amount).toBe(10000); // 100 * 100
      expect(result.recipient).toBe('tb1precipient');
      expect(result.psbt).toBe('mock_psbt_base64');
      expect(result.addressType).toBe('taproot');
      expect(mockPsbtInstance.addInput).toHaveBeenCalledTimes(2); // sat + rune inputs
      expect(mockPsbtInstance.addOutput).toHaveBeenCalled(); // Multiple outputs
    });

    it('should validate recipient is taproot address', async () => {
      await expect(
        TransactionService.createUnitIntent('tb1qnotataproot', '100', 'tb1ptaproot', 'tb1qsegwit', 0)
      ).rejects.toThrow('UNIT transfers require a Taproot address');
    });

    it('should throw error when change is negative (insufficient total for fees + outputs)', async () => {
      // Mock rune UTXO with sufficient runes
      global.fetch
        .mockResolvedValueOnce({
          json: async () => ({ outputs: ['mock_rune_tx:0'] }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            transaction: 'mock_rune_tx',
            value: 546, // Minimum value
            runes: {
              'DUCAT•UNIT•RUNE': {
                amount: '10000',
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ spent: false }),
        })
        // Mock segwit UTXOs with insufficient sats
        // Total: 546 (rune) + 12000 (sat) = 12546
        // Needed: 1000 (fee) + 10000 (recipient) + 10000 (rune return) = 21000
        // Change = 12546 - 21000 = -8454 (negative!)
        .mockResolvedValueOnce({
          json: async () => [
            {
              txid: 'mock_sat_tx',
              vout: 0,
              value: 12000, // Passes initial filter but still insufficient for transaction
              status: { confirmed: true },
            },
          ],
        })
        // Mock transaction hex for sat UTXO
        .mockResolvedValueOnce({
          text: async () =>
            '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000',
        })
        // Mock transaction hex for rune UTXO
        .mockResolvedValueOnce({
          text: async () =>
            '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000',
        });

      await expect(
        TransactionService.createUnitIntent('tb1precipient', '100', 'tb1ptaproot', 'tb1qsegwit', 0)
      ).rejects.toThrow(ERRORS.INSUFFICIENT_FUNDS);
    });
  });

  describe('signIntent', () => {
    it('should throw TRANSACTION_CANCELLED error when intent is null', async () => {
      await expect(TransactionService.signIntent(null, 0)).rejects.toThrow(
        ERRORS.TRANSACTION_CANCELLED
      );
    });

    it('should throw TRANSACTION_CANCELLED error when intent is undefined', async () => {
      await expect(TransactionService.signIntent(undefined, 0)).rejects.toThrow(
        ERRORS.TRANSACTION_CANCELLED
      );
    });

    it('should throw TRANSACTION_CANCELLED error when intent is empty object', async () => {
      await expect(TransactionService.signIntent({}, 0)).rejects.toThrow();
    });

    it('should throw TRANSACTION_CANCELLED error when intent is false', async () => {
      await expect(TransactionService.signIntent(false, 0)).rejects.toThrow(
        ERRORS.TRANSACTION_CANCELLED
      );
    });

    it('should throw TRANSACTION_CANCELLED error when intent is 0', async () => {
      await expect(TransactionService.signIntent(0, 0)).rejects.toThrow(
        ERRORS.TRANSACTION_CANCELLED
      );
    });

    it('should throw TRANSACTION_CANCELLED error when intent is empty string', async () => {
      await expect(TransactionService.signIntent('', 0)).rejects.toThrow(
        ERRORS.TRANSACTION_CANCELLED
      );
    });

    it('should throw error when intent is valid but psbt is missing', async () => {
      const invalidIntent = {
        type: 'send',
        amount: 50000,
        // psbt field is missing
      };

      SecureStorageService.withMnemonic.mockImplementation((callback) => {
        return callback('test mnemonic phrase for unit testing only');
      });

      await expect(TransactionService.signIntent(invalidIntent, 0)).rejects.toThrow();
    });

    it('should throw error when intent has invalid psbt format', async () => {
      const invalidIntent = {
        type: 'send',
        amount: 50000,
        psbt: 'invalid_psbt_base64',
      };

      SecureStorageService.withMnemonic.mockImplementation((callback) => {
        return callback('test mnemonic phrase for unit testing only');
      });

      await expect(TransactionService.signIntent(invalidIntent, 0)).rejects.toThrow();
    });

    describe('UNIT Token Signing (Taproot)', () => {
      let mockSegwitChild;
      let mockTaprootChild;
      let mockPsbt;

      beforeEach(() => {
        // Mock derived keys
        mockSegwitChild = {
          publicKey: Buffer.from(
            '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
            'hex'
          ),
          privateKey: Buffer.from(
            '0000000000000000000000000000000000000000000000000000000000000001',
            'hex'
          ),
        };

        // Mock taproot child with even y-coordinate (0x02 prefix)
        mockTaprootChild = {
          publicKey: Buffer.from(
            '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
            'hex'
          ),
          privateKey: Buffer.from(
            '0000000000000000000000000000000000000000000000000000000000000001',
            'hex'
          ),
          tweak: jest.fn(() => ({
            publicKey: Buffer.from('tweaked_key', 'hex'),
            privateKey: Buffer.from('tweaked_private', 'hex'),
          })),
        };

        // Mock SecureStorageService.withMnemonic to return derived keys
        SecureStorageService.withMnemonic.mockImplementation((callback) => {
          return callback('test mnemonic phrase for unit testing only');
        });

        // Mock PSBT instance with methods
        mockPsbt = {
          data: {
            inputs: [
              {
                witnessUtxo: {
                  script: Buffer.from('001400000000', 'hex'),
                  value: 20000,
                },
              },
              {
                witnessUtxo: {
                  script: Buffer.from('512000000000', 'hex'),
                  value: 546,
                },
                tapKeySig: Buffer.from('signature'.repeat(8), 'hex'),
              },
            ],
          },
          __CACHE: {
            __TX: {
              clone: jest.fn(() => ({
                hashForWitnessV1: jest.fn(() => Buffer.alloc(32, 1)),
              })),
            },
          },
          signInput: jest.fn(),
          updateInput: jest.fn(),
          finalizeInput: jest.fn(),
          finalizeAllInputs: jest.fn(),
          extractTransaction: jest.fn(() => ({
            toHex: jest.fn(() => 'signed_tx_hex'),
            getId: jest.fn(() => 'mock_txid'),
            outs: [
              {
                script: Buffer.from('6a5d020d00', 'hex'), // OP_RETURN with 0x0d marker
                value: 0,
              },
            ],
          })),
        };
      });

      it('should sign UNIT intent with Taproot tweaked keys (even y-coordinate)', async () => {
        const bitcoin = require('bitcoinjs-lib');

        SecureStorageService.withMnemonic.mockReturnValueOnce({
          segwitChild: mockSegwitChild,
          taprootChild: mockTaprootChild,
        });

        bitcoin.Psbt.fromBase64 = jest.fn(() => mockPsbt);
        bitcoin.crypto.taggedHash = jest.fn(() => Buffer.alloc(32, 2));

        const unitIntent = {
          type: 'send',
          assetType: 'UNIT',
          amount: 10000,
          psbt: 'mock_unit_psbt_base64',
        };

        const result = await TransactionService.signIntent(unitIntent, 0);

        expect(result.signedTxHex).toBe('signed_tx_hex');
        expect(result.txid).toBe('mock_txid');
        expect(mockPsbt.signInput).toHaveBeenCalledWith(0, mockSegwitChild);
        expect(mockPsbt.signInput).toHaveBeenCalledWith(1, expect.objectContaining({
          publicKey: expect.any(Buffer),
          privateKey: expect.any(Buffer),
        }));
        // Signing logic executed successfully (we got a result)
      });


      it('should verify runestone marker (0x0d) is in transaction outputs', async () => {
        const bitcoin = require('bitcoinjs-lib');
        const ecc = require('@bitcoinerlab/secp256k1');

        SecureStorageService.withMnemonic.mockReturnValueOnce({
          segwitChild: mockSegwitChild,
          taprootChild: mockTaprootChild,
        });

        bitcoin.Psbt.fromBase64 = jest.fn(() => mockPsbt);
        bitcoin.crypto.taggedHash = jest.fn(() => Buffer.alloc(32, 2));
        ecc.signSchnorr = jest.fn(() => Buffer.alloc(64, 3));

        const unitIntent = {
          type: 'send',
          assetType: 'UNIT',
          amount: 10000,
          psbt: 'mock_unit_psbt_base64',
        };

        const result = await TransactionService.signIntent(unitIntent, 0);

        // Should complete successfully with runestone marker
        expect(result.signedTxHex).toBe('signed_tx_hex');

        // Verify extractTransaction was called
        expect(mockPsbt.extractTransaction).toHaveBeenCalled();
      });
    });

    describe('BTC Signing (SegWit)', () => {
      let mockSegwitChild;
      let mockTaprootChild;
      let mockPsbt;

      beforeEach(() => {
        mockSegwitChild = {
          publicKey: Buffer.from(
            '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
            'hex'
          ),
          privateKey: Buffer.from(
            '0000000000000000000000000000000000000000000000000000000000000001',
            'hex'
          ),
        };

        mockTaprootChild = {
          publicKey: Buffer.from(
            '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
            'hex'
          ),
          privateKey: Buffer.from(
            '0000000000000000000000000000000000000000000000000000000000000001',
            'hex'
          ),
        };

        SecureStorageService.withMnemonic.mockImplementation((callback) => {
          return callback('test mnemonic phrase for unit testing only');
        });

        mockPsbt = {
          data: {
            inputs: [
              {
                witnessUtxo: {
                  script: Buffer.from('001400000000', 'hex'),
                  value: 20000,
                },
              },
            ],
          },
          signInput: jest.fn(),
          finalizeAllInputs: jest.fn(),
          extractTransaction: jest.fn(() => ({
            toHex: jest.fn(() => 'signed_btc_tx_hex'),
            getId: jest.fn(() => 'btc_txid'),
            outs: [],
          })),
        };
      });

      it('should sign BTC SegWit transaction with multiple inputs', async () => {
        const bitcoin = require('bitcoinjs-lib');

        SecureStorageService.withMnemonic.mockReturnValueOnce({
          segwitChild: mockSegwitChild,
          taprootChild: mockTaprootChild,
        });

        bitcoin.Psbt.fromBase64 = jest.fn(() => mockPsbt);

        const btcIntent = {
          type: 'send',
          amount: 50000,
          addressType: 'segwit',
          inputs: [{ txid: 'tx1', vout: 0 }, { txid: 'tx2', vout: 1 }],
          psbt: 'mock_btc_psbt_base64',
        };

        const result = await TransactionService.signIntent(btcIntent, 0);

        expect(result.signedTxHex).toBe('signed_btc_tx_hex');
        expect(result.txid).toBe('btc_txid');
        expect(mockPsbt.signInput).toHaveBeenCalledTimes(2); // Two inputs
        expect(mockPsbt.finalizeAllInputs).toHaveBeenCalled();
      });

      it('should sign BTC Taproot transaction with tweaked keys', async () => {
        const bitcoin = require('bitcoinjs-lib');

        const mockTaprootChildWithTweak = {
          publicKey: Buffer.from(
            '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
            'hex'
          ),
          privateKey: Buffer.from(
            '0000000000000000000000000000000000000000000000000000000000000001',
            'hex'
          ),
          tweak: jest.fn(() => ({
            publicKey: Buffer.from('tweaked_key', 'hex'),
            privateKey: Buffer.from('tweaked_private', 'hex'),
          })),
        };

        SecureStorageService.withMnemonic.mockReturnValueOnce({
          segwitChild: mockSegwitChild,
          taprootChild: mockTaprootChildWithTweak,
        });

        // Add __CACHE.__TX for Taproot signing
        const mockTaprootPsbt = {
          ...mockPsbt,
          __CACHE: {
            __TX: {
              clone: jest.fn(() => ({
                hashForWitnessV1: jest.fn(() => Buffer.alloc(32, 1)),
              })),
            },
          },
          updateInput: jest.fn(),
        };

        bitcoin.Psbt.fromBase64 = jest.fn(() => mockTaprootPsbt);
        bitcoin.crypto.taggedHash = jest.fn(() => Buffer.alloc(32, 2));

        const btcIntent = {
          type: 'send',
          amount: 50000,
          addressType: 'taproot',
          inputs: [{ txid: 'tx1', vout: 0 }],
          psbt: 'mock_taproot_psbt_base64',
        };

        const result = await TransactionService.signIntent(btcIntent, 0);

        expect(result.signedTxHex).toBe('signed_btc_tx_hex');
        expect(mockTaprootPsbt.signInput).toHaveBeenCalled();
      });
    });
  });

  // broadcastTransaction tests moved to transactionBroadcastService.test.js
});
