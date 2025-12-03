/**
 * VaultWallet Service
 * Creates a VaultWallet instance using the mobile app's wallet
 */

import {
  VaultWallet,
  OracleAPI,
  type WalletAccountRecord,
  type WalletConfig,
  type WalletConnectAPI,
  type ProtocolProfile,
} from '@ducat-unit/client-sdk';
import { TX, PSBT, hash160, taptweak_pubkey } from '@ducat-unit/client-sdk/util';
import { Buff } from '@cmdcode/buff';
import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { API, VAULT_CONFIG, SECURE_KEYS } from '../utils/constants';
import { signPsbtRaw } from '../utils/wallet/psbtSigning';
import { MUTINYNET_NETWORK } from '../utils/bitcoin';
import { withMnemonic } from './secureStorageService';
import {
  bip32,
  ecc,
  getECPair,
  varIntSize,
  writeVarInt,
} from '../utils/wallet/cryptoHelpers';
import { logger } from '../utils/logger';

// Mutinynet master contract ID
const MASTER_CONTRACT_ID = '02837661131516ad503dbe0bcf73964244d5f02bc577678ffd3fcbb54f493f36i0';

// Wallet configuration for mutinynet
const WALLET_CFG: WalletConfig = {
  indexer: {
    esp: API.ESPLORA_URL,
    ord: API.ORD_URL,
  },
  network: 'mutiny',
  postage: {
    unit: VAULT_CONFIG.UNIT_POSTAGE,
    vault: VAULT_CONFIG.TOKEN_POSTAGE,
  },
};

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

