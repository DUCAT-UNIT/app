/**
 * Unified PSBT Signing Service
 *
 * Consolidates PSBT signing functionality from:
 * - utils/wallet/psbtSigning.ts (wallet-level signing for BTC/UNIT sends)
 * - services/vaultWallet/psbtSigning.ts (vault-specific signing with SDK)
 *
 * This service provides a single, unified interface for all PSBT signing operations.
 */

import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import type { VaultWallet } from '@ducat-unit/client-sdk';
import { TX, PSBT, hash160, taptweak_pubkey } from '@ducat-unit/client-sdk/util';
import { Buff } from '@cmdcode/buff';

import { MUTINYNET_NETWORK } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import type { SignatureData, PsbtFieldData, PsbtSigningOptions } from './types';
import {
  withSigningContext,
  getAddressTypeInfo,
  deriveKeyPair,
  getSegwitKeyPair,
  extractWitnessData,
  signSegwitInput,
  signAndFinalizeSegwitInput,
  signTaprootScriptPath,
  signTaprootKeyPath,
  isScriptPathSpend,
  computeTapleafHash,
  getTaprootSighash,
  ensurePrivateKeyBuffer,
  negatePrivateKeyIfNeeded,
  tweakPrivateKey,
  signSchnorr,
  getXOnlyPubkey,
} from './cryptoUtils';
import {
  patchPsbtSignatures,
  patchPsbtInputFields,
  encodeWitnessStack,
} from '../vaultWallet/psbtBinaryUtils';

/**
 * Sign a PSBT with the mobile wallet (with finalization)
 *
 * This is the standard signing function for wallet-level operations
 * like BTC and UNIT sends. It signs and finalizes inputs.
 *
 * @param psbtBase64 - PSBT in base64 format
 * @param signInputs - Map of addresses to input indices to sign
 * @returns Signed PSBT in base64 format
 */
export async function signPsbt(
  psbtBase64: string,
  signInputs: Record<string, number[]>
): Promise<string> {
  return withSigningContext(async (mnemonic, accountIndex) => {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

    for (const [address, inputIndices] of Object.entries(signInputs)) {
      const scriptHex = ''; // Will be determined by address prefix
      const { derivationPath } = getAddressTypeInfo(address, scriptHex, accountIndex);
      const keyPair = deriveKeyPair(mnemonic, derivationPath);

      for (const inputIndex of inputIndices) {
        if (address.startsWith('tb1p')) {
          // Taproot signing
          const input = psbt.data.inputs[inputIndex];
          if (isScriptPathSpend(input)) {
            const sigData = signTaprootScriptPath(psbt, inputIndex, keyPair);
            psbt.updateInput(inputIndex, {
              tapScriptSig: [{
                pubkey: sigData.pubkey!,
                leafHash: sigData.leafHash!,
                signature: sigData.signature,
              }],
            });
          } else {
            signKeyPathWithFallback(psbt, inputIndex, keyPair);
          }
        } else if (address.startsWith('tb1q')) {
          // SegWit signing with finalization
          const ecKeyPair = getSegwitKeyPair(mnemonic, accountIndex);
          signAndFinalizeSegwitInput(psbt, inputIndex, ecKeyPair);
        } else {
          throw new Error(`Unsupported address type: ${address}`);
        }
      }
    }

    return psbt.toBase64();
  });
}

/**
 * Sign a PSBT without finalization (for SDK compatibility)
 *
 * This function signs inputs but does NOT finalize them,
 * allowing the SDK to handle finalization.
 *
 * @param psbtBase64 - PSBT in base64 format
 * @param signInputs - Map of addresses to input indices to sign
 * @returns Signed PSBT in base64 format
 */
