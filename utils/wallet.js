/**
 * Wallet utilities - PSBT signing and message signing
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import ECPairFactory from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from './constants';
import { MUTINYNET_NETWORK } from './bitcoin';
import { withMnemonic } from '../services/authService';

// Initialize BIP32
const bip32 = BIP32Factory(ecc);

// Lazy initialization of ECPair (needs Buffer global)
let ECPair = null;
function getECPair() {
  if (!ECPair) {
    ECPair = ECPairFactory(ecc);
  }
  return ECPair;
}

/**
 * Convert witness stack to script witness format
 * Properly serializes witness elements with compact size prefixes
 */
function _witnessToScriptWitness(witness) {
  const buffer = Buffer.allocUnsafe(getWitnessSize(witness));
  let offset = 0;

  // Write witness stack count
  offset = writeVarInt(buffer, witness.length, offset);

  // Write each witness element
  for (const item of witness) {
    // Convert to Buffer if needed
    const itemBuffer = Buffer.isBuffer(item) ? item : Buffer.from(item);
    offset = writeVarInt(buffer, itemBuffer.length, offset);
    itemBuffer.copy(buffer, offset);
    offset += itemBuffer.length;
  }

  return buffer;
}

/**
 * Calculate total size needed for witness serialization
 */
function getWitnessSize(witness) {
  let size = varIntSize(witness.length);
  for (const item of witness) {
    size += varIntSize(item.length) + item.length;
  }
  return size;
}

/**
 * Write a variable-length integer (varint)
 */
function writeVarInt(buffer, value, offset) {
  if (value < 0xfd) {
    buffer.writeUInt8(value, offset);
    return offset + 1;
  } else if (value <= 0xffff) {
    buffer.writeUInt8(0xfd, offset);
    buffer.writeUInt16LE(value, offset + 1);
    return offset + 3;
  } else if (value <= 0xffffffff) {
    buffer.writeUInt8(0xfe, offset);
    buffer.writeUInt32LE(value, offset + 1);
    return offset + 5;
  } else {
    buffer.writeUInt8(0xff, offset);
    buffer.writeUInt32LE(value & 0xffffffff, offset + 1);
    buffer.writeUInt32LE(Math.floor(value / 0x100000000), offset + 5);
    return offset + 9;
  }
}

/**
 * Get the size of a varint encoding
 */
function varIntSize(value) {
  if (value < 0xfd) return 1;
  if (value <= 0xffff) return 3;
  if (value <= 0xffffffff) return 5;
  return 9;
}

/**
 * Sign a PSBT with the mobile wallet
 * @param {string} psbtBase64 - PSBT in base64 format
 * @param {Object} signInputs - Map of addresses to input indices to sign
 * @returns {Promise<string>} Signed PSBT in base64 format
 */