/**
 * Sign a PSBT while preserving OP_RETURN outputs.
 *
 * Strategy:
 * 1. Save original PSBT base64 (has correct OP_RETURN)
 * 2. Decode with bitcoinjs-lib for sighash computation and signing
 * 3. Sign inputs
 * 4. Extract the unsigned transaction from original PSBT
 * 5. Patch signatures into the original PSBT binary without re-encoding outputs
 *
 * @param sdkPdata - The SDK's PSBT object (from PSBT.decode)
 * @param signInputs - Map of addresses to input indices to sign
 * @param originalPsbtBase64 - Original PSBT base64 before any modifications
 * @returns Signed PSBT in base64 format with preserved OP_RETURN
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function signPsbtWithSdkObject(sdkPdata: any, signInputs: Record<string, number[]>, originalPsbtBase64?: string): Promise<string> {
  // Get current account index
  let accountIndex = 0;
  try {
    const storedAccount = await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    if (storedAccount) {
      accountIndex = parseInt(storedAccount, 10);
    }
  } catch (error: unknown) {
    logger.debug('[signPsbtWithSdkObject] SecureStore read failed, using default account 0');
  }

  return await withMnemonic(async (mnemonic: string) => {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    // Use original PSBT if provided, otherwise encode from SDK object
    const psbtBase64 = originalPsbtBase64 || PSBT.encode(sdkPdata);

    // Decode with bitcoinjs-lib for sighash computation
    const bjsPsbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

    logger.debug(`[signPsbtWithSdkObject] Processing ${Object.keys(signInputs).length} addresses`);

    // Collect signatures to inject
    const signatures: Array<{
      inputIndex: number;
      type: 'segwit' | 'taproot-key' | 'taproot-script';
      pubkey?: Buffer;
      signature: Buffer;
      leafHash?: Buffer;
    }> = [];

    for (const [address, inputIndices] of Object.entries(signInputs)) {
      for (const inputIndex of inputIndices) {
        try {
          const bjsInput = bjsPsbt.data.inputs[inputIndex];
          if (!bjsInput.witnessUtxo) {
            logger.warn(`[signPsbtWithSdkObject] No witnessUtxo for input ${inputIndex}`);
            continue;
          }

          // Determine address type from the prevout script
          const scriptHex = Buffer.from(bjsInput.witnessUtxo.script).toString('hex');
          const isSegwit = scriptHex.startsWith('0014'); // P2WPKH: OP_0 <20-byte-hash>
          const isTaproot = scriptHex.startsWith('5120'); // P2TR: OP_1 <32-byte-key>

          logger.debug(`[signPsbtWithSdkObject] Input ${inputIndex}: isSegwit=${isSegwit}, isTaproot=${isTaproot}`);

          if (isSegwit || address.startsWith('tb1q')) {
            // SegWit P2WPKH signing
            const derivationPath = `m/84'/1'/0'/0/${accountIndex}`;
            const child = root.derivePath(derivationPath);
            const ECPairInstance = getECPair();
            const keyPair = ECPairInstance.fromPrivateKey(child.privateKey!, { network: MUTINYNET_NETWORK });

            // Sign in bitcoinjs-lib
            bjsPsbt.signInput(inputIndex, keyPair);

            // Extract signature
            const signedBjsInput = bjsPsbt.data.inputs[inputIndex];
            if (signedBjsInput.partialSig && signedBjsInput.partialSig.length > 0) {
              const ps = signedBjsInput.partialSig[0];
              signatures.push({
                inputIndex,
                type: 'segwit',
                pubkey: Buffer.from(ps.pubkey),
                signature: Buffer.from(ps.signature),
              });
              logger.debug(`[signPsbtWithSdkObject] SegWit signature computed for input ${inputIndex}`);
            }

          } else if (isTaproot || address.startsWith('tb1p')) {
            // Taproot P2TR signing
            const derivationPath = `m/86'/1'/0'/0/${accountIndex}`;
            const keyPair = root.derivePath(derivationPath);

            const isScriptPath = !!(bjsInput.tapLeafScript && bjsInput.tapLeafScript.length > 0);
            logger.debug(`[signPsbtWithSdkObject] Taproot input ${inputIndex}, isScriptPath=${isScriptPath}`);

            if (isScriptPath) {
              // SCRIPT-PATH spending
              const tapLeafScript = bjsInput.tapLeafScript![0];
              const leafVersion = tapLeafScript.leafVersion;
              const script = tapLeafScript.script;

              // Compute tapleaf hash
              const scriptLengthVarint = Buffer.allocUnsafe(varIntSize(script.length));
              writeVarInt(scriptLengthVarint, script.length, 0);

              const tapleafHash = bitcoin.crypto.taggedHash(
                'TapLeaf',
                Buffer.concat([Buffer.from([leafVersion]), scriptLengthVarint, script])
              );

              // Get the sighash for script-path spending
              const sighash = bjsInput.sighashType || 0x00;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const psbtCache = (bjsPsbt as any).__CACHE as PsbtCache;
              const hash = psbtCache.__TX.hashForWitnessV1(
                inputIndex,
                bjsPsbt.data.inputs.map(i => Buffer.from(i.witnessUtxo!.script)),
                bjsPsbt.data.inputs.map(i => i.witnessUtxo!.value),
                sighash,
                tapleafHash
              );

              // Sign with original private key (no tweaking for script-path)
              let privateKey = keyPair.privateKey!;
              if (!Buffer.isBuffer(privateKey)) {
                privateKey = Buffer.from(privateKey);
              }

              const signature = ecc.signSchnorr(hash, privateKey);
              const xOnlyPubkey = keyPair.publicKey.slice(1, 33);

              signatures.push({
                inputIndex,
                type: 'taproot-script',
                pubkey: Buffer.from(xOnlyPubkey),
                signature: Buffer.from(signature),
                leafHash: Buffer.from(tapleafHash),
              });
              logger.debug(`[signPsbtWithSdkObject] Taproot script-path signature computed for input ${inputIndex}`);

            } else {
              // KEY-PATH spending
              let privateKey = keyPair.privateKey!;
              if (!Buffer.isBuffer(privateKey)) {
                privateKey = Buffer.from(privateKey);
              }

              // Handle y-coordinate negation if needed
              if (keyPair.publicKey[0] === 0x03) {
                const privKeyHex = Buffer.from(privateKey).toString('hex');
                const privKeyNum = BigInt('0x' + privKeyHex);
                const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
                const negatedNum = CURVE_ORDER - privKeyNum;
                privateKey = Buffer.from(negatedNum.toString(16).padStart(64, '0'), 'hex');
              }

              // Get the sighash for key-path spending
              const sighash = bjsInput.sighashType || 0x00;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const psbtCache = (bjsPsbt as any).__CACHE as PsbtCache;
              const hash = psbtCache.__TX.hashForWitnessV1(
                inputIndex,
                bjsPsbt.data.inputs.map(i => Buffer.from(i.witnessUtxo!.script)),
                bjsPsbt.data.inputs.map(i => i.witnessUtxo!.value),
                sighash
              );

              // Tweak the private key
              const xOnlyPubkey = keyPair.publicKey.slice(1, 33);
              const tweakHash = bitcoin.crypto.taggedHash('TapTweak', Buffer.from(xOnlyPubkey));

              const privKeyHex = Buffer.from(privateKey).toString('hex');
              const tweakHashHex = Buffer.from(tweakHash).toString('hex');
              const privKeyNum = BigInt('0x' + privKeyHex);
              const tweakNum = BigInt('0x' + tweakHashHex);
              const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
              const tweakedNum = (privKeyNum + tweakNum) % CURVE_ORDER;
              const tweakedPrivateKey = Buffer.from(tweakedNum.toString(16).padStart(64, '0'), 'hex');

              // Sign with Schnorr
              const signature = ecc.signSchnorr(hash, tweakedPrivateKey);

              signatures.push({
                inputIndex,
                type: 'taproot-key',
                signature: Buffer.from(signature),
              });
              logger.debug(`[signPsbtWithSdkObject] Taproot key-path signature computed for input ${inputIndex}`);
            }
          }
        } catch (error: unknown) {
          logger.error('[signPsbtWithSdkObject] Error signing input', {
            inputIndex,
            address,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }
    }

    // Patch signatures into the original PSBT binary
    const signedPsbt = patchPsbtSignatures(psbtBase64, signatures);
    logger.debug('[signPsbtWithSdkObject] PSBT signed with binary patching');
    return signedPsbt;
  });
}

/**
 * Patch signatures into a PSBT without re-encoding the transaction outputs.
 * This preserves OP_RETURN outputs that would be corrupted by full re-encoding.
 */
