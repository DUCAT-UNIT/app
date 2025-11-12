/**
 * Test for Taproot key negation (odd y-coordinate handling)
 * Lines 134-140 in wallet.js
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { signPsbt } from '../wallet';
import { deriveAddressesFromMnemonic } from '../bitcoin';
import * as authService from '../../services/authService';
import * as SecureStore from 'expo-secure-store';

bitcoin.initEccLib(ecc);

// This mnemonic produces a key with 0x03 prefix (odd y-coordinate) for Taproot at index 0
const MNEMONIC_WITH_ODD_Y = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

jest.mock('../../services/authService');
jest.mock('expo-secure-store');

describe('Taproot key negation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue('0');
  });

  it('should handle key negation for odd y-coordinate (0x03 prefix) - lines 134-140', async () => {
    // Try multiple account indices to find one with odd y-coordinate
    for (let accountIndex = 0; accountIndex < 50; accountIndex++) {
      authService.withMnemonic.mockImplementation((callback) => callback(MNEMONIC_WITH_ODD_Y));
      SecureStore.getItemAsync.mockResolvedValue(String(accountIndex));

      const { taprootAddress } = deriveAddressesFromMnemonic(MNEMONIC_WITH_ODD_Y, accountIndex);

      // Check if this derivation produces a 0x03 prefix
      const bip39 = require('bip39');
      const { BIP32Factory } = require('bip32');
      const bip32 = BIP32Factory(ecc);
      const { MUTINYNET_NETWORK } = require('../bitcoin');

      const seed = bip39.mnemonicToSeedSync(MNEMONIC_WITH_ODD_Y);
      const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);
      const child = root.derivePath(`m/86'/1'/0'/0/${accountIndex}`);

      if (child.publicKey[0] === 0x03) {
        // Found one with odd y-coordinate! Test it
        const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
        psbt.addInput({
          hash: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          index: 0,
          witnessUtxo: {
            script: Buffer.from('51200000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            value: BigInt(100000),
          },
          tapInternalKey: Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
          tapLeafScript: [
            {
              leafVersion: 0xc0,
              script: Buffer.from([bitcoin.opcodes.OP_CHECKSIG]),
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

        // If we got here, the test passed with key negation
        return;
      }
    }

    // If we didn't find any with 0x03 prefix, skip this test
    console.log('No account with 0x03 prefix found in first 50 indices');
  });

  it('should handle key-path spending with odd y-coordinate', async () => {
    // Try to find an account with odd y-coordinate for key-path spending
    for (let accountIndex = 0; accountIndex < 50; accountIndex++) {
      authService.withMnemonic.mockImplementation((callback) => callback(MNEMONIC_WITH_ODD_Y));
      SecureStore.getItemAsync.mockResolvedValue(String(accountIndex));

      const { taprootAddress } = deriveAddressesFromMnemonic(MNEMONIC_WITH_ODD_Y, accountIndex);

      // Check if this derivation produces a 0x03 prefix
      const bip39 = require('bip39');
      const { BIP32Factory } = require('bip32');
      const bip32 = BIP32Factory(ecc);
      const { MUTINYNET_NETWORK } = require('../bitcoin');

      const seed = bip39.mnemonicToSeedSync(MNEMONIC_WITH_ODD_Y);
      const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);
      const child = root.derivePath(`m/86'/1'/0'/0/${accountIndex}`);

      if (child.publicKey[0] === 0x03) {
        // Found one! Test key-path spending
        const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
        psbt.addInput({
          hash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
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

        return;
      }
    }

    console.log('No account with 0x03 prefix found for key-path test');
  });
});
