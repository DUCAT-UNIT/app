/**
 * PSBT signing utilities
 */

import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import type { PsbtInput } from 'bip174';
import { BIP32Interface } from 'bip32';
import { ECPairInterface } from 'ecpair';
import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
// Note: @scure/btc-signer's toPSBT() corrupts OP_RETURN outputs - using manual Schnorr signing instead
import { SECURE_KEYS } from '../constants';
import { MUTINYNET_NETWORK } from '../bitcoin';
import { withMnemonic } from '../../services/secureStorageService';
import {
  bip32,
  ecc,
  getECPair,
  writeVarInt,
  varIntSize,
} from './cryptoHelpers';
import { logger } from '../logger';

/**
 * Internal PSBT cache type for low-level signing operations.
 * bitcoinjs-lib exposes __CACHE for advanced use cases like Taproot signing.
 */
interface PsbtCache {
  __TX: bitcoin.Transaction & {
    hashForWitnessV1(
      inputIndex: number,
      scripts: Buffer[],
      values: bigint[],
      sighashType: number,
      leafHash?: Buffer
    ): Buffer;
  };
}

type PsbtWithCache = bitcoin.Psbt & { __CACHE: PsbtCache };

/**
 * Sign a PSBT with the mobile wallet
 * @param psbtBase64 - PSBT in base64 format
 * @param signInputs - Map of addresses to input indices to sign
 * @returns Signed PSBT in base64 format
 */