export async function signPsbtRaw(
  psbtBase64: string,
  signInputs: Record<string, number[]>
): Promise<string> {
  return withSigningContext(async (mnemonic, accountIndex) => {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

    logger.debug(`[signPsbtRaw] Loaded PSBT with ${psbt.inputCount} inputs`);

    for (const [address, inputIndices] of Object.entries(signInputs)) {
      for (const inputIndex of inputIndices) {
        const input = psbt.data.inputs[inputIndex];
        if (!input.witnessUtxo) {
          logger.warn(`[signPsbtRaw] No witnessUtxo for input ${inputIndex}`);
          continue;
        }

        const scriptHex = Buffer.from(input.witnessUtxo.script).toString('hex');
        const { isSegwit, isTaproot, derivationPath } = getAddressTypeInfo(
          address,
          scriptHex,
          accountIndex
        );

        logger.debug(`[signPsbtRaw] Input ${inputIndex}: isSegwit=${isSegwit}, isTaproot=${isTaproot}`);

        if (isSegwit || address.startsWith('tb1q')) {
          // SegWit signing without finalization
          const ecKeyPair = getSegwitKeyPair(mnemonic, accountIndex);
          psbt.signInput(inputIndex, ecKeyPair);

          // Log signature info
          const signedInput = psbt.data.inputs[inputIndex];
          logger.debug(`[signPsbtRaw] After sign: partialSig exists: ${!!signedInput.partialSig}`);
        } else if (isTaproot || address.startsWith('tb1p')) {
          // Taproot signing
          const keyPair = deriveKeyPair(mnemonic, derivationPath);

          if (isScriptPathSpend(input)) {
            logger.debug(`[signPsbtRaw] Using SCRIPT-PATH signing for Taproot (manual Schnorr)`);
            const sigData = signTaprootScriptPath(psbt, inputIndex, keyPair);
            psbt.updateInput(inputIndex, {
              tapScriptSig: [{
                pubkey: sigData.pubkey!,
                leafHash: sigData.leafHash!,
                signature: sigData.signature,
              }],
            });
          } else {
            logger.debug(`[signPsbtRaw] Using KEY-PATH signing for Taproot`);
            const sigData = signTaprootKeyPath(psbt, inputIndex, keyPair);
            psbt.updateInput(inputIndex, { tapKeySig: sigData.signature });
            logger.debug(`[signPsbtRaw] tapKeySig set for key-path (${sigData.signature.length} bytes)`);
          }
        }

        logger.debug(`[signPsbtRaw] Signed input ${inputIndex} for ${address}`);
      }
    }

    const signedPsbt = psbt.toBase64();
    logger.debug(`[signPsbtRaw] Signed PSBT encoded`);
    return signedPsbt;
  });
}