function patchPsbtSignatures(
  psbtBase64: string,
  signatures: Array<{
    inputIndex: number;
    type: 'segwit' | 'taproot-key' | 'taproot-script';
    pubkey?: Buffer;
    signature: Buffer;
    leafHash?: Buffer;
  }>
): string {
  const psbtBuffer = Buffer.from(psbtBase64, 'base64');
  const parts: Buffer[] = [];
  let offset = 0;

  // PSBT magic bytes: 0x70736274ff
  if (psbtBuffer.slice(0, 5).toString('hex') !== '70736274ff') {
    throw new Error('Invalid PSBT magic');
  }
  parts.push(psbtBuffer.slice(0, 5));
  offset = 5;

  // Parse global map (skip to end marker 0x00)
  const globalStart = offset;
  while (psbtBuffer[offset] !== 0x00) {
    const keyLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(keyLen.value);
    offset += keyLen.value; // key
    const valLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(valLen.value);
    offset += valLen.value; // value
  }
  parts.push(psbtBuffer.slice(globalStart, offset + 1)); // include 0x00 terminator
  offset++;

  // Count inputs by parsing until we hit output maps
  // We need to know how many inputs there are
  const inputCount = countPsbtInputs(psbtBuffer, offset);

  // Parse each input map and inject signatures
  for (let inputIdx = 0; inputIdx < inputCount; inputIdx++) {
    const inputStart = offset;
    const inputParts: Buffer[] = [];

    // Read existing key-value pairs
    while (psbtBuffer[offset] !== 0x00) {
      const kvStart = offset;
      const keyLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(keyLen.value);
      offset += keyLen.value;
      const valLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(valLen.value);
      offset += valLen.value;
      inputParts.push(psbtBuffer.slice(kvStart, offset));
    }

    // Check if we need to add a signature for this input
    const sigForInput = signatures.find(s => s.inputIndex === inputIdx);
    if (sigForInput) {
      // Create signature key-value pair based on type
      let sigKv: Buffer;
      if (sigForInput.type === 'segwit' && sigForInput.pubkey) {
        // PSBT_IN_PARTIAL_SIG (0x02): key = 0x02 || pubkey, value = signature
        const keyType = Buffer.from([0x02]);
        const key = Buffer.concat([keyType, sigForInput.pubkey]);
        sigKv = createPsbtKv(key, sigForInput.signature);
      } else if (sigForInput.type === 'taproot-key') {
        // PSBT_IN_TAP_KEY_SIG (0x13): key = 0x13, value = signature
        const key = Buffer.from([0x13]);
        sigKv = createPsbtKv(key, sigForInput.signature);
      } else if (sigForInput.type === 'taproot-script' && sigForInput.pubkey && sigForInput.leafHash) {
        // PSBT_IN_TAP_SCRIPT_SIG (0x14): key = 0x14 || xonlypubkey || leafhash, value = signature
        const keyType = Buffer.from([0x14]);
        const key = Buffer.concat([keyType, sigForInput.pubkey, sigForInput.leafHash]);
        sigKv = createPsbtKv(key, sigForInput.signature);
      } else {
        throw new Error(`Invalid signature type: ${sigForInput.type}`);
      }
      inputParts.push(sigKv);
    }

    // Write input map with terminator
    for (const part of inputParts) {
      parts.push(part);
    }
    parts.push(Buffer.from([0x00])); // terminator
    offset++; // skip original terminator
  }

  // Copy remaining output maps unchanged
  parts.push(psbtBuffer.slice(offset));

  const result = Buffer.concat(parts);
  return result.toString('base64');
}

/**
 * Count PSBT inputs by parsing the binary
 */
function countPsbtInputs(psbtBuffer: Buffer, startOffset: number): number {
  // The global map contains PSBT_GLOBAL_UNSIGNED_TX (0x00) which has the tx
  // We need to parse it to get input count
  let offset = 5; // skip magic

  while (psbtBuffer[offset] !== 0x00) {
    const keyLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(keyLen.value);
    const keyStart = offset;
    offset += keyLen.value;
    const valLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(valLen.value);

    // Check if this is the unsigned tx (key type 0x00)
    if (keyLen.value === 1 && psbtBuffer[keyStart] === 0x00) {
      // Parse tx to get input count
      const txStart = offset;
      let txOffset = txStart;
      txOffset += 4; // version

      // Check for witness marker
      if (psbtBuffer[txOffset] === 0x00 && psbtBuffer[txOffset + 1] === 0x01) {
        txOffset += 2; // marker + flag
      }

      // Read input count
      const inputCountVi = readVarInt(psbtBuffer, txOffset);
      return inputCountVi.value;
    }

    offset += valLen.value;
  }

  throw new Error('Could not find unsigned tx in PSBT');
}