export async function signPsbt(
  psbtBase64: string,
  signInputs: Record<string, number[]>
): Promise<string> {
  // Try to get current account index from storage, default to 0
  let accountIndex = 0;
  try {
    const storedAccount = await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    if (storedAccount) {
      accountIndex = parseInt(storedAccount, 10);
    }
  } catch (error: unknown) {
    // SecureStore errors are non-critical, use default account 0
    logger.debug('SecureStore read failed, using default account 0', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return await withMnemonic(async (mnemonic: string) => {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

    for (const [address, inputIndices] of Object.entries(signInputs)) {
      let derivationPath: string;
      let keyPair: ECPairInterface | BIP32Interface;
      const ECPairInstance = getECPair();

      if (address.startsWith('tb1q')) {
        derivationPath = `m/84'/1'/0'/0/${accountIndex}`;
        const child = root.derivePath(derivationPath);
        keyPair = ECPairInstance.fromPrivateKey(child.privateKey!, { network: MUTINYNET_NETWORK });
      } else if (address.startsWith('tb1p')) {
        derivationPath = `m/86'/1'/0'/0/${accountIndex}`;
        keyPair = root.derivePath(derivationPath);
      } else {
        throw new Error(`Unsupported address type: ${address}`);
      }

      for (const inputIndex of inputIndices) {
        try {
          if (address.startsWith('tb1p')) {
            await signTaprootInput(psbt, inputIndex, keyPair as BIP32Interface);
          } else {
            signSegwitInput(psbt, inputIndex, keyPair as ECPairInterface);
          }
        } catch (error: unknown) {
          throw error;
        }
      }
    }

    return psbt.toBase64();
  });
}

/**
 * Sign a Taproot input using either key-path or script-path spending
 * Automatically detects the spending path based on tapLeafScript presence
 * @param psbt - The PSBT to sign
 * @param inputIndex - Index of the input to sign
 * @param keyPair - BIP32 key pair for signing (must include private key)
 */
async function signTaprootInput(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  keyPair: BIP32Interface
): Promise<void> {
  const input = psbt.data.inputs[inputIndex];
  const isScriptPath = !!(input.tapLeafScript && input.tapLeafScript.length > 0);

  if (isScriptPath) {
    signScriptPathInput(psbt, inputIndex, keyPair, input);
  } else {
    signKeyPathInput(psbt, inputIndex, keyPair);
  }
}

/**
 * Sign a script-path Taproot input (P2TR script spend)
 * Computes the tapleaf hash and creates a Schnorr signature for the script
 * @param psbt - The PSBT to sign
 * @param inputIndex - Index of the input to sign
 * @param keyPair - BIP32 key pair for signing
 * @param input - The PSBT input data containing tapLeafScript
 */
function signScriptPathInput(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  keyPair: BIP32Interface,
  input: PsbtInput
): void {
  const tapLeafScript = input.tapLeafScript![0];
  const leafVersion = tapLeafScript.leafVersion;
  const script = tapLeafScript.script;

  // Encode script length as compact size varint
  const scriptLengthVarint = Buffer.allocUnsafe(varIntSize(script.length));
  writeVarInt(scriptLengthVarint, script.length, 0);

  const tapleafHash = bitcoin.crypto.taggedHash(
    'TapLeaf',
    Buffer.concat([Buffer.from([leafVersion]), scriptLengthVarint, script])
  );

  const sighash = input.sighashType || 0x00;
  // Access internal PSBT cache for low-level Taproot signing (required by bitcoinjs-lib)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const psbtCache = (psbt as any).__CACHE as PsbtCache;
  const hash = psbtCache.__TX.hashForWitnessV1(
    inputIndex,
    psbt.data.inputs.map((i) => i.witnessUtxo!.script),
    psbt.data.inputs.map((i) => i.witnessUtxo!.value),
    sighash,
    tapleafHash
  );

  let privateKey = keyPair.privateKey!;
  if (!Buffer.isBuffer(privateKey)) {
    privateKey = Buffer.from(privateKey);
  }

  const signature = ecc.signSchnorr(hash, privateKey);
  const signatureBuffer = Buffer.from(signature);
  const xOnlyPubkey = keyPair.publicKey.slice(1, 33);

  const tapScriptSig = [{
    pubkey: xOnlyPubkey,
    leafHash: tapleafHash,
    signature: signatureBuffer,
  }];

  psbt.updateInput(inputIndex, { tapScriptSig });
}

/**
 * Sign a key-path Taproot input (P2TR key spend)
 * Creates a tweaked Schnorr signature using the internal key
 * Falls back to manual signing if standard bitcoinjs-lib signing fails
 * @param psbt - The PSBT to sign
 * @param inputIndex - Index of the input to sign
 * @param keyPair - BIP32 key pair for signing (x-only pubkey derived internally)
 */
function signKeyPathInput(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  keyPair: BIP32Interface
): void {
  const xOnlyPubkey = keyPair.publicKey.slice(1, 33);

  try {
    const tweakedSigner = keyPair.tweak(
      bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey)
    );
    psbt.signInput(inputIndex, tweakedSigner);
  } catch (error: unknown) {
    // Fall back to manual signing when standard signing fails
    // Access internal PSBT cache for low-level Taproot signing (required by bitcoinjs-lib)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const psbtCache = (psbt as any).__CACHE as PsbtCache;
    const tx = psbtCache.__TX.clone();
    const sighash = tx.hashForWitnessV1(
      inputIndex,
      psbt.data.inputs.map((input) => input.witnessUtxo!.script),
      psbt.data.inputs.map((input) => input.witnessUtxo!.value),
      bitcoin.Transaction.SIGHASH_DEFAULT
    );

    const tweakedSigner = keyPair.tweak(
      bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey)
    );

    const signature = ecc.signSchnorr(sighash, (tweakedSigner as BIP32Interface).privateKey!);
    psbt.updateInput(inputIndex, { tapKeySig: Buffer.from(signature) });
  }
}

/**
 * Sign a SegWit (P2WPKH) input and finalize it
 * Uses standard ECDSA signing for native SegWit addresses
 * @param psbt - The PSBT to sign
 * @param inputIndex - Index of the input to sign
 * @param keyPair - EC key pair for ECDSA signing
 */
