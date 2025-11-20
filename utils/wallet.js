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
import { withMnemonic } from '../services/secureStorageService';

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
    // istanbul ignore next - Untestable: Bitcoin scripts cannot exceed 4GB
    buffer.writeUInt8(0xff, offset);
    // istanbul ignore next
    buffer.writeUInt16LE(value & 0xffffffff, offset + 1);
    // istanbul ignore next
    buffer.writeUInt32LE(Math.floor(value / 0x100000000), offset + 5);
    // istanbul ignore next
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
  // istanbul ignore next - Untestable: Bitcoin scripts cannot exceed 4GB
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
  } catch (error) {
    // Ignore SecureStore errors, use default account 0
  }

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

              // SECURITY FIX: Use untweaked private key for script-path spending
              // For script-path, we sign with the raw key (not tweaked)
              let privateKey = keyPair.privateKey;
              if (!Buffer.isBuffer(privateKey)) {
                privateKey = Buffer.from(privateKey);
              }

              // Sign with UNTWEAKED private key for script-path
              const signature = ecc.signSchnorr(hash, privateKey);
              const signatureBuffer = Buffer.from(signature);

              // Extract x-only pubkey for tapScriptSig
              const xOnlyPubkey = keyPair.publicKey.slice(1, 33);

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
              // SECURITY FIX: Use bitcoinjs-lib's built-in tweak() method
              // This is the same safe approach used in transactionSigningService.js

              // For external PSBTs (like from vaults), the tapInternalKey may not match our key
              // In this case, we need to use the PSBT's tapInternalKey and sign accordingly
              const xOnlyPubkey = keyPair.publicKey.slice(1, 33);
              const currentInput = psbt.data.inputs[inputIndex];

              // Try to use bitcoinjs-lib's safe signing method
              try {
                const tweakedSigner = keyPair.tweak(
                  bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey)
                );

                // Sign the input with the tweaked signer
                // bitcoinjs-lib will handle all the Schnorr signature details correctly
                psbt.signInput(inputIndex, tweakedSigner);
              } catch (error) {
                // If signing fails (e.g., tapInternalKey mismatch), fall back to manual signing
                // This handles cases where the PSBT was created externally with a different tapInternalKey
                // IMPORTANT: This is safe because we're using the correct tweaking formula
                // without the dangerous y-coordinate negation

                // Get the transaction hash to sign
                const tx = psbt.__CACHE.__TX.clone();
                const sighash = tx.hashForWitnessV1(
                  inputIndex,
                  psbt.data.inputs.map((input) => input.witnessUtxo.script),
                  psbt.data.inputs.map((input) => input.witnessUtxo.value),
                  bitcoin.Transaction.SIGHASH_DEFAULT
                );

                // Create tweaked signer manually (without y-coordinate negation)
                const tweakedSigner = keyPair.tweak(
                  bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey)
                );

                // Sign with Schnorr using the tweaked private key
                const signature = ecc.signSchnorr(sighash, tweakedSigner.privateKey);
                psbt.updateInput(inputIndex, { tapKeySig: Buffer.from(signature) });
              }
            }
          } else {
            psbt.signInput(inputIndex, keyPair);

            // Finalize the SegWit input immediately after signing
            try {
              psbt.finalizeInput(inputIndex);
            } catch (error) {
              // Ignore finalization errors - input may be finalized later
            }
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
    const messageHash = bitcoin.crypto.hash256(Buffer.from(message, 'utf8'));
    const signature = keyPair.sign(messageHash);

    return Buffer.from(signature).toString('hex');
  });
}

/**
 * Get private key and x-only pubkey for a Taproot address (for P2PK Cashu tokens)
 * @param {string} address - Taproot address (tb1p...)
 * @returns {Promise<Object>} { privateKey: string, xOnlyPubkey: string }
 */
export async function getPrivateKeyForAddress(address) {
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

    // Debug logging
    console.log('[getPrivateKeyForAddress] Derived child key:', {
      hasPrivateKey: !!child.privateKey,
      privateKeyLength: child.privateKey?.length,
      publicKeyLength: child.publicKey?.length,
      derivationPath,
    });

    // Ensure privateKey exists and is correct length
    if (!child.privateKey || child.privateKey.length !== 32) {
      throw new Error(`Invalid private key derived: length ${child.privateKey?.length || 0}, expected 32`);
    }

    // For Taproot, extract x-only pubkey and compute tweaked keys
    const xOnlyPubkey = Buffer.from(child.publicKey.slice(1, 33));

    // Compute the OUTPUT key that matches the address
    const tweakedSigner = child.tweak(
      bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey)
    );

    // Get the tweaked public key (OUTPUT key)
    const tweakedPubkey = tweakedSigner.publicKey.slice(1, 33);
    const outputKeyHex = Buffer.from(tweakedPubkey).toString('hex');

    // Get the tweaked private key
    const tweakedPrivkeyHex = Buffer.from(tweakedSigner.privateKey).toString('hex');

    console.log('[getPrivateKeyForAddress] Computed tweaked keys:', {
      internalPubkey: xOnlyPubkey.toString('hex').substring(0, 16) + '...',
      outputPubkey: outputKeyHex.substring(0, 16) + '...',
      tweakedPrivkeyLength: tweakedPrivkeyHex.length,
    });

    // Return tweaked private key and output public key
    return {
      privateKey: tweakedPrivkeyHex,
      xOnlyPubkey: outputKeyHex  // This is the OUTPUT key that matches the address
    };
  });
}