/**
 * Create a PSBT key-value pair
 */
function createPsbtKv(key: Buffer, value: Buffer): Buffer {
  const keyLenBuf = Buffer.allocUnsafe(varIntSize(key.length));
  writeVarInt(keyLenBuf, key.length, 0);

  const valLenBuf = Buffer.allocUnsafe(varIntSize(value.length));
  writeVarInt(valLenBuf, value.length, 0);

  return Buffer.concat([keyLenBuf, key, valLenBuf, value]);
}

/**
 * Read a varint from buffer
 */
function readVarInt(buffer: Buffer, offset: number): { value: number; bytesRead: number } {
  const first = buffer[offset];
  if (first < 0xfd) {
    return { value: first, bytesRead: 1 };
  } else if (first === 0xfd) {
    return { value: buffer.readUInt16LE(offset + 1), bytesRead: 3 };
  } else if (first === 0xfe) {
    return { value: buffer.readUInt32LE(offset + 1), bytesRead: 5 };
  } else {
    // 0xff - 8 byte, but for PSBT this is unlikely
    throw new Error('64-bit varint not supported');
  }
}

/**
 * Patch pre-processing fields (redeemScript, tapInternalKey) into PSBT binary
 */
function patchPreProcessFields(
  psbtBase64: string,
  client: VaultWallet,
  manifest: Record<string, number[]>
): string {
  const sats_pkh = hash160(client.acct.sats.pubkey);
  const runes_tpk = taptweak_pubkey(client.acct.runes.pubkey);

  // Collect fields to add
  const fieldsToAdd: Array<{
    inputIndex: number;
    fields: Array<{ keyType: number; key: Buffer; value: Buffer }>;
  }> = [];

  // Decode PSBT to analyze inputs (decode doesn't corrupt)
  const bjsPsbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

  for (const [address, inputs] of Object.entries(manifest)) {
    const addr_meta = TX.parse_address(address);
    for (const idx of inputs) {
      const txinput = bjsPsbt.data.inputs[idx];
      const prevout = txinput.witnessUtxo;

      if (prevout === undefined) continue;

      const scriptHex = Buffer.from(prevout.script).toString('hex');
      const fields: Array<{ keyType: number; key: Buffer; value: Buffer }> = [];

      // Handle P2SH (wrapped segwit) - check if script starts with a9 14 (OP_HASH160 <20-bytes>)
      if (scriptHex.startsWith('a914')) {
        const redeemScript = `0014${sats_pkh}`;
        const redeemScriptBuf = Buffer.from(redeemScript, 'hex');
        // PSBT_IN_REDEEM_SCRIPT (0x04)
        fields.push({ keyType: 0x04, key: Buffer.from([0x04]), value: redeemScriptBuf });
        // PSBT_IN_FINAL_SCRIPTSIG (0x07) - push the redeemScript length + redeemScript
        const scriptSigLen = redeemScriptBuf.length;
        const finalScriptSig = Buffer.concat([Buffer.from([scriptSigLen]), redeemScriptBuf]);
        fields.push({ keyType: 0x07, key: Buffer.from([0x07]), value: finalScriptSig });
      }

      // Handle P2TR (taproot) - check if script starts with 5120 (OP_1 <32-bytes>)
      if (scriptHex.startsWith('5120')) {
        const scriptKey = scriptHex.slice(4); // skip 5120
        if (scriptKey === runes_tpk) {
          // PSBT_IN_TAP_INTERNAL_KEY (0x17)
          const internalKey = Buffer.from(client.acct.runes.pubkey, 'hex');
          fields.push({ keyType: 0x17, key: Buffer.from([0x17]), value: internalKey });
        }
      }

      if (fields.length > 0) {
        fieldsToAdd.push({ inputIndex: idx, fields });
      }
    }
  }

  if (fieldsToAdd.length === 0) {
    return psbtBase64; // No modifications needed
  }

  // Patch fields into PSBT binary
  return patchPsbtInputFields(psbtBase64, fieldsToAdd);
}

/**
 * Patch post-processing fields (finalScriptWitness) into PSBT binary
 */
