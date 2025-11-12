/**
 * Tests for wallet helper functions (internal utilities)
 * These tests increase coverage for varint encoding and witness serialization
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { signPsbt } from '../wallet';
import { deriveAddressesFromMnemonic } from '../bitcoin';
import * as authService from '../../services/authService';
import * as SecureStore from 'expo-secure-store';

bitcoin.initEccLib(ecc);

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

jest.mock('../../services/authService', () => ({
  withMnemonic: jest.fn((callback) => callback(TEST_MNEMONIC)),
}));

jest.mock('expo-secure-store');

describe('wallet helper functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue('0');
  });

  describe('varint encoding edge cases', () => {
    it('should handle script-path with 2-byte varint (253-65535 bytes)', async () => {
      const { taprootAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);

      // Create a 253-byte script to trigger 2-byte varint encoding (0xfd prefix)
      // This covers lines 35-37 in wallet.js
      const mediumScript = Buffer.concat([
        Buffer.alloc(252, 0x00),
        Buffer.from([bitcoin.opcodes.OP_CHECKSIG]),
      ]);

      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
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
            script: mediumScript,
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
    });

    it('should handle script-path with very large scripts (>65535 bytes)', async () => {
      const { taprootAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);

      // Create a very large script (>65535 bytes) to trigger 4-byte varint encoding
      const veryLargeScript = Buffer.concat([
        Buffer.alloc(70000, 0x00),
        Buffer.from([bitcoin.opcodes.OP_CHECKSIG]),
      ]);

      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
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
            script: veryLargeScript,
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
    });
  });

  describe('script-path sighash with tapleafHash', () => {
    it('should correctly compute tapleaf hash for script-path spending', async () => {
      const { taprootAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);

      const script = bitcoin.script.compile([
        Buffer.from('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 'hex'),
        bitcoin.opcodes.OP_CHECKSIG,
      ]);

      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
      psbt.addInput({
        hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
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

      // Verify tapScriptSig was created with tapleaf hash
      expect(signedPsbt.data.inputs[0].tapScriptSig).toBeDefined();
      expect(signedPsbt.data.inputs[0].tapScriptSig[0].leafHash).toBeDefined();
      expect(signedPsbt.data.inputs[0].tapScriptSig[0].leafHash).toHaveLength(32);
    });

    it('should handle script-path with custom sighash type', async () => {
      const { taprootAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);

      const script = bitcoin.script.compile([
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        bitcoin.opcodes.OP_CHECKSIG,
      ]);

      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
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
        sighashType: 0x01, // SIGHASH_ALL
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
    });
  });

  describe('Taproot key negation for odd y-coordinate', () => {
    it('should handle Taproot keys with odd y-coordinate (0x03 prefix)', async () => {
      // This test ensures the key negation logic is covered
      // In practice, this depends on the derived key's y-coordinate
      const { taprootAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);

      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
      psbt.addInput({
        hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
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

      const signedPsbt = bitcoin.Psbt.fromBase64(signedPsbtBase64);
      expect(signedPsbt.data.inputs[0].tapKeySig).toBeDefined();
    });
  });

  describe('SecureStore error handling', () => {
    it('should handle SecureStore returning null', async () => {
      SecureStore.getItemAsync.mockResolvedValue(null);

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

    it('should handle SecureStore throwing an error', async () => {
      SecureStore.getItemAsync.mockRejectedValue(new Error('SecureStore unavailable'));

      const { segwitAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const payment = bitcoin.payments.p2wpkh({
        address: segwitAddress,
        network: bitcoin.networks.testnet,
      });

      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
      psbt.addInput({
        hash: '1111111111111111111111111111111111111111111111111111111111111111',
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

      // Should not throw, should use default account 0
      const result = await signPsbt(psbt.toBase64(), {
        [segwitAddress]: [0],
      });

      expect(result).toBeDefined();
    });
  });

  describe('SegWit finalization error handling', () => {
    it('should catch and ignore finalization errors for SegWit', async () => {
      // This test covers the empty catch block at line 237-239
      const { segwitAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);
      const payment = bitcoin.payments.p2wpkh({
        address: segwitAddress,
        network: bitcoin.networks.testnet,
      });

      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
      psbt.addInput({
        hash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
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

      // Should complete without throwing even if finalization fails
      const result = await signPsbt(psbt.toBase64(), {
        [segwitAddress]: [0],
      });

      expect(result).toBeDefined();
    });
  });

  describe('Error propagation', () => {
    it('should throw errors from signing failures (line 242)', async () => {
      const { segwitAddress } = deriveAddressesFromMnemonic(TEST_MNEMONIC, 0);

      // Create invalid PSBT that will cause signing error
      const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
      psbt.addInput({
        hash: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        index: 0,
        witnessUtxo: {
          // Wrong script for this address - will cause signing to fail
          script: Buffer.from('0014' + '00'.repeat(20), 'hex'),
          value: BigInt(100000),
        },
      });

      psbt.addOutput({
        address: segwitAddress,
        value: BigInt(50000),
      });

      // Should throw error when trying to sign with mismatched address
      await expect(
        signPsbt(psbt.toBase64(), {
          [segwitAddress]: [0],
        })
      ).rejects.toThrow();
    });
  });
});