/**
 * Sign a PSBT with SDK object (vault operations)
 *
 * This function is specifically for vault operations that need to
 * preserve OP_RETURN outputs. It uses binary patching to inject
 * signatures without re-encoding the transaction.
 *
 * @param sdkPdata - SDK PSBT data object
 * @param signInputs - Map of addresses to input indices to sign
 * @param originalPsbtBase64 - Optional original PSBT to preserve OP_RETURN
 * @returns Signed PSBT in base64 format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function signPsbtWithSdkObject(
  sdkPdata: any,
  signInputs: Record<string, number[]>,
  originalPsbtBase64?: string
): Promise<string> {
  return withSigningContext(async (mnemonic, accountIndex) => {
    // Use original PSBT if provided, otherwise encode from SDK object
    const psbtBase64 = originalPsbtBase64 || PSBT.encode(sdkPdata);

    // Decode with bitcoinjs-lib for sighash computation
    const bjsPsbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

    logger.debug(`[signPsbtWithSdkObject] Processing ${Object.keys(signInputs).length} addresses`);

    // Collect signatures to inject
    const signatures: SignatureData[] = [];

    for (const [address, inputIndices] of Object.entries(signInputs)) {
      for (const inputIndex of inputIndices) {
        const bjsInput = bjsPsbt.data.inputs[inputIndex];
        if (!bjsInput.witnessUtxo) {
          logger.warn(`[signPsbtWithSdkObject] No witnessUtxo for input ${inputIndex}`);
          continue;
        }

        const scriptHex = Buffer.from(bjsInput.witnessUtxo.script).toString('hex');
        const { isSegwit, isTaproot, derivationPath } = getAddressTypeInfo(
          address,
          scriptHex,
          accountIndex
        );

        logger.debug(`[signPsbtWithSdkObject] Input ${inputIndex}: isSegwit=${isSegwit}, isTaproot=${isTaproot}`);

        if (isSegwit || address.startsWith('tb1q')) {
          // SegWit signing
          const ecKeyPair = getSegwitKeyPair(mnemonic, accountIndex);
          const sigData = signSegwitInput(bjsPsbt, inputIndex, ecKeyPair);
          if (sigData) {
            signatures.push(sigData);
            logger.debug(`[signPsbtWithSdkObject] SegWit signature computed for input ${inputIndex}`);
          }
        } else if (isTaproot || address.startsWith('tb1p')) {
          // Taproot signing
          const keyPair = deriveKeyPair(mnemonic, derivationPath);

          if (isScriptPathSpend(bjsInput)) {
            const sigData = signTaprootScriptPath(bjsPsbt, inputIndex, keyPair);
            signatures.push(sigData);
            logger.debug(`[signPsbtWithSdkObject] Taproot script-path signature computed for input ${inputIndex}`);
          } else {
            const sigData = signTaprootKeyPath(bjsPsbt, inputIndex, keyPair);
            signatures.push(sigData);
            logger.debug(`[signPsbtWithSdkObject] Taproot key-path signature computed for input ${inputIndex}`);
          }
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

  const fieldsToAdd: PsbtFieldData[] = [];

  const bjsPsbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

  for (const [address, inputs] of Object.entries(manifest)) {
    const addr_meta = TX.parse_address(address);
    for (const idx of inputs) {
      const txinput = bjsPsbt.data.inputs[idx];
      const prevout = txinput.witnessUtxo;

      if (prevout === undefined) continue;

      const scriptHex = Buffer.from(prevout.script).toString('hex');
      const fields: Array<{ keyType: number; key: Buffer; value: Buffer }> = [];

      // Handle P2SH (wrapped segwit)
      if (scriptHex.startsWith('a914')) {
        const redeemScript = `0014${sats_pkh}`;
        const redeemScriptBuf = Buffer.from(redeemScript, 'hex');
        // PSBT_IN_REDEEM_SCRIPT (0x04)
        fields.push({ keyType: 0x04, key: Buffer.from([0x04]), value: redeemScriptBuf });
        // PSBT_IN_FINAL_SCRIPTSIG (0x07)
        const scriptSigLen = redeemScriptBuf.length;
        const finalScriptSig = Buffer.concat([Buffer.from([scriptSigLen]), redeemScriptBuf]);
        fields.push({ keyType: 0x07, key: Buffer.from([0x07]), value: finalScriptSig });
      }

      // Handle P2TR (taproot)
      if (scriptHex.startsWith('5120')) {
        const scriptKey = scriptHex.slice(4);
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
    return psbtBase64;
  }

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

  const fieldsToAdd: PsbtFieldData[] = [];

  const bjsPsbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

  for (const [_, inputs] of Object.entries(manifest)) {
    for (const idx of inputs) {
      const txinput = bjsPsbt.data.inputs[idx];
      const prevout = txinput.witnessUtxo;

      if (prevout === undefined) continue;
      if (txinput.finalScriptWitness) continue;

      const fields: Array<{ keyType: number; key: Buffer; value: Buffer }> = [];
      let witness: Buffer[] = [];

      // Handle partial signatures (segwit)
      const segwit_sig = txinput.partialSig?.at(0);
      if (segwit_sig !== undefined && witness.length === 0) {
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
 * Works with SDK PSBT data objects
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function psbtPreProcess(
  client: VaultWallet,
  pdata: any,
  manifest: Record<string, number[]>
): void {
  const sats_pkh = hash160(client.acct.sats.pubkey);
  const runes_tpk = taptweak_pubkey(client.acct.runes.pubkey);

  for (const [address, inputs] of Object.entries(manifest)) {
    const addr_meta = TX.parse_address(address);
    for (const idx of inputs) {
      const txinput = pdata.getInput(idx);
      const prevout = txinput.witnessUtxo;

      if (prevout === undefined) continue;

      // SDK type mismatch: script is Uint8Array but SDK expects string | Bytes
      const script_meta = TX.parse_script_meta(prevout.script as Parameters<typeof TX.parse_script_meta>[0]);
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
 * Works with SDK PSBT data objects
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function psbtPostProcess(
  client: VaultWallet,
  pdata: any,
  manifest: Record<string, number[]>
): void {
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
 * Sign key-path with fallback to manual signing
 * Used when bitcoinjs-lib standard signing fails
 */
function signKeyPathWithFallback(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  keyPair: { privateKey?: Uint8Array; publicKey: Uint8Array; tweak: (t: Buffer) => unknown }
): void {
  const xOnlyPubkey = Buffer.from(keyPair.publicKey.slice(1, 33));

  try {
    const tweakHash = Buffer.from(bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey));
    const tweakedSigner = keyPair.tweak(tweakHash);
    psbt.signInput(inputIndex, tweakedSigner as bitcoin.Signer);
  } catch (error: unknown) {
    // Fall back to manual signing
    const { scripts, values } = extractWitnessData(psbt);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const psbtCache = (psbt as any).__CACHE;
    const tx = psbtCache.__TX.clone();
    const sighash = Buffer.from(tx.hashForWitnessV1(
      inputIndex,
      scripts,
      values,
      bitcoin.Transaction.SIGHASH_DEFAULT
    ));

    const tweakHash = Buffer.from(bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey));
    const tweakedSigner = keyPair.tweak(tweakHash);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tweakedKeyPair = tweakedSigner as any;
    if (!tweakedKeyPair.privateKey) {
      throw new Error('Tweaked key pair is missing private key for signing');
    }
    const signature = signSchnorr(sighash, Buffer.from(tweakedKeyPair.privateKey));
    psbt.updateInput(inputIndex, { tapKeySig: signature });
  }
}