function patchPostProcessFields(
  psbtBase64: string,
  client: VaultWallet,
  manifest: Record<string, number[]>
): string {
  const vault_pk = client.acct.vault.pubkey;

  // Collect fields to add
  const fieldsToAdd: Array<{
    inputIndex: number;
    fields: Array<{ keyType: number; key: Buffer; value: Buffer }>;
  }> = [];

  // Decode PSBT to analyze inputs
  const bjsPsbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

  for (const [_, inputs] of Object.entries(manifest)) {
    for (const idx of inputs) {
      const txinput = bjsPsbt.data.inputs[idx];
      const prevout = txinput.witnessUtxo;

      if (prevout === undefined) continue;

      // Check if already has finalScriptWitness
      if (txinput.finalScriptWitness) continue;

      const fields: Array<{ keyType: number; key: Buffer; value: Buffer }> = [];
      let witness: Buffer[] = [];

      // Handle partial signatures (segwit)
      const segwit_sig = txinput.partialSig?.at(0);
      if (segwit_sig !== undefined && witness.length === 0) {
        // partialSig is [pubkey, signature] - witness needs [signature, pubkey]
        witness.push(Buffer.from(segwit_sig.signature));
        witness.push(Buffer.from(segwit_sig.pubkey));
      }

      // Handle taproot key-spend
      const tapkey_sig = txinput.tapKeySig;
      if (tapkey_sig !== undefined && witness.length === 0) {
        witness.push(Buffer.from(tapkey_sig));
      }

      // Handle taproot script-spend
      const tapscript_sig = txinput.tapScriptSig;
      const tapLeafScript = txinput.tapLeafScript;
      if (tapscript_sig && tapscript_sig.length > 0 && tapLeafScript && tapLeafScript.length > 0) {
        const tss = tapscript_sig[0];
        const tls = tapLeafScript[0];

        // Build witness: [signature, script, controlBlock]
        witness = [
          Buffer.from(tss.signature),
          Buffer.from(tls.script),
          Buffer.from(tls.controlBlock),
        ];

        // Check if first element is vault pubkey and remove it
        if (witness.length > 0) {
          const elem_hex = witness[0].toString('hex');
          if (elem_hex === vault_pk) {
            witness = witness.slice(1);
          }
        }
      }

      // Build finalScriptWitness if we have witness data
      if (witness.length > 0) {
        const witnessData = encodeWitnessStack(witness);
        // PSBT_IN_FINAL_SCRIPTWITNESS (0x08)
        fields.push({ keyType: 0x08, key: Buffer.from([0x08]), value: witnessData });
      }

      if (fields.length > 0) {
        fieldsToAdd.push({ inputIndex: idx, fields });
      }
    }
  }

  if (fieldsToAdd.length === 0) {
    return psbtBase64;
  }

  return patchPsbtInputFields(psbtBase64, fieldsToAdd);
}

/**
 * Patch arbitrary fields into PSBT input maps
 */
function patchPsbtInputFields(
  psbtBase64: string,
  fieldsToAdd: Array<{
    inputIndex: number;
    fields: Array<{ keyType: number; key: Buffer; value: Buffer }>;
  }>
): string {
  const psbtBuffer = Buffer.from(psbtBase64, 'base64');
  const parts: Buffer[] = [];
  let offset = 0;

  // PSBT magic bytes
  if (psbtBuffer.slice(0, 5).toString('hex') !== '70736274ff') {
    throw new Error('Invalid PSBT magic');
  }
  parts.push(psbtBuffer.slice(0, 5));
  offset = 5;

  // Parse global map
  const globalStart = offset;
  while (psbtBuffer[offset] !== 0x00) {
    const keyLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(keyLen.value);
    offset += keyLen.value;
    const valLen = readVarInt(psbtBuffer, offset);
    offset += varIntSize(valLen.value);
    offset += valLen.value;
  }
  parts.push(psbtBuffer.slice(globalStart, offset + 1));
  offset++;

  // Count inputs
  const inputCount = countPsbtInputs(psbtBuffer, 5);

  // Parse each input map and add fields
  for (let inputIdx = 0; inputIdx < inputCount; inputIdx++) {
    const inputParts: Buffer[] = [];

    // Read existing key-value pairs, filtering out duplicates
    const existingKeyTypes = new Set<number>();
    while (psbtBuffer[offset] !== 0x00) {
      const kvStart = offset;
      const keyLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(keyLen.value);
      const keyStart = offset;
      offset += keyLen.value;
      const valLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(valLen.value);
      offset += valLen.value;

      // Track existing key types
      if (keyLen.value >= 1) {
        existingKeyTypes.add(psbtBuffer[keyStart]);
      }

      inputParts.push(psbtBuffer.slice(kvStart, offset));
    }

    // Add new fields for this input (if not already present)
    const fieldsForInput = fieldsToAdd.find(f => f.inputIndex === inputIdx);
    if (fieldsForInput) {
      for (const field of fieldsForInput.fields) {
        if (!existingKeyTypes.has(field.keyType)) {
          const kv = createPsbtKv(field.key, field.value);
          inputParts.push(kv);
        }
      }
    }

    // Write input map with terminator
    for (const part of inputParts) {
      parts.push(part);
    }
    parts.push(Buffer.from([0x00]));
    offset++;
  }

  // Copy remaining output maps unchanged
  parts.push(psbtBuffer.slice(offset));

  const result = Buffer.concat(parts);
  return result.toString('base64');
}

/**
 * Extract OP_RETURN output from PSBT's unsigned transaction for debugging
 * Returns the hex of the OP_RETURN scriptPubKey or null if not found
 */
