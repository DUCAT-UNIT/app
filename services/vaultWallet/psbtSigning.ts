/**
 * PSBT Signing Functions
 */

import type { VaultWallet } from '@ducat-unit/client-sdk';
import { TX, PSBT, hash160, taptweak_pubkey } from '@ducat-unit/client-sdk/util';
import { Buff } from '@cmdcode/buff';
import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../../utils/constants';
import { MUTINYNET_NETWORK } from '../../utils/bitcoin';
import { withMnemonic } from '../secureStorageService';
import {
  bip32,
  ecc,
  getECPair,
  varIntSize,
  writeVarInt,
} from '../../utils/wallet/cryptoHelpers';
import { logger } from '../../utils/logger';
import type { PsbtCache, SignatureData, PsbtFieldData } from './types';
import {
  patchPsbtSignatures,
  patchPsbtInputFields,
  encodeWitnessStack,
} from './psbtBinaryUtils';

/**
 * Sign a PSBT while preserving OP_RETURN outputs.
 *
 * Strategy:
 * 1. Save original PSBT base64 (has correct OP_RETURN)
 * 2. Decode with bitcoinjs-lib for sighash computation and signing
 * 3. Sign inputs
 * 4. Extract the unsigned transaction from original PSBT
 * 5. Patch signatures into the original PSBT binary without re-encoding outputs
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function signPsbtWithSdkObject(sdkPdata: any, signInputs: Record<string, number[]>, originalPsbtBase64?: string): Promise<string> {
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
    const signatures: SignatureData[] = [];

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
 * Patch pre-processing fields (redeemScript, tapInternalKey) into PSBT binary
 */
export function patchPreProcessFields(
  psbtBase64: string,
  client: VaultWallet,
  manifest: Record<string, number[]>
): string {
  const sats_pkh = hash160(client.acct.sats.pubkey);
  const runes_tpk = taptweak_pubkey(client.acct.runes.pubkey);

  // Collect fields to add
  const fieldsToAdd: PsbtFieldData[] = [];

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
export function patchPostProcessFields(
  psbtBase64: string,
  client: VaultWallet,
  manifest: Record<string, number[]>
): string {
  const vault_pk = client.acct.vault.pubkey;

  // Collect fields to add
  const fieldsToAdd: PsbtFieldData[] = [];

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
 * Pre-process PSBT before signing (add redeemScript, tapInternalKey)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function psbtPreProcess(client: VaultWallet, pdata: any, manifest: Record<string, number[]>) {
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
export function psbtPostProcess(client: VaultWallet, pdata: any, manifest: Record<string, number[]>) {
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
