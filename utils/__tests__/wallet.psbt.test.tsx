// @ts-nocheck
/**
 * Comprehensive tests for Wallet PSBT signing
 * Tests the core wallet functionality - PSBT signing for SegWit and Taproot
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { signPsbt, signMessage } from '../wallet';
import { deriveAddressesFromMnemonic } from '../bitcoin';
import * as secureStorageService from '../../services/secureStorageService';
import * as SecureStore from 'expo-secure-store';

// Initialize ECC library
bitcoin.initEccLib(ecc);

// Test mnemonic
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Mock authService
jest.mock('../../services/secureStorageService', () => ({
  withMnemonic: jest.fn((callback) => callback(TEST_MNEMONIC)),
}));

// Mock SecureStore
jest.mock('expo-secure-store');

describe('wallet PSBT signing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue('0'); // Default account index
  });

  describe('signPsbt - SegWit (P2WPKH)', () => {
    it('should sign a basic SegWit PSBT', async () => {
      const { segwitAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

      // Create proper scriptPubKey for the segwit address
      const payment = bitcoin.payments.p2wpkh({
        address: segwitAddress,
        network: bitcoin.networks.testnet,
      });

      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
        witnessUtxo: {
          script: payment.output,
          value: BigInt(100000),
        },
      });

      psbt.addOutput({
        address: segwitAddress,
        value: BigInt(50000),
      });

      const psbtBase64 = psbt.toBase64();
      const signedPsbtBase64 = await signPsbt(psbtBase64, {
        [segwitAddress]: [0],
      });

      expect(signedPsbtBase64).not.toBe(psbtBase64);
      expect(signedPsbtBase64).toMatch(/^[A-Za-z0-9+/=]+$/);

      const signedPsbt = bitcoin.Psbt.fromBase64(signedPsbtBase64);
      expect(signedPsbt).toBeDefined();
    });

    it('should handle multiple SegWit inputs', async () => {
      const { segwitAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

      const payment = bitcoin.payments.p2wpkh({
        address: segwitAddress,
        network: bitcoin.networks.testnet,
      });

      // Add 3 inputs
      for (let i = 0; i < 3; i++) {
        psbt.addInput({
          hash: i.toString(16).padStart(64, '0'),
          index: i,
          witnessUtxo: {
            script: payment.output,
            value: BigInt(100000),
          },
        });
      }

      psbt.addOutput({
        address: segwitAddress,
        value: BigInt(250000),
      });

      const signedPsbtBase64 = await signPsbt(psbt.toBase64(), {
        [segwitAddress]: [0, 1, 2],
      });

      expect(signedPsbtBase64).toBeDefined();

      const signedPsbt = bitcoin.Psbt.fromBase64(signedPsbtBase64);
      expect(signedPsbt.data.inputs).toHaveLength(3);
    });

    it('should use account index from SecureStore', async () => {
      SecureStore.getItemAsync.mockResolvedValue('5');

      const { segwitAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 5);
      const payment = bitcoin.payments.p2wpkh({
        address: segwitAddress,
        network: bitcoin.networks.testnet,
      });

      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
        witnessUtxo: {
          script: payment.output,
          value: BigInt(100000),
        },
      });

      psbt.addOutput({
        address: segwitAddress,
        value: BigInt(50000),
      });

      await signPsbt(psbt.toBase64(), {
        [segwitAddress]: [0],
      });

      expect(SecureStore.getItemAsync).toHaveBeenCalled();
    });

    it('should default to account 0 if SecureStore fails', async () => {
      SecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

      const { segwitAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const payment = bitcoin.payments.p2wpkh({
        address: segwitAddress,
        network: bitcoin.networks.testnet,
      });
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
        witnessUtxo: {
          script: payment.output,
          value: BigInt(100000),
        },
      });

      psbt.addOutput({
        address: segwitAddress,
        value: BigInt(50000),
      });

      const result = await signPsbt(psbt.toBase64(), {
        [segwitAddress]: [0],
      });

      expect(result).toBeDefined();
    });
  });

  describe('signPsbt - Taproot (P2TR) key-path', () => {
    it('should sign a Taproot key-path PSBT', async () => {
      const { taprootAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
        witnessUtxo: {
          script: Buffer.from('51200000000000000000000000000000000000000000000000000000000000000000', 'hex'),
          value: BigInt(100000),
        },
        tapInternalKey: Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
      });

      psbt.addOutput({
        address: taprootAddress,
        value: BigInt(50000),
      });

      const signedPsbtBase64 = await signPsbt(psbt.toBase64(), {
        [taprootAddress]: [0],
      });

      expect(signedPsbtBase64).toBeDefined();
      expect(signedPsbtBase64).toMatch(/^[A-Za-z0-9+/=]+$/);

      const signedPsbt = bitcoin.Psbt.fromBase64(signedPsbtBase64);
      expect(signedPsbt.data.inputs[0].tapKeySig).toBeDefined();
    });

    it('should handle multiple Taproot inputs', async () => {
      const { taprootAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

      for (let i = 0; i < 2; i++) {
        psbt.addInput({
          hash: i.toString(16).padStart(64, '0'),
          index: i,
          witnessUtxo: {
            script: Buffer.from('51200000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            value: BigInt(100000),
          },
          tapInternalKey: Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        });
      }

      psbt.addOutput({
        address: taprootAddress,
        value: BigInt(150000),
      });

      const signedPsbtBase64 = await signPsbt(psbt.toBase64(), {
        [taprootAddress]: [0, 1],
      });

      const signedPsbt = bitcoin.Psbt.fromBase64(signedPsbtBase64);
      expect(signedPsbt.data.inputs[0].tapKeySig).toBeDefined();
      expect(signedPsbt.data.inputs[1].tapKeySig).toBeDefined();
    });
  });

  describe('signPsbt - Taproot (P2TR) script-path', () => {
    it('should sign a Taproot script-path PSBT', async () => {
      const { taprootAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

      const script = bitcoin.script.compile([
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        bitcoin.opcodes.OP_CHECKSIG,
      ]);

      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
        witnessUtxo: {
          script: Buffer.from('51200000000000000000000000000000000000000000000000000000000000000000', 'hex'),
          value: BigInt(100000),
        },
        tapInternalKey: Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        tapLeafScript: [
          {
            leafVersion: 0xc0,
            script: script,
            controlBlock: Buffer.from('c00000000000000000000000000000000000000000000000000000000000000000', 'hex'),
          },
        ],
      });

      psbt.addOutput({
        address: taprootAddress,
        value: BigInt(50000),
      });

      const signedPsbtBase64 = await signPsbt(psbt.toBase64(), {
        [taprootAddress]: [0],
      });

      const signedPsbt = bitcoin.Psbt.fromBase64(signedPsbtBase64);
      expect(signedPsbt.data.inputs[0].tapScriptSig).toBeDefined();
      expect(signedPsbt.data.inputs[0].tapScriptSig.length).toBeGreaterThan(0);
    });
  });

  describe('signPsbt - error handling', () => {
    it('should throw for unsupported address type', async () => {
      const { segwitAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const payment = bitcoin.payments.p2wpkh({
        address: segwitAddress,
        network: bitcoin.networks.testnet,
      });

      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
        witnessUtxo: {
          script: payment.output,
          value: BigInt(100000),
        },
      });

      psbt.addOutput({
        address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        value: BigInt(50000),
      });

      await expect(
        signPsbt(psbt.toBase64(), {
          '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa': [0],
        })
      ).rejects.toThrow('Unsupported address type');
    });

    it('should throw for invalid PSBT base64', async () => {
      await expect(
        signPsbt('invalid-base64!!!', {
          'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx': [0],
        })
      ).rejects.toThrow();
    });

    it('should handle withMnemonic failures', async () => {
      secureStorageService.withMnemonic.mockImplementationOnce(() => {
        throw new Error('Mnemonic not available');
      });

      const { segwitAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const payment = bitcoin.payments.p2wpkh({
        address: segwitAddress,
        network: bitcoin.networks.testnet,
      });

      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
        witnessUtxo: {
          script: payment.output,
          value: BigInt(100000),
        },
      });
      psbt.addOutput({
        address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        value: BigInt(50000),
      });

      await expect(
        signPsbt(psbt.toBase64(), {
          'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx': [0],
        })
      ).rejects.toThrow();
    });
  });

  describe('signPsbt - integration', () => {
    it('should produce valid base64 signatures', async () => {
      const { segwitAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const payment = bitcoin.payments.p2wpkh({
        address: segwitAddress,
        network: bitcoin.networks.testnet,
      });
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

      psbt.addInput({
        hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        index: 0,
        witnessUtxo: {
          script: payment.output,
          value: BigInt(100000),
        },
      });

      psbt.addOutput({
        address: segwitAddress,
        value: BigInt(90000),
      });

      const signedPsbtBase64 = await signPsbt(psbt.toBase64(), {
        [segwitAddress]: [0],
      });

      // Should be valid base64 - parse it
      const buffer = Buffer.from(signedPsbtBase64, 'base64');
      expect(buffer).toBeDefined();

      // Should parse as valid PSBT
      const signedPsbt = bitcoin.Psbt.fromBase64(signedPsbtBase64);
      expect(signedPsbt).toBeDefined();
    });

    it('should call withMnemonic for secure access', async () => {
      const { segwitAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const payment = bitcoin.payments.p2wpkh({
        address: segwitAddress,
        network: bitcoin.networks.testnet,
      });
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
        witnessUtxo: {
          script: payment.output,
          value: BigInt(100000),
        },
      });

      psbt.addOutput({
        address: segwitAddress,
        value: BigInt(50000),
      });

      await signPsbt(psbt.toBase64(), {
        [segwitAddress]: [0],
      });

      expect(secureStorageService.withMnemonic).toHaveBeenCalled();
    });

    it('should handle mixed SegWit and Taproot inputs', async () => {
      const { segwitAddress, taprootAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const payment = bitcoin.payments.p2wpkh({
        address: segwitAddress,
        network: bitcoin.networks.testnet,
      });
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

      // Add SegWit input
      psbt.addInput({
        hash: '1111111111111111111111111111111111111111111111111111111111111111',
        index: 0,
        witnessUtxo: {
          script: payment.output,
          value: BigInt(100000),
        },
      });

      // Add Taproot input
      psbt.addInput({
        hash: '2222222222222222222222222222222222222222222222222222222222222222',
        index: 1,
        witnessUtxo: {
          script: Buffer.from('51200000000000000000000000000000000000000000000000000000000000000000', 'hex'),
          value: BigInt(100000),
        },
        tapInternalKey: Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
      });

      psbt.addOutput({
        address: segwitAddress,
        value: BigInt(150000),
      });

      const signedPsbtBase64 = await signPsbt(psbt.toBase64(), {
        [segwitAddress]: [0],
        [taprootAddress]: [1],
      });

      const signedPsbt = bitcoin.Psbt.fromBase64(signedPsbtBase64);
      expect(signedPsbt.data.inputs).toHaveLength(2);
    });
  });
});