function extractOpReturnFromPsbt(psbtBase64: string): string | null {
  try {
    const psbtBuffer = Buffer.from(psbtBase64, 'base64');
    let offset = 5; // skip magic

    // Find unsigned tx in global map
    while (psbtBuffer[offset] !== 0x00) {
      const keyLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(keyLen.value);
      const keyStart = offset;
      offset += keyLen.value;
      const valLen = readVarInt(psbtBuffer, offset);
      offset += varIntSize(valLen.value);

      // Check if this is unsigned tx (key type 0x00)
      if (keyLen.value === 1 && psbtBuffer[keyStart] === 0x00) {
        const txStart = offset;
        let txOffset = txStart;
        txOffset += 4; // version

        // Check for witness marker
        if (psbtBuffer[txOffset] === 0x00 && psbtBuffer[txOffset + 1] === 0x01) {
          txOffset += 2;
        }

        // Skip inputs
        const inputCount = readVarInt(psbtBuffer, txOffset);
        txOffset += varIntSize(inputCount.value);
        for (let i = 0; i < inputCount.value; i++) {
          txOffset += 32; // txid
          txOffset += 4;  // vout
          const scriptLen = readVarInt(psbtBuffer, txOffset);
          txOffset += varIntSize(scriptLen.value) + scriptLen.value;
          txOffset += 4;  // sequence
        }

        // Read outputs
        const outputCount = readVarInt(psbtBuffer, txOffset);
        txOffset += varIntSize(outputCount.value);

        for (let i = 0; i < outputCount.value; i++) {
          txOffset += 8; // value (8 bytes)
          const scriptLen = readVarInt(psbtBuffer, txOffset);
          txOffset += varIntSize(scriptLen.value);
          const scriptPubKey = psbtBuffer.slice(txOffset, txOffset + scriptLen.value);
          txOffset += scriptLen.value;

          // Check if OP_RETURN (starts with 0x6a)
          if (scriptPubKey[0] === 0x6a) {
            return scriptPubKey.toString('hex');
          }
        }
      }

      offset += valLen.value;
    }
    return null;
  } catch (e) {
    return `error: ${e}`;
  }
}

/**
 * Encode a witness stack into the format used in PSBT_IN_FINAL_SCRIPTWITNESS
 */
function encodeWitnessStack(witness: Buffer[]): Buffer {
  const parts: Buffer[] = [];

  // Witness item count as varint
  const countBuf = Buffer.allocUnsafe(varIntSize(witness.length));
  writeVarInt(countBuf, witness.length, 0);
  parts.push(countBuf);

  // Each witness element: length (varint) + data
  for (const item of witness) {
    const lenBuf = Buffer.allocUnsafe(varIntSize(item.length));
    writeVarInt(lenBuf, item.length, 0);
    parts.push(lenBuf);
    parts.push(item);
  }

  return Buffer.concat(parts);
}

/**
 * Fetches the protocol contract from the ord server
 */
export async function fetchProtocolContract(): Promise<ProtocolProfile> {
  logger.debug('[VaultWalletService] Fetching protocol contract...');

  const res = await OracleAPI.proto.fetch_master_ctx(API.ORD_URL, MASTER_CONTRACT_ID);

  if (!res.ok) {
    throw new Error(`Failed to fetch protocol: ${res.error}`);
  }

  logger.debug('[VaultWalletService] Protocol contract fetched');
  return res.data;
}

/**
 * Pre-process PSBT before signing (add redeemScript, tapInternalKey)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function psbtPreProcess(client: VaultWallet, pdata: any, manifest: Record<string, number[]>) {
  const sats_pkh = hash160(client.acct.sats.pubkey);
  const runes_tpk = taptweak_pubkey(client.acct.runes.pubkey);

  for (const [address, inputs] of Object.entries(manifest)) {
    const addr_meta = TX.parse_address(address);
    for (const idx of inputs) {
      const txinput = pdata.getInput(idx);
      const prevout = txinput.witnessUtxo;

      if (prevout === undefined) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const script_meta = TX.parse_script_meta(prevout.script as any);
      const script_type = script_meta.type;
      const script_key = script_meta.key?.hex;

      if (script_key === undefined) continue;

      // Handle P2SH (wrapped segwit)
      if (script_type === 'p2sh' && script_key === addr_meta.key) {
        const script = `0014${sats_pkh}`;
        if (!txinput.redeemScript) {
          try {
            pdata.updateInput(idx, {
              redeemScript: Buff.hex(script),
              finalScriptSig: Buff.hex(script),
            });
          } catch (error) {
            // Ignore duplicate errors
          }
        }
      }

      // Handle P2WPKH (native segwit)
      if (script_type === 'p2w-pkh' && script_key === sats_pkh) {
        // No pre-processing needed for native segwit
      }

      // Handle P2TR (taproot)
      if (script_type === 'p2tr') {
        if (script_key === runes_tpk) {
          pdata.updateInput(idx, {
            tapInternalKey: Buff.hex(client.acct.runes.pubkey),
          });
        }
      }
    }
  }
}

/**
 * Post-process PSBT after signing (finalize witnesses)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function psbtPostProcess(client: VaultWallet, pdata: any, manifest: Record<string, number[]>) {
  const vault_pk = client.acct.vault.pubkey;

  for (const [_, inputs] of Object.entries(manifest)) {
    for (const idx of inputs) {
      const txinput = pdata.getInput(idx);
      const prevout = txinput.witnessUtxo;

      if (prevout === undefined) continue;

      const redeem_script = txinput.redeemScript;
      const segwit_sig = txinput.partialSig?.at(0);
      const scriptSig = txinput.finalScriptSig;
      const tapkey_sig = txinput.tapKeySig;
      const tapscript_sig = txinput.tapScriptSig;
      const final_witness = txinput.finalScriptWitness;
      let witness: Uint8Array[] = final_witness ?? [];

      // Handle partial signatures (segwit)
      if (segwit_sig !== undefined && witness.length === 0) {
        witness.push(...segwit_sig.reverse());
      }

      // Handle redeem script
      if (redeem_script !== undefined && scriptSig === undefined) {
        witness.push(redeem_script);
      }

      // Handle taproot key-spend
      if (tapkey_sig !== undefined && witness.length === 0) {
        witness.push(tapkey_sig);
      }

      // Handle taproot script-spend
      if (tapscript_sig !== undefined) {
        const elem = witness?.at(0);
        if (elem !== undefined) {
          const elem_hex = new Buff(elem).hex;
          if (elem_hex === vault_pk) {
            witness = witness.slice(1);
          }
        }
      }

      // Finalize the witness
      if (witness.length > 0) {
        pdata.updateInput(idx, { finalScriptWitness: witness });
      }
    }
  }
}

/**
 * Creates a WalletConnectAPI for the mobile wallet
 */
