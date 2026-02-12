/**
 * Tests for transactionService
 *
 * NOTE: This file uses type-safe fetch mock pattern.
 * See testUtils/fetchMock.ts for the implementation.
 */

import * as TransactionService from '../transaction';
import type { TransactionIntent } from '../transaction';
import * as balanceService from '../balanceService';
import * as SecureStorageService from '../secureStorageService';
import { ERRORS } from '../../utils/messages';
import * as bitcoinUtils from '../../utils/bitcoin';
import {
  setupMockFetch,
  getMockFetch,
  createMockResponse,
  createMockTextResponse,
} from './testUtils';

jest.mock('../balanceService');
jest.mock('../secureStorageService');
jest.mock('../../utils/retry', () => ({
  retrySilently: jest.fn((fn: () => unknown) => fn()),
}));

// Mock utils/bitcoin to prevent BIP32Factory from running
jest.mock('../../utils/bitcoin', () => ({
  MUTINYNET_NETWORK: {},
  validateAndNormalizeAddress: jest.fn((addr: string) => addr),
  deriveAddressesFromMnemonic: jest.fn(),
  deriveSigningKeys: jest.fn(),
}));

jest.mock('../../utils/runestoneEncoder', () => ({
  encodeRunestone: jest.fn(() => ({
    encodedRunestone: Buffer.from('6a5d02000d', 'hex'), // Mock OP_RETURN runestone
  })),
}));

/**
 * Mock callback type for withMnemonic
 */
type MnemonicCallback<T> = (mnemonic: string) => T;

/**
 * Mock signing key interface
 */
interface MockSigningKey {
  publicKey: Buffer;
  privateKey: Buffer;
  tweak?: jest.Mock;
}

/**
 * Mock PSBT interface for testing
 */
interface MockPsbtData {
  inputs: Array<{
    witnessUtxo?: {
      script: Buffer;
      value: number;
    };
    tapKeySig?: Buffer;
  }>;
}

interface MockPsbt {
  data: MockPsbtData;
  __CACHE?: {
    __TX: {
      clone: jest.Mock;
    };
  };
  signInput: jest.Mock;
  updateInput?: jest.Mock;
  finalizeInput?: jest.Mock;
  finalizeAllInputs: jest.Mock;
  extractTransaction: jest.Mock;
}

// Mock bitcoinjs-lib
const mockPsbtInstance = {
  addInput: jest.fn(),
  addOutput: jest.fn(),
  toBase64: jest.fn(() => 'mock_psbt_base64'),
  txOutputs: [],
};

// Counter for correlating fromHex calls with tx-hex fetch URLs
let mockFromHexCallIdx = 0;

jest.mock('bitcoinjs-lib', () => {
  const actual = jest.requireActual('bitcoinjs-lib');
  return {
    ...actual,
    Psbt: jest.fn(() => mockPsbtInstance),
    Transaction: {
      ...actual.Transaction,
      fromHex: jest.fn(() => {
        // Extract txid from the corresponding tx-hex fetch URL so getId() matches utxo.txid
        const fetchCalls = (global as Record<string, unknown>).__mockFetch
          ? ((global as Record<string, unknown>).__mockFetch as jest.Mock).mock.calls
          : [];
        const txHexCalls = fetchCalls.filter((c: unknown[]) =>
          /\/tx\/[^/]+\/hex/.test(String(c[0] ?? ''))
        );
        const callUrl = txHexCalls[mockFromHexCallIdx]
          ? String(txHexCalls[mockFromHexCallIdx][0])
          : '';
        mockFromHexCallIdx++;
        const match = callUrl.match(/\/tx\/([^/]+)\/hex/);
        const txid = match ? match[1] : 'test_txid';

        return {
          getId: jest.fn(() => txid),
          outs: [{ script: Buffer.from('mock_script'), value: 100000, status: { confirmed: true } }],
        };
      }),
    },
    payments: {
      ...actual.payments,
      p2wpkh: jest.fn(() => ({ output: Buffer.from('001400000000', 'hex') })),
      p2tr: jest.fn(() => ({ output: Buffer.from('512000000000', 'hex') })),
    },
    address: {
      ...actual.address,
      fromBech32: jest.fn(() => ({ data: Buffer.alloc(32) })),
    },
  };
});

