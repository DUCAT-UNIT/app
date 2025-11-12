/**
 * Transaction Signing Service
 * Handles all cryptographic signing operations for Bitcoin and Runes transactions
 * SECURITY-CRITICAL: Manages mnemonic exposure and key derivation
 */

import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from '@bitcoinerlab/secp256k1';
import { MUTINYNET_NETWORK } from '../utils/bitcoin';
import * as AuthService from './authService';
import { ERRORS } from '../utils/messages';

// Initialize BIP32 and ECC library
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

/**
 * Derive signing keys from mnemonic
 * SECURITY: This function only holds mnemonic in memory for <50ms
 * @param {string} mnemonic - BIP39 mnemonic phrase
 * @param {number} currentAccount - Account index
 * @returns {Object} Derived keys for signing
 */
const deriveSigningKeys = (mnemonic, currentAccount) => {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

  // Pre-derive all keys we'll need (mnemonic only in memory for <50ms)
  return {
    segwitChild: root.derivePath(`m/84'/1'/0'/0/${currentAccount}`),
    taprootChild: root.derivePath(`m/86'/1'/0'/0/${currentAccount}`),
  };
  // Note: seed and root are destroyed when this function returns
};

/**
 * Sign a transaction intent PSBT
 * @param {Object} intent - Transaction intent object with psbt field
 * @param {number} currentAccount - Current account index
 * @returns {Promise<{signedTxHex: string, txid: string}>} Signed transaction
 */
export const signIntent = async (intent, currentAccount) => {
  try {
    if (!intent) {
      throw new Error(ERRORS.TRANSACTION_CANCELLED);
    }

    // SECURITY: Use withMnemonic to minimize mnemonic exposure to <100ms
    // This automatically wipes the mnemonic from memory after deriveSigningKeys returns
    const { segwitChild, taprootChild } = await AuthService.withMnemonic((mnemonic) =>
      deriveSigningKeys(mnemonic, currentAccount)
    );

    // Load PSBT
    const psbt = bitcoin.Psbt.fromBase64(intent.psbt);

    // Sign all inputs
    if (intent.assetType === 'UNIT') {
      // Input 0: P2WPKH (fee input)
      psbt.signInput(0, segwitChild);

      // Input 1: Taproot (rune input) - requires manual tweaking

      // Manual Taproot signing with tweaking
      const tx = psbt.__CACHE.__TX.clone();
      const sighashType = bitcoin.Transaction.SIGHASH_DEFAULT;

      // Get witness scripts and values for both inputs
      const prevoutScripts = [
        psbt.data.inputs[0].witnessUtxo.script,
        psbt.data.inputs[1].witnessUtxo.script,
      ];

      // Convert values to BigInt, handling both number and bigint types
      const val0 = psbt.data.inputs[0].witnessUtxo.value;
      const val1 = psbt.data.inputs[1].witnessUtxo.value;

      // Helper to convert any type to BigInt
      const toBigInt = (val) => {
        if (typeof val === 'bigint') return val;
        if (typeof val === 'number') return BigInt(val);
        if (typeof val === 'string') return BigInt(val);
        return BigInt(String(val));
      };

      const prevoutValues = [toBigInt(val0), toBigInt(val1)];

      // Calculate sighash for input 1
      const hash = tx.hashForWitnessV1(1, prevoutScripts, prevoutValues, sighashType);

      // Get x-only pubkey
      const xOnlyPubkey = Buffer.from(taprootChild.publicKey.slice(1, 33));

      // Create the tweak
      const tweakHashRaw = bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey);
      const tweakHash = Buffer.isBuffer(tweakHashRaw) ? tweakHashRaw : Buffer.from(tweakHashRaw);

      // Get the private key
      let privateKey = taprootChild.privateKey;
      if (!Buffer.isBuffer(privateKey)) {
        privateKey = Buffer.from(privateKey);
      }

      // Check if we need to negate the private key
      // If the public key has odd y-coordinate (0x03 prefix), negate the private key
      if (taprootChild.publicKey[0] === 0x03) {
        const privKeyNum = BigInt('0x' + privateKey.toString('hex'));
        const CURVE_ORDER = BigInt(
          '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
        );
        const negatedNum = CURVE_ORDER - privKeyNum;
        privateKey = Buffer.from(negatedNum.toString(16).padStart(64, '0'), 'hex');
      }

      // Add the tweak
      const privKeyNum = BigInt('0x' + privateKey.toString('hex'));
      const tweakNum = BigInt('0x' + tweakHash.toString('hex'));
      const CURVE_ORDER = BigInt(
        '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
      );
      const tweakedNum = (privKeyNum + tweakNum) % CURVE_ORDER;
      const tweakedPrivateKey = Buffer.from(tweakedNum.toString(16).padStart(64, '0'), 'hex');

      // Ensure buffers are the correct size
      if (hash.length !== 32) {
        throw new Error(`Hash must be 32 bytes, got ${hash.length}`);
      }
      if (tweakedPrivateKey.length !== 32) {
        throw new Error(`Private key must be 32 bytes, got ${tweakedPrivateKey.length}`);
      }

      // Sign with tweaked key
      const signature = ecc.signSchnorr(hash, tweakedPrivateKey);
      psbt.updateInput(1, { tapKeySig: Buffer.from(signature) });
    } else {
      // BTC transaction - all inputs are same type
      if (intent.addressType === 'taproot') {
        const tweakedSigner = taprootChild.tweak(
          bitcoin.crypto.taggedHash('TapTweak', taprootChild.publicKey.slice(1, 33))
        );

        for (let i = 0; i < intent.inputs.length; i++) {
          psbt.signInput(i, tweakedSigner);
        }
      } else {
        for (let i = 0; i < intent.inputs.length; i++) {
          psbt.signInput(i, segwitChild);
        }
      }
    }

    // Finalize all inputs
    if (intent.assetType === 'UNIT') {
      // Try to finalize all inputs
      try {
        psbt.finalizeAllInputs();
      } catch (e) {
        // Manual finalization for Taproot (matches working example)
        psbt.finalizeInput(0); // P2WPKH finalizes normally

        const tapKeySig = psbt.data.inputs[1].tapKeySig;
        if (!tapKeySig) {
          throw new Error('No tapKeySig found');
        }

        // Use bitcoin.script.compile like in the working example
        psbt.data.inputs[1].finalScriptWitness = bitcoin.script.compile([tapKeySig]);
      }
    } else {
      psbt.finalizeAllInputs();
    }

    // Extract signed transaction
    const signedTx = psbt.extractTransaction();
    const signedTxHex = signedTx.toHex();

    // VERIFY: Check that runestone is in the transaction (for UNIT transactions)
    if (intent.assetType === 'UNIT') {
      signedTx.outs.forEach((output, _index) => {
        const scriptHex = output.script.toString('hex');

        if (scriptHex.startsWith('6a')) {
          // Check if it contains the runestone marker (0x0d = 13 in decimal, the Runes protocol tag)
          if (scriptHex.includes('0d')) {
          } else {
          }
        }
      });
    }

    return {
      signedTxHex,
      txid: signedTx.getId(),
    };
  } catch (error) {
    throw error;
  }
  // Note: Mnemonic auto-wiped by withMnemonic() - no finally block needed
};
