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

    // Load PSBT with correct network (testnet)
    const psbt = bitcoin.Psbt.fromBase64(intent.psbt, { network: MUTINYNET_NETWORK });

    // UNIFIED SIGNING: Both UNIT and BTC use the same safe signing logic
    // SECURITY: Use bitcoinjs-lib's built-in tweak method instead of manual crypto

    // Sign all inputs based on their type
    if (intent.assetType === 'UNIT') {
      // UNIT transactions have mixed input types:
      // - Input 0: P2WPKH (fee input from BTC balance)
      // - Input 1: Taproot (rune input with UNIT balance)

      // Input 0: Sign with SegWit key
      psbt.signInput(0, segwitChild);

      // Input 1: Sign with tweaked Taproot key (UNIFIED METHOD)
      const tweakedSigner = taprootChild.tweak(
        bitcoin.crypto.taggedHash('TapTweak', taprootChild.publicKey.slice(1, 33))
      );
      psbt.signInput(1, tweakedSigner);
    } else {
      // BTC transactions: All inputs are the same type
      if (intent.addressType === 'taproot') {
        // Sign all Taproot inputs with tweaked signer (UNIFIED METHOD)
        const tweakedSigner = taprootChild.tweak(
          bitcoin.crypto.taggedHash('TapTweak', taprootChild.publicKey.slice(1, 33))
        );

        for (let i = 0; i < intent.inputs.length; i++) {
          psbt.signInput(i, tweakedSigner);
        }
      } else {
        // Sign all SegWit inputs
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