function createMobileWalletAPI(segwitAddress: string): WalletConnectAPI {
  return {
    fetch: {
      balance: (_client: VaultWallet) => async () => {
        const res = await OracleAPI.wallet.fetch_address_bal(API.ORD_URL, segwitAddress);
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },

      sats_utxos: (client: VaultWallet) => async () => {
        const addr = client.acct.sats.address;
        const res = await OracleAPI.esplora.esplora_get_utxos(API.ESPLORA_URL, addr);
        if (!res.ok) throw new Error(res.error);

        // Parse address to get the locking script
        const script = TX.parse_address(addr).hex;
        return res.data.map((e) => ({
          txid: e.txid,
          vout: e.vout,
          value: e.value,
          script,
        }));
      },

      rune_utxos: (client: VaultWallet) => async () => {
        const addr = client.acct.runes.address;
        const res = await OracleAPI.wallet.fetch_rune_utxos(API.ORD_URL, addr);
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },

      vault_tokens: (client: VaultWallet) => async () => {
        const address = client.acct.vault.address;
        const postage = client.config.postage.vault;
        const res = await OracleAPI.wallet.fetch_vault_tokens(
          API.ESPLORA_URL,
          API.ORD_URL,
          address,
          postage
        );
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },
    },

    sign: {
      psbt: (client: VaultWallet) => async (psbt: string, manifest: Record<string, number[]>) => {
        logger.debug('[VaultWalletService] Signing PSBT with pre/post processing...');
        logger.debug('[VaultWalletService] Manifest:', JSON.stringify(manifest));

        // Pre-process the PSBT (same as frontend sign_psbt_api)
        const pre_pdata = PSBT.decode(psbt);
        logger.debug('[VaultWalletService] PSBT decoded, inputs:', pre_pdata.inputsLength);

        // Log input details
        for (let i = 0; i < pre_pdata.inputsLength; i++) {
          const txin = pre_pdata.getInput(i);
          const prevout = txin.witnessUtxo;
          if (prevout) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const scriptMeta = TX.parse_script_meta(prevout.script as any);
            logger.debug(`[VaultWalletService] Input ${i}: type=${scriptMeta.type}, hasTapLeafScript=${!!txin.tapLeafScript}`);
          }
        }

        psbtPreProcess(client, pre_pdata, manifest);

        // Sign with the mobile wallet
        const prePsbt = PSBT.encode(pre_pdata);
        const signedPsbt = await signPsbtRaw(prePsbt, manifest);

        // Post-process the signed PSBT (same as frontend sign_psbt_api)
        const post_pdata = PSBT.decode(signedPsbt);
        psbtPostProcess(client, post_pdata, manifest);

        logger.debug('[VaultWalletService] PSBT signed and post-processed');
        return PSBT.encode(post_pdata);
      },

      utxos: (client: VaultWallet) => async (psbt: string) => {
        const satsAddr = client.acct.sats.address;
        const runesAddr = client.acct.runes.address;
        const sats_pkh = hash160(client.acct.sats.pubkey);
        const runes_tpk = taptweak_pubkey(client.acct.runes.pubkey);

        // Build manifest by analyzing the PSBT
        const pdata = PSBT.decode(psbt);
        const manifest: Record<string, number[]> = {
          [satsAddr]: [],
          [runesAddr]: [],
        };

        for (let i = 0; i < pdata.inputsLength; i++) {
          const txinput = pdata.getInput(i);
          const prevout = txinput.witnessUtxo;

          if (prevout === undefined) continue;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const meta = TX.parse_script_meta(prevout.script as any);
          if (meta.key === undefined) continue;

          if (meta.type === 'p2w-pkh' && meta.key.hex === sats_pkh) {
            manifest[satsAddr].push(i);
          }

          if (meta.type === 'p2tr' && meta.key.hex === runes_tpk) {
            manifest[runesAddr].push(i);
          }
        }

        logger.debug('[VaultWalletService] Signing UTXOs...');

        // Pre-process
        psbtPreProcess(client, pdata, manifest);

        // Sign
        const prePsbt = PSBT.encode(pdata);
        const signedPsbt = await signPsbtRaw(prePsbt, manifest);

        // Post-process
        const post_pdata = PSBT.decode(signedPsbt);
        psbtPostProcess(client, post_pdata, manifest);

        const finalPsbt = PSBT.encode(post_pdata);
        logger.debug('[VaultWalletService] UTXOs signed');
        return finalPsbt;
      },

      batch: (client: VaultWallet) => async (psbts: [string, Record<string, number[]>][]) => {
        logger.debug(`[VaultWalletService] Batch signing ${psbts.length} PSBTs...`);

        // Process each PSBT using binary patching to preserve OP_RETURN outputs
        // Both bitcoinjs-lib and @scure/btc-signer corrupt OP_RETURN during encode
        const signedPsbts: string[] = [];

        for (let psbtIndex = 0; psbtIndex < psbts.length; psbtIndex++) {
          const [originalPsbt, signInputs] = psbts[psbtIndex];
          logger.debug(`[VaultWalletService] Processing PSBT ${psbtIndex + 1}/${psbts.length}`);
          logger.debug(`[VaultWalletService] Manifest: ${JSON.stringify(signInputs)}`);

          // ===== DEBUG: Trace OP_RETURN through the signing process =====
          const originalOpReturn = extractOpReturnFromPsbt(originalPsbt);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} ORIGINAL OP_RETURN: ${originalOpReturn}`);

          // Step 1: Pre-process to add fields needed for signing (redeemScript, tapInternalKey)
          // We patch these into the original PSBT binary
          const preProcessedPsbt = patchPreProcessFields(originalPsbt, client, signInputs);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} pre-processed`);

          const preProcessedOpReturn = extractOpReturnFromPsbt(preProcessedPsbt);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} AFTER PRE-PROCESS OP_RETURN: ${preProcessedOpReturn}`);

          // Step 2: Sign using binary patching (preserves OP_RETURN outputs)
          const pre_pdata = PSBT.decode(preProcessedPsbt);
          const signedPsbt = await signPsbtWithSdkObject(pre_pdata, signInputs, preProcessedPsbt);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} signed`);

          const signedOpReturn = extractOpReturnFromPsbt(signedPsbt);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} AFTER SIGNING OP_RETURN: ${signedOpReturn}`);

          // Step 3: Post-process (finalize witnesses) - only first 2 PSBTs
          let finalPsbt = signedPsbt;
          if (psbtIndex < 2) {
            finalPsbt = patchPostProcessFields(signedPsbt, client, signInputs);
            logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} post-processed`);

            const postProcessedOpReturn = extractOpReturnFromPsbt(finalPsbt);
            logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} AFTER POST-PROCESS OP_RETURN: ${postProcessedOpReturn}`);
          }

          // Final check
          const finalOpReturn = extractOpReturnFromPsbt(finalPsbt);
          logger.debug(`[VaultWalletService] PSBT ${psbtIndex + 1} FINAL OP_RETURN: ${finalOpReturn}`);
          // ===== END DEBUG =====

          signedPsbts.push(finalPsbt);
        }

        logger.debug('[VaultWalletService] Batch signing complete');
        return signedPsbts;
      },
    },
  };
}

export interface MobileWalletInfo {
  segwitAddress: string;
  segwitPubkey: string;
  taprootAddress: string;
  taprootPubkey: string;
}

/**
 * Creates a VaultWallet instance for the mobile app
 */
export async function createVaultWallet(walletInfo: MobileWalletInfo): Promise<VaultWallet> {
  logger.debug('[VaultWalletService] Creating VaultWallet...');

  // Fetch the protocol contract
  const contract = await fetchProtocolContract();

  // Create account record from mobile wallet
  const accounts: WalletAccountRecord = {
    sats: {
      address: walletInfo.segwitAddress,
      pubkey: walletInfo.segwitPubkey,
    },
    runes: {
      address: walletInfo.taprootAddress,
      pubkey: walletInfo.taprootPubkey,
    },
    vault: {
      address: walletInfo.taprootAddress,
      pubkey: walletInfo.taprootPubkey,
    },
  };

  // Create the wallet connect API
  const walletAPI = createMobileWalletAPI(walletInfo.segwitAddress);

  // Create the VaultWallet
  const vaultWallet = new VaultWallet(accounts, contract, walletAPI, WALLET_CFG);

  logger.debug('[VaultWalletService] VaultWallet created');
  return vaultWallet;
}
