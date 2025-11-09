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
function witnessToScriptWitness(witness) {
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
  console.log('[signPsbt] Signing PSBT with inputs:', signInputs);

  // Get mnemonic from secure storage
  const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
  if (!mnemonic) {
    throw new Error('No mnemonic found in secure storage');
  }

  // Try to get current account index from storage, default to 0
  let accountIndex = 0;
  try {
    const storedAccount = await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    if (storedAccount) {
      accountIndex = parseInt(storedAccount, 10);
      console.log(`[signPsbt] Using stored account index: ${accountIndex}`);
    }
  } catch (error) {
    console.log('[signPsbt] Could not get account index, using 0:', error);
  }

  // Convert mnemonic to seed
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

  // Parse PSBT from base64
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

  // Derive keys and sign inputs
  for (const [address, inputIndices] of Object.entries(signInputs)) {
    console.log(`[signPsbt] Signing inputs for address ${address}:`, inputIndices);

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
      const xOnlyPubkey = compressedPubkey.slice(1, 33);
      console.log(`[signPsbt] Taproot derived pubkey (compressed):`, compressedPubkey.toString('hex'));
      console.log(`[signPsbt] Taproot derived pubkey (x-only):`, xOnlyPubkey.toString('hex'));

      // For Taproot, DON'T tweak the signer - bitcoinjs-lib will handle tweaking
      // when it sees tapInternalKey in the PSBT input
      // Just use the child node directly
      keyPair = child;
    } else {
      throw new Error(`Unsupported address type: ${address}`);
    }

    console.log(`[signPsbt] Using derivation path: ${derivationPath}`);

    // Sign each input
    for (const inputIndex of inputIndices) {
      console.log(`[signPsbt] Signing input ${inputIndex} for address ${address}`);
      console.log(`[signPsbt] Address type check: startsWith('tb1p') = ${address.startsWith('tb1p')}`);

      try {
        // Log PSBT input state before signing
        const inputBefore = psbt.data.inputs[inputIndex];
        console.log(`[signPsbt] Input ${inputIndex} before signing:`, {
          hasTapInternalKey: !!inputBefore.tapInternalKey,
          hasWitnessUtxo: !!inputBefore.witnessUtxo,
          tapInternalKeyHex: inputBefore.tapInternalKey?.toString('hex'),
        });

        // Use different signing methods based on address type
        if (address.startsWith('tb1p')) {
          // Taproot: Check if this is script-path or key-path spending
          const input = psbt.data.inputs[inputIndex];
          const isScriptPath = !!(input.tapLeafScript && input.tapLeafScript.length > 0);

          console.log(`[signPsbt] Taproot signing - isScriptPath: ${isScriptPath}`);

          // Ensure privateKey is a Buffer
          let privateKey = keyPair.privateKey;
          if (!Buffer.isBuffer(privateKey)) {
            privateKey = Buffer.from(privateKey);
          }

          // Check if we need to negate the private key (if y-coordinate is odd)
          if (keyPair.publicKey[0] === 0x03) {
            const privKeyHex = privateKey.toString('hex');
            const privKeyNum = BigInt('0x' + privKeyHex);
            const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
            const negatedNum = CURVE_ORDER - privKeyNum;
            privateKey = Buffer.from(negatedNum.toString(16).padStart(64, '0'), 'hex');
          }

          if (isScriptPath) {
            // SCRIPT-PATH spending (for deposits)
            console.log(`[signPsbt] Using SCRIPT-PATH signing for Taproot`);

            const tapLeafScript = input.tapLeafScript[0];
            console.log(`[signPsbt] Script:`, tapLeafScript.script.toString('hex'));
            console.log(`[signPsbt] Control block:`, tapLeafScript.controlBlock.toString('hex'));

            // Compute the tapleaf hash
            const leafVersion = tapLeafScript.leafVersion;
            const script = tapLeafScript.script;

            // Encode script length as compact size varint
            const scriptLengthVarint = Buffer.allocUnsafe(varIntSize(script.length));
            writeVarInt(scriptLengthVarint, script.length, 0);

            const tapleafHash = bitcoin.crypto.taggedHash(
              'TapLeaf',
              Buffer.concat([
                Buffer.from([leafVersion]),
                scriptLengthVarint,
                script,
              ])
            );

            console.log(`[signPsbt] Tapleaf hash:`, tapleafHash.toString('hex'));

            // Get the sighash for script-path spending
            const sighash = input.sighashType || 0x00; // SIGHASH_DEFAULT
            const hash = psbt.__CACHE.__TX.hashForWitnessV1(
              inputIndex,
              psbt.data.inputs.map(i => i.witnessUtxo.script),
              psbt.data.inputs.map(i => i.witnessUtxo.value),
              sighash,
              tapleafHash
            );

            console.log(`[signPsbt] Computed sighash for script-path`);

            // Sign with UNTWEAKED private key for script-path
            const signature = ecc.signSchnorr(hash, privateKey);
            const signatureBuffer = Buffer.from(signature);

            console.log(`[signPsbt] Script-path signature:`, signatureBuffer.toString('hex').substring(0, 32) + '...');

            // Extract x-only pubkey for tapScriptSig
            const xOnlyPubkey = keyPair.publicKey.slice(1, 33);

            // For Taproot script-path spending, we need to set tapScriptSig (NOT finalScriptWitness)
            // tapScriptSig is an array of {pubkey, leafHash, signature} objects
            const tapScriptSig = [{
              pubkey: xOnlyPubkey,
              leafHash: tapleafHash,
              signature: signatureBuffer,
            }];

            console.log(`[signPsbt] Setting tapScriptSig with:`);
            console.log(`[signPsbt]   - Pubkey: ${xOnlyPubkey.toString('hex').substring(0, 32)}...`);
            console.log(`[signPsbt]   - LeafHash: ${tapleafHash.toString('hex').substring(0, 32)}...`);
            console.log(`[signPsbt]   - Signature: ${signatureBuffer.length} bytes - ${signatureBuffer.toString('hex').substring(0, 32)}...`);

            // Update the PSBT with tapScriptSig (not finalized yet)
            psbt.updateInput(inputIndex, {
              tapScriptSig,
            });

            console.log(`[signPsbt] tapScriptSig set for script-path spending`);
          } else {
            // KEY-PATH spending (for regular transfers)
            console.log(`[signPsbt] Using KEY-PATH signing for Taproot`);

            // Get the sighash for key-path spending
            const sighash = input.sighashType || 0x00; // SIGHASH_DEFAULT
            const hash = psbt.__CACHE.__TX.hashForWitnessV1(
              inputIndex,
              psbt.data.inputs.map(i => i.witnessUtxo.script),
              psbt.data.inputs.map(i => i.witnessUtxo.value),
              sighash
            );

            console.log(`[signPsbt] Computed sighash for key-path`);

            // Get the private key and tweak it for key-path
            const xOnlyPubkey = keyPair.publicKey.slice(1, 33);
            const tweakHash = bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey);

            // Add the tweak
            const privKeyHex = privateKey.toString('hex');
            const tweakHashHex = Buffer.from(tweakHash).toString('hex');
            const privKeyNum = BigInt('0x' + privKeyHex);
            const tweakNum = BigInt('0x' + tweakHashHex);
            const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
            const tweakedNum = (privKeyNum + tweakNum) % CURVE_ORDER;
            const tweakedPrivateKey = Buffer.from(tweakedNum.toString(16).padStart(64, '0'), 'hex');

            // Sign with Schnorr
            const signature = ecc.signSchnorr(hash, tweakedPrivateKey);
            const signatureBuffer = Buffer.from(signature);

            // Update the PSBT with tapKeySig
            psbt.updateInput(inputIndex, {
              tapKeySig: signatureBuffer,
            });

            console.log(`[signPsbt] Key-path signature added:`, signatureBuffer.toString('hex').substring(0, 32) + '...');
          }
        } else {
          console.log(`[signPsbt] Using signInput for SegWit`);
          psbt.signInput(inputIndex, keyPair);

          // Finalize the SegWit input immediately after signing
          try {
            psbt.finalizeInput(inputIndex);
            console.log(`[signPsbt] Finalized SegWit input ${inputIndex}`);
          } catch (error) {
            console.error(`[signPsbt] Failed to finalize SegWit input ${inputIndex}:`, error);
          }
        }

        // Log PSBT input state after signing
        const inputAfter = psbt.data.inputs[inputIndex];
        console.log(`[signPsbt] Input ${inputIndex} after signing:`, {
          tapKeySig: inputAfter.tapKeySig?.toString('hex'),
          hasTapScriptSig: !!inputAfter.tapScriptSig,
          tapScriptSigCount: inputAfter.tapScriptSig?.length || 0,
          hasPartialSig: !!inputAfter.partialSig,
          partialSigCount: inputAfter.partialSig?.length || 0,
        });

        console.log(`[signPsbt] Successfully signed input ${inputIndex}`);
      } catch (error) {
        console.error(`[signPsbt] Failed to sign input ${inputIndex}:`, error);
        throw error;
      }
    }
  }

  // Don't finalize - let the SDK handle that
  // Just return the signed PSBT
  const signedPsbtBase64 = psbt.toBase64();
  console.log('[signPsbt] PSBT signing complete');

  // Log PSBT state for debugging
  console.log('[signPsbt] Final PSBT inputs:');
  psbt.data.inputs.forEach((input, idx) => {
    console.log(`  Input ${idx}:`, {
      hasTapKeySig: !!input.tapKeySig,
      tapKeySigLength: input.tapKeySig?.length,
      hasTapScriptSig: !!input.tapScriptSig,
      tapScriptSigCount: input.tapScriptSig?.length || 0,
      hasPartialSig: !!input.partialSig,
      hasFinalScriptWitness: !!input.finalScriptWitness,
    });
  });

  return signedPsbtBase64;
}

/**
 * Sign a message with the wallet
 * @param {string} address - Address to sign with
 * @param {string} message - Message to sign
 * @returns {Promise<string>} Signature
 */
export async function signMessage(address, message) {
  console.log('[signMessage] Signing message for address:', address);

  // Get mnemonic from secure storage
  const mnemonic = await SecureStore.getItemAsync(SECURE_KEYS.MNEMONIC);
  if (!mnemonic) {
    throw new Error('No mnemonic found in secure storage');
  }

  // Get current account index
  const accountIndex = 0;

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

  console.log('[signMessage] Message signed successfully');

  return signature.toString('hex');
}