export async function signPsbt(psbtBase64, signInputs) {
  // Try to get current account index from storage, default to 0
  let accountIndex = 0;
  try {
    const storedAccount = await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    if (storedAccount) {
      accountIndex = parseInt(storedAccount, 10);
    }
  } catch (error) {}

  // Use withMnemonic to ensure proper cleanup of sensitive data
  return await withMnemonic(async (mnemonic) => {
    // Convert mnemonic to seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    // Parse PSBT from base64
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

    // Derive keys and sign inputs
    for (const [address, inputIndices] of Object.entries(signInputs)) {
      // Determine which derivation path to use based on address type
      let derivationPath;
      let keyPair;

      const ECPairInstance = getECPair();

      if (address.startsWith('tb1q')) {
        // P2WPKH (SegWit) - BIP84
        derivationPath = `m/84'/1'/0'/0/${accountIndex}`;
        const child = root.derivePath(derivationPath);
        keyPair = ECPairInstance.fromPrivateKey(child.privateKey, { network: MUTINYNET_NETWORK });
      } else if (address.startsWith('tb1p')) {
        // P2TR (Taproot) - BIP86
        derivationPath = `m/86'/1'/0'/0/${accountIndex}`;
        const child = root.derivePath(derivationPath);

        // Log the pubkeys for debugging
        const compressedPubkey = child.publicKey;
        const _xOnlyPubkey = compressedPubkey.slice(1, 33);

        // For Taproot, DON'T tweak the signer - bitcoinjs-lib will handle tweaking
        // when it sees tapInternalKey in the PSBT input
        // Just use the child node directly
        keyPair = child;
      } else {
        throw new Error(`Unsupported address type: ${address}`);
      }

      // Sign each input
      for (const inputIndex of inputIndices) {
        try {
          // Use different signing methods based on address type
          if (address.startsWith('tb1p')) {
            // Taproot: Check if this is script-path or key-path spending
            const input = psbt.data.inputs[inputIndex];
            const isScriptPath = !!(input.tapLeafScript && input.tapLeafScript.length > 0);

            // Ensure privateKey is a Buffer
            let privateKey = keyPair.privateKey;
            if (!Buffer.isBuffer(privateKey)) {
              privateKey = Buffer.from(privateKey);
            }

            // Check if we need to negate the private key (if y-coordinate is odd)
            if (keyPair.publicKey[0] === 0x03) {
              const privKeyHex = privateKey.toString('hex');
              const privKeyNum = BigInt('0x' + privKeyHex);
              const CURVE_ORDER = BigInt(
                '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
              );
              const negatedNum = CURVE_ORDER - privKeyNum;
              privateKey = Buffer.from(negatedNum.toString(16).padStart(64, '0'), 'hex');
            }

            if (isScriptPath) {
              // SCRIPT-PATH spending (for deposits)

              const tapLeafScript = input.tapLeafScript[0];

              // Compute the tapleaf hash
              const leafVersion = tapLeafScript.leafVersion;
              const script = tapLeafScript.script;

              // Encode script length as compact size varint
              const scriptLengthVarint = Buffer.allocUnsafe(varIntSize(script.length));
              writeVarInt(scriptLengthVarint, script.length, 0);

              const tapleafHash = bitcoin.crypto.taggedHash(
                'TapLeaf',
                Buffer.concat([Buffer.from([leafVersion]), scriptLengthVarint, script])
              );

              // Get the sighash for script-path spending
              const sighash = input.sighashType || 0x00; // SIGHASH_DEFAULT
              const hash = psbt.__CACHE.__TX.hashForWitnessV1(
                inputIndex,
                psbt.data.inputs.map((i) => i.witnessUtxo.script),
                psbt.data.inputs.map((i) => i.witnessUtxo.value),
                sighash,
                tapleafHash
              );

              // Sign with UNTWEAKED private key for script-path
              const signature = ecc.signSchnorr(hash, privateKey);
              const signatureBuffer = Buffer.from(signature);

              // Extract x-only pubkey for tapScriptSig
              const _xOnlyPubkey = keyPair.publicKey.slice(1, 33);

              // For Taproot script-path spending, we need to set tapScriptSig (NOT finalScriptWitness)
              // tapScriptSig is an array of {pubkey, leafHash, signature} objects
              const tapScriptSig = [
                {
                  pubkey: xOnlyPubkey,
                  leafHash: tapleafHash,
                  signature: signatureBuffer,
                },
              ];

              // Update the PSBT with tapScriptSig (not finalized yet)
              psbt.updateInput(inputIndex, {
                tapScriptSig,
              });
            } else {
              // KEY-PATH spending (for regular transfers)

              // Get the sighash for key-path spending
              const sighash = input.sighashType || 0x00; // SIGHASH_DEFAULT
              const hash = psbt.__CACHE.__TX.hashForWitnessV1(
                inputIndex,
                psbt.data.inputs.map((i) => i.witnessUtxo.script),
                psbt.data.inputs.map((i) => i.witnessUtxo.value),
                sighash
              );

              // Get the private key and tweak it for key-path
              const _xOnlyPubkey = keyPair.publicKey.slice(1, 33);
              const tweakHash = bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey);

              // Add the tweak
              const privKeyHex = privateKey.toString('hex');
              const tweakHashHex = Buffer.from(tweakHash).toString('hex');
              const privKeyNum = BigInt('0x' + privKeyHex);
              const tweakNum = BigInt('0x' + tweakHashHex);
              const CURVE_ORDER = BigInt(
                '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
              );
              const tweakedNum = (privKeyNum + tweakNum) % CURVE_ORDER;
              const tweakedPrivateKey = Buffer.from(
                tweakedNum.toString(16).padStart(64, '0'),
                'hex'
              );

              // Sign with Schnorr
              const signature = ecc.signSchnorr(hash, tweakedPrivateKey);
              const signatureBuffer = Buffer.from(signature);

              // Update the PSBT with tapKeySig
              psbt.updateInput(inputIndex, {
                tapKeySig: signatureBuffer,
              });
            }
          } else {
            psbt.signInput(inputIndex, keyPair);

            // Finalize the SegWit input immediately after signing
            try {
              psbt.finalizeInput(inputIndex);
            } catch (error) {}
          }
        } catch (error) {
          throw error;
        }
      }
    }

    // Don't finalize - let the SDK handle that
    // Just return the signed PSBT
    const signedPsbtBase64 = psbt.toBase64();

    return signedPsbtBase64;
  });
}

/**
 * Sign a message with the wallet
 * @param {string} address - Address to sign with
 * @param {string} message - Message to sign
 * @returns {Promise<string>} Signature
 */
export async function signMessage(address, message) {
  // Get current account index
  const accountIndex = 0;

  // Use withMnemonic to ensure proper cleanup of sensitive data
  return await withMnemonic(async (mnemonic) => {
    // Convert mnemonic to seed
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    // Determine derivation path based on address type
    let derivationPath;
    if (address.startsWith('tb1q')) {
      derivationPath = `m/84'/1'/0'/0/${accountIndex}`;
    } else if (address.startsWith('tb1p')) {
      derivationPath = `m/86'/1'/0'/0/${accountIndex}`;
    } else {
      throw new Error(`Unsupported address type: ${address}`);
    }

    const child = root.derivePath(derivationPath);
    const ECPairInstance = getECPair();
    const keyPair = ECPairInstance.fromPrivateKey(child.privateKey, { network: MUTINYNET_NETWORK });

    // Sign message
    const messageHash = bitcoin.crypto.sha256(Buffer.from(message, 'utf8'));
    const signature = keyPair.sign(messageHash);

    return signature.toString('hex');
  });
}