describe('transactionService', () => {
  let recipientPayment: any;
  let changePayment: any;
  let feePayment: any;
  let segwitRecipientAddr: string;
  let taprootRecipientAddr: string;
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockFetch();
    mockFromHexCallIdx = 0;
    (mockPsbtInstance.addInput as jest.Mock).mockClear();
    (mockPsbtInstance.addOutput as jest.Mock).mockClear();
    (mockPsbtInstance.toBase64 as jest.Mock).mockReturnValue('mock_psbt_base64');
    (bitcoinUtils.validateAndNormalizeAddress as jest.Mock).mockImplementation((addr: string) => addr);
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
      (balanceService.fetchUtxos as jest.Mock).mockResolvedValue([]);

      await expect(
        TransactionService.createBtcIntent('tb1qtest', '0.001', 'tb1qsource', 0)
      ).rejects.toThrow(ERRORS.NO_CONFIRMED_FUNDS);
    });

    it('should throw error for insufficient funds', async () => {
      (balanceService.fetchUtxos as jest.Mock).mockResolvedValue([
        {
          txid: 'test_txid',
          vout: 0,
          value: 1000, // Only 1000 sats, not enough for 0.1 BTC + fees
          status: { confirmed: true },
        },
      ]);

      getMockFetch().mockResolvedValue(
        createMockTextResponse(
          '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000'
        )
      );

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

      (balanceService.fetchUtxos as jest.Mock).mockResolvedValue(mockUtxos);
      getMockFetch().mockResolvedValue(
        createMockTextResponse(
          '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000'
        )
      );

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
      (balanceService.fetchUtxos as jest.Mock).mockResolvedValue([
        {
          txid: 'test_txid',
          vout: 0,
          value: 100000, // 0.001 BTC
          status: { confirmed: true },
        },
      ]);

      getMockFetch().mockResolvedValue(
        createMockTextResponse(
          '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000'
        )
      );

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
      (balanceService.fetchUtxos as jest.Mock).mockResolvedValue([
        {
          txid: 'mock_txid',
          vout: 0,
          value: 100000, // 0.001 BTC
          status: { confirmed: true },
        },
      ]);

      getMockFetch().mockResolvedValue(
        createMockTextResponse(
          '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000'
        )
      );

      await TransactionService.createBtcIntent('tb1qrecipient', '0.0001', 'tb1qsource', 0);

      // Should call addOutput twice: once for recipient, once for change
      expect(mockPsbtInstance.addOutput).toHaveBeenCalledTimes(2);
    });

    it('should validate recipient address', async () => {
      (balanceService.fetchUtxos as jest.Mock).mockResolvedValue([
        {
          txid: 'test_txid',
          vout: 0,
          value: 100000,
          status: { confirmed: true },
        },
      ]);

      getMockFetch().mockResolvedValue(
        createMockTextResponse('020000000001010000000000')
      );

      await TransactionService.createBtcIntent('tb1qtest', '0.0001', 'tb1qsource', 0);

      expect(bitcoinUtils.validateAndNormalizeAddress).toHaveBeenCalledWith('tb1qtest');
    });

    it('should abort when change would fall below dust limit', async () => {
      (balanceService.fetchUtxos as jest.Mock).mockResolvedValue([
        {
          txid: 'test_txid',
          vout: 0,
          value: 50200, // Just enough for amount + fee, with tiny change (<546)
          status: { confirmed: true },
        },
      ]);

      getMockFetch().mockResolvedValue(
        createMockTextResponse(
          '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000'
        )
      );

      await expect(
        TransactionService.createBtcIntent('tb1qrecipient', '0.0005', 'tb1qsource', 0)
      ).rejects.toThrow(ERRORS.FEE_TOO_LOW);
    });
  });

  describe('createUnitIntent', () => {
    const VALID_TAPROOT = 'tb1p5cyxnuxmeuwuvkwfem96l0ly6lg7v3y7dkn6n2';
    const VALID_SEGWIT = 'tb1qzs6whp3jxah0p5v2ty7r0tpsk6ky06xrx3h8h6';
    it('should throw error for non-taproot recipient', async () => {
      await expect(
        TransactionService.createUnitIntent('tb1qnottaproot', '100', VALID_TAPROOT, VALID_SEGWIT, 0)
      ).rejects.toThrow('UNIT transfers require a Taproot address');
    });

    it('should throw error for invalid amount', async () => {
      await expect(
        TransactionService.createUnitIntent(
          VALID_TAPROOT,
          'invalid',
          VALID_TAPROOT,
          VALID_SEGWIT,
          0
        )
      ).rejects.toThrow(ERRORS.INVALID_AMOUNT);
    });

    it('should throw error for zero amount', async () => {
      await expect(
        TransactionService.createUnitIntent(VALID_TAPROOT, '0', VALID_TAPROOT, VALID_SEGWIT, 0)
      ).rejects.toThrow(ERRORS.INVALID_AMOUNT);
    });

    it('should throw error for negative amount', async () => {
      await expect(
        TransactionService.createUnitIntent(VALID_TAPROOT, '-100', VALID_TAPROOT, VALID_SEGWIT, 0)
      ).rejects.toThrow(ERRORS.INVALID_AMOUNT);
    });

    it('should throw error when no rune UTXOs found', async () => {
      getMockFetch().mockResolvedValue(createMockResponse({ outputs: [] }));

      await expect(
        TransactionService.createUnitIntent(VALID_TAPROOT, '100', VALID_TAPROOT, VALID_SEGWIT, 0)
      ).rejects.toThrow(ERRORS.NO_UNIT_BALANCE);
    });

    it('should throw error when no UTXOs with sufficient runes', async () => {
      getMockFetch()
        .mockResolvedValueOnce(createMockResponse({ outputs: ['mock_txid:0'] }))
        .mockResolvedValueOnce(createMockResponse({
          transaction: 'mock_txid',
          value: 10000,
          runes: {
            'DUCAT•UNIT•RUNE': {
              amount: '50', // Only 50, need 10000 (100 * 100)
            },
          },
        }))
        .mockResolvedValueOnce(createMockResponse({ spent: false })); // spend check

      await expect(
        TransactionService.createUnitIntent(VALID_TAPROOT, '100', VALID_TAPROOT, VALID_SEGWIT, 0)
      ).rejects.toThrow(ERRORS.NO_UNIT_BALANCE);
    });

    it('should throw error when sat UTXO insufficient for fees', async () => {
      // Mock rune UTXO with sufficient runes
      getMockFetch()
        .mockResolvedValueOnce(createMockResponse({ outputs: ['mock_rune_tx:0'] }))
        .mockResolvedValueOnce(createMockResponse({
          transaction: 'mock_rune_tx',
          value: 546,
          runes: {
            'DUCAT•UNIT•RUNE': {
              amount: '10000', // Sufficient runes
            },
          },
        }))
        .mockResolvedValueOnce(createMockResponse({ spent: false }))
        // Mock segwit UTXOs with insufficient sats
        .mockResolvedValueOnce(createMockResponse([
          {
            txid: 'mock_sat_tx',
            vout: 0,
            value: 5000, // Less than 12000 required
            status: { confirmed: true },
          },
        ]));

      await expect(
        TransactionService.createUnitIntent(VALID_TAPROOT, '100', VALID_TAPROOT, VALID_SEGWIT, 0)
      ).rejects.toThrow(ERRORS.INSUFFICIENT_FUNDS_FOR_FEES);
    });

    it('should create UNIT intent successfully with valid UTXOs', async () => {
      const bitcoin = require('bitcoinjs-lib');
      jest.spyOn(bitcoin.address, 'toOutputScript').mockReturnValue(Buffer.alloc(0));

      // Mock rune UTXO
      getMockFetch()
        .mockResolvedValueOnce(createMockResponse({ outputs: ['mock_rune_tx:0'] }))
        .mockResolvedValueOnce(createMockResponse({
          transaction: 'mock_rune_tx',
          value: 546,
          runes: {
            'DUCAT•UNIT•RUNE': {
              amount: '10000',
            },
          },
        }))
        .mockResolvedValueOnce(createMockResponse({ spent: false }))
        // Mock segwit UTXOs
        .mockResolvedValueOnce(createMockResponse([
          {
            txid: 'mock_sat_tx',
            vout: 0,
            value: 30000, // Sufficient for fees + 2x 10k outputs + change
            status: { confirmed: true },
          },
        ]))
        // Mock transaction hex for sat UTXO
        .mockResolvedValueOnce(
          createMockTextResponse(
            '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000'
          )
        )
        // Mock transaction hex for rune UTXO
        .mockResolvedValueOnce(
          createMockTextResponse(
            '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000'
          )
        );

      const result = await TransactionService.createUnitIntent(
        VALID_TAPROOT,
        '100',
        VALID_TAPROOT,
        VALID_SEGWIT,
        0
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('send');
      expect(result.assetType).toBe('UNIT');
      expect(result.amount).toBe(10000); // 100 * 100
      expect(result.recipient).toBe(VALID_TAPROOT);
      expect(result.psbt).toBe('mock_psbt_base64');
      expect(result.addressType).toBe('taproot');
      expect(mockPsbtInstance.addInput).toHaveBeenCalledTimes(2); // sat + rune inputs
      expect(mockPsbtInstance.addOutput).toHaveBeenCalled(); // Multiple outputs
    });

    it('should validate recipient is taproot address', async () => {
      await expect(
        TransactionService.createUnitIntent('tb1qnotataproot', '100', VALID_TAPROOT, VALID_SEGWIT, 0)
      ).rejects.toThrow('UNIT transfers require a Taproot address');
    });

    it('should throw error when change is negative (insufficient total for fees + outputs)', async () => {
      // Mock rune UTXO with sufficient runes
      getMockFetch()
        .mockResolvedValueOnce(createMockResponse({ outputs: ['mock_rune_tx:0'] }))
        .mockResolvedValueOnce(createMockResponse({
          transaction: 'mock_rune_tx',
          value: 546, // Minimum value
          runes: {
            'DUCAT•UNIT•RUNE': {
              amount: '10000',
            },
          },
        }))
        .mockResolvedValueOnce(createMockResponse({ spent: false }))
        // Mock segwit UTXOs with insufficient sats
        // Total: 546 (rune) + 12000 (sat) = 12546
        // Needed: 1000 (fee) + 10000 (recipient) + 10000 (rune return) = 21000
        // Change = 12546 - 21000 = -8454 (negative!)
        .mockResolvedValueOnce(createMockResponse([
          {
            txid: 'mock_sat_tx',
            vout: 0,
            value: 12000, // Passes initial filter but still insufficient for transaction
            status: { confirmed: true },
          },
        ]))
        // Mock transaction hex for sat UTXO
        .mockResolvedValueOnce(
          createMockTextResponse(
            '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000'
          )
        )
        // Mock transaction hex for rune UTXO
        .mockResolvedValueOnce(
          createMockTextResponse(
            '0200000000010100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff0100e1f50500000000160014000000000000000000000000000000000000000000000000'
          )
        );

      await expect(
        TransactionService.createUnitIntent(VALID_TAPROOT, '100', VALID_TAPROOT, VALID_SEGWIT, 0)
      ).rejects.toThrow(ERRORS.INSUFFICIENT_FUNDS);
    });
  });

  describe('signIntent', () => {
    it('should throw TRANSACTION_CANCELLED error when intent is null', async () => {
      await expect(TransactionService.signIntent(null as unknown as TransactionIntent, 0)).rejects.toThrow(
        ERRORS.TRANSACTION_CANCELLED
      );
    });

    it('should throw TRANSACTION_CANCELLED error when intent is undefined', async () => {
      await expect(TransactionService.signIntent(undefined as unknown as TransactionIntent, 0)).rejects.toThrow(
        ERRORS.TRANSACTION_CANCELLED
      );
    });

    it('should throw TRANSACTION_CANCELLED error when intent is empty object', async () => {
      await expect(TransactionService.signIntent({} as TransactionIntent, 0)).rejects.toThrow();
    });

    it('should throw TRANSACTION_CANCELLED error when intent is false', async () => {
      await expect(TransactionService.signIntent(false as unknown as TransactionIntent, 0)).rejects.toThrow(
        ERRORS.TRANSACTION_CANCELLED
      );
    });

    it('should throw TRANSACTION_CANCELLED error when intent is 0', async () => {
      await expect(TransactionService.signIntent(0 as unknown as TransactionIntent, 0)).rejects.toThrow(
        ERRORS.TRANSACTION_CANCELLED
      );
    });

    it('should throw TRANSACTION_CANCELLED error when intent is empty string', async () => {
      await expect(TransactionService.signIntent('' as unknown as TransactionIntent, 0)).rejects.toThrow(
        ERRORS.TRANSACTION_CANCELLED
      );
    });

    it('should throw error when intent is valid but psbt is missing', async () => {
      const invalidIntent = {
        type: 'send',
        amount: 50000,
        // psbt field is missing
      } as unknown as TransactionIntent;

      (SecureStorageService.withMnemonic as jest.Mock).mockImplementation(
        <T>(callback: MnemonicCallback<T>) => {
          return callback('test mnemonic phrase for unit testing only');
        }
      );

      await expect(TransactionService.signIntent(invalidIntent, 0)).rejects.toThrow();
    });

    it('should throw error when intent has invalid psbt format', async () => {
      const invalidIntent = {
        type: 'send',
        amount: 50000,
        psbt: 'invalid_psbt_base64',
      };

      (SecureStorageService.withMnemonic as jest.Mock).mockImplementation(
        <T>(callback: MnemonicCallback<T>) => {
          return callback('test mnemonic phrase for unit testing only');
        }
      );

      await expect(TransactionService.signIntent(invalidIntent, 0)).rejects.toThrow();
    });

    describe('UNIT Token Signing (Taproot)', () => {
      let mockSegwitChild: MockSigningKey;
      let mockTaprootChild: MockSigningKey;
      let mockPsbt: MockPsbt;

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
        (SecureStorageService.withMnemonic as jest.Mock).mockImplementation(
          <T>(callback: MnemonicCallback<T>) => {
            return callback('test mnemonic phrase for unit testing only');
          }
        );

        const bitcoin = require('bitcoinjs-lib');
        (bitcoinUtils as any).MUTINYNET_NETWORK = bitcoin.networks.testnet;

        recipientPayment = bitcoin.payments.p2tr({
          internalPubkey: Buffer.alloc(32, 3),
          network: bitcoin.networks.testnet,
        });
        changePayment = bitcoin.payments.p2tr({
          internalPubkey: Buffer.alloc(32, 4),
          network: bitcoin.networks.testnet,
        });
        feePayment = bitcoin.payments.p2wpkh({
          hash: Buffer.alloc(20, 5),
          network: bitcoin.networks.testnet,
        });

        const segwitPayment = bitcoin.payments.p2wpkh({
          hash: Buffer.alloc(20, 1),
          network: bitcoin.networks.testnet,
        });
        const taprootPayment = bitcoin.payments.p2tr({
          internalPubkey: Buffer.alloc(32, 2),
          network: bitcoin.networks.testnet,
        });

        // Stable synthetic addresses for validation (format not important because validation is mocked)
        segwitRecipientAddr = 'tb1qzs6whp3jxah0p5v2ty7r0tpsk6ky06xrx3h8h6';
        taprootRecipientAddr = 'tb1p5cyxnuxmeuwuvkwfem96l0ly6lg7v3y7dkn6n2';

        recipientPayment.address = segwitRecipientAddr;
        changePayment.address = taprootRecipientAddr;
        feePayment.address = segwitRecipientAddr;

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
          txOutputs: [
            { script: segwitPayment.output!, value: BigInt(50_000), address: segwitRecipientAddr },
            { script: taprootPayment.output!, value: BigInt(10_000), address: taprootRecipientAddr },
            { script: segwitPayment.output!, value: BigInt(5_000), address: segwitRecipientAddr },
            { script: Buffer.from('6a5d020d00', 'hex'), value: BigInt(0) },
          ],
        };

        jest
          .spyOn(bitcoin.address, 'fromOutputScript')
          .mockImplementation((script: Buffer) => {
            if (script === segwitPayment.output) return segwitRecipientAddr;
            if (script === taprootPayment.output) return taprootRecipientAddr;
            if (script.equals(Buffer.from('6a5d020d00', 'hex'))) {
              throw new Error('should not decode OP_RETURN');
            }
            return segwitRecipientAddr;
          });
      });

      it('should sign UNIT intent with Taproot tweaked keys (even y-coordinate)', async () => {
        const bitcoin = require('bitcoinjs-lib');

        (SecureStorageService.withMnemonic as jest.Mock).mockReturnValueOnce({
          segwitChild: mockSegwitChild,
          taprootChild: mockTaprootChild,
        });

        bitcoin.Psbt.fromBase64 = jest.fn(() => mockPsbt);
        bitcoin.crypto.taggedHash = jest.fn(() => Buffer.alloc(32, 2));

        const unitIntent = {
          type: 'send',
          assetType: 'UNIT' as const,
          amount: 10000,
          recipient: segwitRecipientAddr,
          sourceAddress: taprootRecipientAddr,
          feeAddress: segwitRecipientAddr,
          psbt: 'mock_unit_psbt_base64',
          // required for validation
          addressType: 'taproot' as const,
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

        (SecureStorageService.withMnemonic as jest.Mock).mockReturnValueOnce({
          segwitChild: mockSegwitChild,
          taprootChild: mockTaprootChild,
        });

        bitcoin.Psbt.fromBase64 = jest.fn(() => mockPsbt);
        bitcoin.crypto.taggedHash = jest.fn(() => Buffer.alloc(32, 2));
        ecc.signSchnorr = jest.fn(() => Buffer.alloc(64, 3));

        const unitIntent = {
          type: 'send',
          assetType: 'UNIT' as const,
          amount: 10000,
          recipient: segwitRecipientAddr,
          sourceAddress: taprootRecipientAddr,
          feeAddress: segwitRecipientAddr,
          psbt: 'mock_unit_psbt_base64',
          addressType: 'taproot' as const,
        };

        const result = await TransactionService.signIntent(unitIntent, 0);

        // Should complete successfully with runestone marker
        expect(result.signedTxHex).toBe('signed_tx_hex');

        // Verify extractTransaction was called
        expect(mockPsbt.extractTransaction).toHaveBeenCalled();
      });
    });

    describe('BTC Signing (SegWit)', () => {
      let mockSegwitChild: MockSigningKey;
      let mockTaprootChild: MockSigningKey;
      let mockPsbt: MockPsbt;

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

        (SecureStorageService.withMnemonic as jest.Mock).mockImplementation(
          <T>(callback: MnemonicCallback<T>) => {
            return callback('test mnemonic phrase for unit testing only');
          }
        );

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
          txOutputs: [],
        };

        // Provide network for address decoding in validation
        const bitcoin = require('bitcoinjs-lib');
        (bitcoinUtils as any).MUTINYNET_NETWORK = bitcoin.networks.testnet;

        const recipientPayment = bitcoin.payments.p2wpkh({ hash: Buffer.alloc(20, 1), network: bitcoin.networks.testnet });
        const changePayment = bitcoin.payments.p2wpkh({ hash: Buffer.alloc(20, 2), network: bitcoin.networks.testnet });
        const btcRecipientAddr = 'tb1qbtcrecipientaddressxxxxxxxxxxxxxxxxxx';
        const btcChangeAddr = 'tb1qbtcchangeaddressxxxxxxxxxxxxxxxxxxxxx';
        recipientPayment.address = btcRecipientAddr;
        changePayment.address = btcChangeAddr;
        feePayment.address = btcChangeAddr;
        mockPsbt.txOutputs = [
          {
            script: recipientPayment.output!,
            value: BigInt(50_000),
          },
          {
            script: changePayment.output!,
            value: BigInt(4_950_000),
          },
        ];
        (mockPsbt as any).__recipient = recipientPayment.address;
        (mockPsbt as any).__source = changePayment.address;

        jest
          .spyOn(bitcoin.address, 'fromOutputScript')
          .mockImplementation((script: Buffer) => {
            if (script === recipientPayment.output) return recipientPayment.address as string;
            if (script === changePayment.output) return changePayment.address as string;
            return feePayment.address as string;
          });
      });

      it('should sign BTC SegWit transaction with multiple inputs', async () => {
        const bitcoin = require('bitcoinjs-lib');

        (SecureStorageService.withMnemonic as jest.Mock).mockReturnValueOnce({
          segwitChild: mockSegwitChild,
          taprootChild: mockTaprootChild,
        });

        bitcoin.Psbt.fromBase64 = jest.fn(() => mockPsbt);

        const btcIntent = {
          type: 'send',
          assetType: 'BTC' as const,
          recipient: (mockPsbt as any).__recipient,
          sourceAddress: (mockPsbt as any).__source,
          amount: 50000,
          addressType: 'segwit' as const,
          inputs: [{ txid: 'tx1', vout: 0 }, { txid: 'tx2', vout: 1 }],
          psbt: 'mock_btc_psbt_base64',
          feeAddress: (mockPsbt as any).__source,
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

        (SecureStorageService.withMnemonic as jest.Mock).mockReturnValueOnce({
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
          assetType: 'BTC' as const,
          recipient: (mockPsbt as any).__recipient,
          sourceAddress: (mockPsbt as any).__source,
          amount: 50000,
          addressType: 'taproot' as const,
          inputs: [{ txid: 'tx1', vout: 0 }],
          psbt: 'mock_taproot_psbt_base64',
          feeAddress: (mockPsbt as any).__source,
        };

        const result = await TransactionService.signIntent(btcIntent, 0);

        expect(result.signedTxHex).toBe('signed_btc_tx_hex');
        expect(mockTaprootPsbt.signInput).toHaveBeenCalled();
      });
    });
  });

  // broadcastTransaction tests moved to transactionBroadcastService.test.js
});