function signSegwitInput(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  keyPair: ECPairInterface
): void {
  psbt.signInput(inputIndex, keyPair);

  try {
    psbt.finalizeInput(inputIndex);
  } catch (error: unknown) {
    // Finalization may fail for partially-signed PSBTs - this is expected behavior
    logger.debug('SegWit input finalization skipped (expected for multi-sig)', {
      inputIndex,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Sign a SegWit (P2WPKH) input WITHOUT finalizing
 * For use with SDK that handles its own finalization
 * @param psbt - The PSBT to sign
 * @param inputIndex - Index of the input to sign
 * @param keyPair - EC key pair for ECDSA signing
 */
function signSegwitInputRaw(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  keyPair: ECPairInterface
): void {
  psbt.signInput(inputIndex, keyPair);
  // Do NOT finalize - let SDK handle finalization
}

/**
 * Sign a Taproot input WITHOUT finalizing
 * For use with SDK that handles its own finalization
 * @param psbt - The PSBT to sign
 * @param inputIndex - Index of the input to sign
 * @param keyPair - BIP32 key pair for signing
 */
async function signTaprootInputRaw(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  keyPair: BIP32Interface
): Promise<void> {
  const input = psbt.data.inputs[inputIndex];
  const isScriptPath = !!(input.tapLeafScript && input.tapLeafScript.length > 0);

  if (isScriptPath) {
    signScriptPathInput(psbt, inputIndex, keyPair, input);
  } else {
    signKeyPathInput(psbt, inputIndex, keyPair);
  }
  // Do NOT finalize - let SDK handle finalization
}

/**
 * Convert witness stack to script witness format
 * Properly serializes witness elements with compact size prefixes
 */
function witnessToScriptWitness(witness: Buffer[]): Buffer {
  let size = varIntSize(witness.length);
  for (const item of witness) {
    size += varIntSize(item.length) + item.length;
  }

  const buffer = Buffer.allocUnsafe(size);
  let offset = 0;

  // Write witness stack count
  offset = writeVarInt(buffer, witness.length, offset);

  // Write each witness element
  for (const item of witness) {
    offset = writeVarInt(buffer, item.length, offset);
    item.copy(buffer, offset);
    offset += item.length;
  }

  return buffer;
}

/**
 * Sign a PSBT for use with the SDK
 * Uses bitcoinjs-lib for signing and sets finalScriptWitness directly
 * This matches the original working WebView implementation
 * @param psbtBase64 - PSBT in base64 format
 * @param signInputs - Map of addresses to input indices to sign
 * @returns Signed PSBT in base64 format
 */
export async function signPsbtRaw(
  psbtBase64: string,
  signInputs: Record<string, number[]>
): Promise<string> {
  // Try to get current account index from storage, default to 0
  let accountIndex = 0;
  try {
    const storedAccount = await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    if (storedAccount) {
      accountIndex = parseInt(storedAccount, 10);
    }
  } catch (error: unknown) {
    logger.debug('SecureStore read failed, using default account 0', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return await withMnemonic(async (mnemonic: string) => {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    // Use bitcoinjs-lib for signing (matches original working implementation)
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

    logger.debug(`[signPsbtRaw] Loaded PSBT with ${psbt.inputCount} inputs`);

    for (const [address, inputIndices] of Object.entries(signInputs)) {
      for (const inputIndex of inputIndices) {
        try {
          const input = psbt.data.inputs[inputIndex];
          if (!input.witnessUtxo) {
            logger.warn(`[signPsbtRaw] No witnessUtxo for input ${inputIndex}`);
            continue;
          }

          // Determine address type from the prevout script
          const scriptHex = Buffer.from(input.witnessUtxo.script).toString('hex');
          const isSegwit = scriptHex.startsWith('0014'); // P2WPKH: OP_0 <20-byte-hash>
          const isTaproot = scriptHex.startsWith('5120'); // P2TR: OP_1 <32-byte-key>

          logger.debug(`[signPsbtRaw] Input ${inputIndex}: isSegwit=${isSegwit}, isTaproot=${isTaproot}`);

          if (isSegwit || address.startsWith('tb1q')) {
            // SegWit P2WPKH signing
            const derivationPath = `m/84'/1'/0'/0/${accountIndex}`;
            const child = root.derivePath(derivationPath);
            const ECPairInstance = getECPair();
            const keyPair = ECPairInstance.fromPrivateKey(child.privateKey!, { network: MUTINYNET_NETWORK });

            logger.debug(`[signPsbtRaw] SegWit signing input ${inputIndex}`);

            // Sign the input - this sets partialSig in bitcoinjs-lib
            // Do NOT finalize here - let psbtPostProcess handle finalization
            // (matches frontend where external wallet returns signed-but-not-finalized PSBTs)
            psbt.signInput(inputIndex, keyPair);

            // Log what was set after signing
            const signedInput = psbt.data.inputs[inputIndex];
            logger.debug(`[signPsbtRaw] After sign: partialSig exists: ${!!signedInput.partialSig}`);
            if (signedInput.partialSig && signedInput.partialSig.length > 0) {
              const ps = signedInput.partialSig[0];
              logger.debug(`[signPsbtRaw] partialSig[0].pubkey length: ${ps.pubkey.length}`);
              logger.debug(`[signPsbtRaw] partialSig[0].signature length: ${ps.signature.length}`);
            }

          } else if (isTaproot || address.startsWith('tb1p')) {
            // Taproot P2TR signing
            const derivationPath = `m/86'/1'/0'/0/${accountIndex}`;
            const keyPair = root.derivePath(derivationPath);

            const isScriptPath = !!(input.tapLeafScript && input.tapLeafScript.length > 0);
            logger.debug(`[signPsbtRaw] Taproot signing input ${inputIndex}, isScriptPath=${isScriptPath}`);

            if (isScriptPath) {
              // SCRIPT-PATH spending - use manual Schnorr signing for SDK compatibility
              // IMPORTANT: DO NOT use @scure/btc-signer's toPSBT() as it corrupts OP_RETURN outputs!
              logger.debug(`[signPsbtRaw] Using SCRIPT-PATH signing for Taproot (manual Schnorr)`);
              logger.debug(`[signPsbtRaw] tapLeafScript present: ${!!input.tapLeafScript}`);

              const tapLeafScript = input.tapLeafScript![0];
              const leafVersion = tapLeafScript.leafVersion;
              const script = tapLeafScript.script;

              logger.debug(`[signPsbtRaw] tapLeafScript leafVersion: ${leafVersion}`);
              logger.debug(`[signPsbtRaw] tapLeafScript script length: ${script.length}`);

              // Compute tapleaf hash
              const scriptLengthVarint = Buffer.allocUnsafe(varIntSize(script.length));
              writeVarInt(scriptLengthVarint, script.length, 0);

              const tapleafHash = bitcoin.crypto.taggedHash(
                'TapLeaf',
                Buffer.concat([Buffer.from([leafVersion]), scriptLengthVarint, script])
              );

              logger.debug(`[signPsbtRaw] tapleafHash: ${Buffer.from(tapleafHash).toString('hex')}`);

              // Get the sighash for script-path spending
              const sighash = input.sighashType || 0x00; // SIGHASH_DEFAULT
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const psbtCache = (psbt as any).__CACHE as PsbtCache;
              const hash = psbtCache.__TX.hashForWitnessV1(
                inputIndex,
                psbt.data.inputs.map(i => Buffer.from(i.witnessUtxo!.script)),
                psbt.data.inputs.map(i => i.witnessUtxo!.value),
                sighash,
                tapleafHash
              );

              logger.debug(`[signPsbtRaw] sighash for script-path: ${Buffer.from(hash).toString('hex')}`);

              // Use original private key for script-path (no tweaking needed)
              let privateKey = keyPair.privateKey!;
              if (!Buffer.isBuffer(privateKey)) {
                privateKey = Buffer.from(privateKey);
              }

              // Sign with Schnorr
              const signature = ecc.signSchnorr(hash, privateKey);
              const signatureBuffer = Buffer.from(signature);
              const xOnlyPubkey = keyPair.publicKey.slice(1, 33);

              logger.debug(`[signPsbtRaw] Schnorr signature length: ${signatureBuffer.length}`);
              logger.debug(`[signPsbtRaw] xOnlyPubkey: ${Buffer.from(xOnlyPubkey).toString('hex')}`);

              // Set tapScriptSig in the format bitcoinjs-lib expects
              const tapScriptSig = [{
                pubkey: xOnlyPubkey,
                leafHash: tapleafHash,
                signature: signatureBuffer,
              }];

              psbt.updateInput(inputIndex, { tapScriptSig });

              logger.debug(`[signPsbtRaw] tapScriptSig set for script-path`);
              // Continue loop to process other inputs, don't return early
            } else {
              // KEY-PATH spending - set tapKeySig directly
              logger.debug(`[signPsbtRaw] Using KEY-PATH signing for Taproot`);

              // Handle y-coordinate negation manually for key-path
              let privateKey2 = keyPair.privateKey!;
              if (!Buffer.isBuffer(privateKey2)) {
                privateKey2 = Buffer.from(privateKey2);
              }

              // Check if we need to negate the private key (if y-coordinate is odd)
              if (keyPair.publicKey[0] === 0x03) {
                const privKeyHex = Buffer.from(privateKey2).toString('hex');
                const privKeyNum = BigInt('0x' + privKeyHex);
                const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
                const negatedNum = CURVE_ORDER - privKeyNum;
                privateKey2 = Buffer.from(negatedNum.toString(16).padStart(64, '0'), 'hex');
              }

              // Get the sighash for key-path spending
              const sighashKey = input.sighashType || 0x00; // SIGHASH_DEFAULT
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const psbtCache2 = (psbt as any).__CACHE as PsbtCache;
              const hash2 = psbtCache2.__TX.hashForWitnessV1(
                inputIndex,
                psbt.data.inputs.map(i => Buffer.from(i.witnessUtxo!.script)),
                psbt.data.inputs.map(i => i.witnessUtxo!.value),
                sighashKey
              );

              // Tweak the private key for key-path
              const xOnlyPubkey2 = keyPair.publicKey.slice(1, 33);
              const tweakHash = bitcoin.crypto.taggedHash('TapTweak', Buffer.from(xOnlyPubkey2));

              const privKeyHex2 = Buffer.from(privateKey2).toString('hex');
              const tweakHashHex = Buffer.from(tweakHash).toString('hex');
              const privKeyNum2 = BigInt('0x' + privKeyHex2);
              const tweakNum = BigInt('0x' + tweakHashHex);
              const CURVE_ORDER2 = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
              const tweakedNum = (privKeyNum2 + tweakNum) % CURVE_ORDER2;
              const tweakedPrivateKey = Buffer.from(tweakedNum.toString(16).padStart(64, '0'), 'hex');

              // Sign with Schnorr
              const signatureKey = ecc.signSchnorr(hash2, tweakedPrivateKey);
              const signatureBufferKey = Buffer.from(signatureKey);

              // Set tapKeySig directly
              psbt.updateInput(inputIndex, {
                tapKeySig: signatureBufferKey,
              });

              logger.debug(`[signPsbtRaw] tapKeySig set for key-path (${signatureBufferKey.length} bytes)`);
            }
          }

          logger.debug(`[signPsbtRaw] Signed input ${inputIndex} for ${address}`);
        } catch (error: unknown) {
          logger.error('[signPsbtRaw] Error signing input', {
            inputIndex,
            address,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }
    }

    // Return the signed PSBT in base64
    const signedPsbt = psbt.toBase64();
    logger.debug(`[signPsbtRaw] Signed PSBT encoded`);
    return signedPsbt;
  });
}
