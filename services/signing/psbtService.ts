/**
 * Unified PSBT Signing Service
 *
 * Consolidates PSBT signing functionality from:
 * - utils/wallet/psbtSigning.ts (wallet-level signing for BTC/UNIT sends)
 * - services/vaultWallet/psbtSigning.ts (vault-specific signing with SDK)
 *
 * This service provides a single, unified interface for all PSBT signing operations.
 */

import { Buff } from '@cmdcode/buff';
import type { Transaction as SdkTransaction,VaultWallet } from '@ducat-unit/client-sdk';
import { PSBT,TX,hash160,taptweak_pubkey } from '@ducat-unit/client-sdk/util';
import * as bitcoin from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import { MUTINYNET_NETWORK,MUTINYNET_NETWORK as NETWORK,validateAndNormalizeAddress } from '../../utils/bitcoin';
import { logger } from '../../utils/logger';
import {
encodeWitnessStack,
patchPsbtInputFields,
patchPsbtSignatures,
} from '../vaultWallet/psbtBinaryUtils';
import type { ExpectedPsbtTemplate } from '../vaultWallet/signingContext';
import {
deriveKeyPair,
extractWitnessData,
getAddressTypeInfo,
getSegwitKeyPair,
isScriptPathSpend,
signAndFinalizeSegwitInput,
signSchnorr,
signSegwitInput,
signTaprootKeyPath,
signTaprootScriptPath,
validateSighashType,
withSigningContext
} from './cryptoUtils';
import type { PsbtCache,PsbtFieldData,SignatureData } from './types';

interface PsbtSigningIntent {
  recipient: string;
  change?: string;
  minAmountSats?: number;
  allowOpReturn?: boolean;
  expectedPsbtTemplates?: ExpectedPsbtTemplate[];
  externalSpend?: {
    /** Wallet-controlled addresses that are allowed to receive change/asset outputs. */
    returnAddresses: string[];
    /** Maximum signed-input value that may leave the wallet, including miner fee. */
    maxSpendSats: number;
    /** Wallet-controlled outputs that must appear in the PSBT. */
    requiredOutputAddresses?: string[];
  };
}

const TAPROOT_PREFIX = `${NETWORK.bech32}1p`;
const SEGWIT_PREFIX = `${NETWORK.bech32}1q`;

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
  signInputs: Record<string, number[]>,
  intent: PsbtSigningIntent
): Promise<string> {
  return withSigningContext(async (mnemonic, accountIndex, derivationMode) => {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

    enforceIntentOutputs(psbt, intent, signInputs);

    for (const [address, inputIndices] of Object.entries(signInputs)) {
      const scriptHex = ''; // Will be determined by address prefix
      const { derivationPath } = getAddressTypeInfo(address, scriptHex, accountIndex, derivationMode);
      const keyPair = deriveKeyPair(mnemonic, derivationPath);

      for (const inputIndex of inputIndices) {
        if (address.toLowerCase().startsWith(TAPROOT_PREFIX)) {
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
        } else if (address.toLowerCase().startsWith(SEGWIT_PREFIX)) {
          // SegWit signing with finalization
          const ecKeyPair = getSegwitKeyPair(mnemonic, accountIndex, derivationMode);
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
  signInputs: Record<string, number[]>,
  intent: PsbtSigningIntent
): Promise<string> {
  return withSigningContext(async (mnemonic, accountIndex, derivationMode) => {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

    enforceIntentOutputs(psbt, intent, signInputs);
    logger.debug(`[signPsbtRaw] Loaded PSBT with ${psbt.inputCount} inputs`);

    for (const [address, inputIndices] of Object.entries(signInputs)) {
      for (const inputIndex of inputIndices) {
        const input = psbt.data.inputs[inputIndex];
        if (!input.witnessUtxo) {
          throw new Error(`SECURITY: Missing witnessUtxo for requested input ${inputIndex}`);
        }

        const scriptHex = Buffer.from(input.witnessUtxo.script).toString('hex');
        const { isSegwit, isTaproot, derivationPath } = getAddressTypeInfo(
          address,
          scriptHex,
          accountIndex,
          derivationMode
        );

        logger.debug(`[signPsbtRaw] Input ${inputIndex}: isSegwit=${isSegwit}, isTaproot=${isTaproot}`);

        if (isSegwit || address.toLowerCase().startsWith(SEGWIT_PREFIX)) {
          // SegWit signing without finalization
          validateSighashType(input.sighashType, 'segwit');
          const ecKeyPair = getSegwitKeyPair(mnemonic, accountIndex, derivationMode);
          psbt.signInput(inputIndex, ecKeyPair);

          // Log signature info
          const signedInput = psbt.data.inputs[inputIndex];
          logger.debug(`[signPsbtRaw] After sign: partialSig exists: ${!!signedInput.partialSig}`);
        } else if (isTaproot || address.toLowerCase().startsWith(TAPROOT_PREFIX)) {
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
export async function signPsbtWithSdkObject(
  sdkPdata: SdkTransaction,
  signInputs: Record<string, number[]>,
  originalPsbtBase64?: string,
  intent?: PsbtSigningIntent
): Promise<string> {
  return withSigningContext(async (mnemonic, accountIndex, derivationMode) => {
    // Use original PSBT if provided, otherwise encode from SDK object
    const psbtBase64 = originalPsbtBase64 || PSBT.encode(sdkPdata);

    // Decode with bitcoinjs-lib for sighash computation
    const bjsPsbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

    enforceIntentOutputs(bjsPsbt, intent, signInputs);

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
          accountIndex,
          derivationMode
        );

        logger.debug(`[signPsbtWithSdkObject] Input ${inputIndex}: isSegwit=${isSegwit}, isTaproot=${isTaproot}`);

        if (isSegwit || address.toLowerCase().startsWith(SEGWIT_PREFIX)) {
          // SegWit signing
          const ecKeyPair = getSegwitKeyPair(mnemonic, accountIndex, derivationMode);
          const sigData = signSegwitInput(bjsPsbt, inputIndex, ecKeyPair);
          if (sigData) {
            signatures.push(sigData);
            logger.debug(`[signPsbtWithSdkObject] SegWit signature computed for input ${inputIndex}`);
          }
        } else if (isTaproot || address.toLowerCase().startsWith(TAPROOT_PREFIX)) {
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

  for (const [, inputs] of Object.entries(manifest)) {
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
export function psbtPreProcess(
  client: VaultWallet,
  pdata: SdkTransaction,
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
export function psbtPostProcess(
  client: VaultWallet,
  pdata: SdkTransaction,
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
  const input = psbt.data.inputs[inputIndex];
  validateSighashType(input.sighashType, 'taproot');

  const xOnlyPubkey = Buffer.from(keyPair.publicKey.slice(1, 33));

  try {
    const tweakHash = Buffer.from(bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey));
    const tweakedSigner = keyPair.tweak(tweakHash);
    psbt.signInput(inputIndex, tweakedSigner as bitcoin.Signer);
  } catch (error: unknown) {
    // Fall back to manual signing
    const { scripts, values } = extractWitnessData(psbt);

    // INTERNAL API: Accessing bitcoinjs-lib private __CACHE.__TX for sighash computation.
    // This is not part of the public API and may break on library updates.
    // Pinned to bitcoinjs-lib v7.x — verify after any version bump.
    const psbtCache = (psbt as unknown as { __CACHE: PsbtCache }).__CACHE;
    const tx = psbtCache.__TX.clone();
    const sighash = Buffer.from(tx.hashForWitnessV1(
      inputIndex,
      scripts,
      values,
      bitcoin.Transaction.SIGHASH_DEFAULT
    ));

    const tweakHash = Buffer.from(bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey));
    const tweakedSigner = keyPair.tweak(tweakHash);

    const tweakedKeyPair = tweakedSigner as { privateKey?: Uint8Array };
    if (!tweakedKeyPair.privateKey) {
      throw new Error('Tweaked key pair is missing private key for signing');
    }
    const signature = signSchnorr(sighash, Buffer.from(tweakedKeyPair.privateKey));
    psbt.updateInput(inputIndex, { tapKeySig: signature });
  }
}

// Runestone protocol marker: OP_RETURN (0x6a) followed by OP_PUSHDATA with tag 0x5d
const RUNESTONE_MARKER = '6a5d';
// Standard relay limit for OP_RETURN payload (after the OP_RETURN opcode)
const MAX_OP_RETURN_PAYLOAD_SIZE = 80;

/**
 * Validate OP_RETURN output conforms to expected Runestone format and size limits.
 *
 * @param script - The full output script starting with 0x6a (OP_RETURN)
 * @throws Error if OP_RETURN does not start with Runestone marker or exceeds size limit
 */
function validateOpReturnOutput(script: Buffer | Uint8Array): void {
  const scriptHex = Buffer.from(script).toString('hex');

  // Must start with Runestone marker (OP_RETURN + OP_13 push tag 0x5d)
  if (!scriptHex.startsWith(RUNESTONE_MARKER)) {
    throw new Error(
      'SECURITY: OP_RETURN output does not start with Runestone marker (6a5d). ' +
      'Only Runestone OP_RETURN outputs are allowed.'
    );
  }

  // Payload is everything after the OP_RETURN opcode (0x6a = 1 byte)
  const payloadLength = script.length - 1;
  if (payloadLength > MAX_OP_RETURN_PAYLOAD_SIZE) {
    throw new Error(
      `SECURITY: OP_RETURN payload size ${payloadLength} bytes exceeds maximum ` +
      `${MAX_OP_RETURN_PAYLOAD_SIZE} bytes (standard relay limit).`
    );
  }
}

function matchesExpectedPsbtTemplate(
  psbt: bitcoin.Psbt,
  expected: ExpectedPsbtTemplate
): boolean {
  // INTERNAL API: Accessing bitcoinjs-lib private __CACHE.__TX for sighash computation.
  // This is not part of the public API and may break on library updates.
  // Pinned to bitcoinjs-lib v7.x — verify after any version bump.
  const unsignedTx = (psbt as unknown as {
    __CACHE?: { __TX?: { version: number; locktime: number } };
  }).__CACHE?.__TX;

  if (!unsignedTx) {
    return false;
  }

  if (unsignedTx.version !== expected.version || unsignedTx.locktime !== expected.locktime) {
    return false;
  }

  if (psbt.txInputs.length !== expected.inputs.length || psbt.txOutputs.length !== expected.outputs.length) {
    return false;
  }

  for (let i = 0; i < expected.inputs.length; i++) {
    const actualInput = psbt.txInputs[i];
    const expectedInput = expected.inputs[i];
    const actualWitnessUtxo = psbt.data.inputs[i].witnessUtxo;
    const actualHashHex = Buffer.from(actualInput.hash).toString('hex');
    const actualScriptHex = actualWitnessUtxo
      ? Buffer.from(actualWitnessUtxo.script).toString('hex')
      : null;
    const actualValue = actualWitnessUtxo ? actualWitnessUtxo.value.toString() : null;

    if (
      actualHashHex !== expectedInput.hashHex ||
      actualInput.index !== expectedInput.index ||
      (actualInput.sequence ?? 0xffffffff) !== expectedInput.sequence ||
      actualScriptHex !== expectedInput.scriptHex ||
      actualValue !== expectedInput.value
    ) {
      return false;
    }
  }

  for (let i = 0; i < expected.outputs.length; i++) {
    const actualOutput = psbt.txOutputs[i];
    const expectedOutput = expected.outputs[i];

    if (
      Buffer.from(actualOutput.script).toString('hex') !== expectedOutput.scriptHex ||
      actualOutput.value.toString() !== expectedOutput.value
    ) {
      return false;
    }
  }

  return true;
}

function toSatsBigInt(value: bigint | number, label: string): bigint {
  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new Error(`SECURITY: ${label} cannot be negative`);
    }
    return value;
  }

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`SECURITY: ${label} must be a non-negative safe integer`);
  }

  return BigInt(value);
}

function normalizeAddressSet(addresses: string[], label: string): Set<string> {
  if (!addresses.length) {
    throw new Error(`SECURITY: ${label} must contain at least one address`);
  }

  return new Set(addresses.map(validateAndNormalizeAddress));
}

function getSignInputIndices(signInputs: Record<string, number[]>): number[] {
  const indices = new Set<number>();

  for (const inputIndices of Object.values(signInputs)) {
    for (const inputIndex of inputIndices) {
      if (!Number.isInteger(inputIndex) || inputIndex < 0) {
        throw new Error(`SECURITY: Invalid PSBT input index ${inputIndex}`);
      }
      indices.add(inputIndex);
    }
  }

  return [...indices];
}

function enforceExternalSpendPolicy(
  psbt: bitcoin.Psbt,
  signInputs: Record<string, number[]>,
  policy: NonNullable<PsbtSigningIntent['externalSpend']>,
  allowOpReturn: boolean
): void {
  const inputIndices = getSignInputIndices(signInputs);
  if (inputIndices.length === 0) {
    throw new Error('SECURITY: External PSBT signing requires at least one signed input');
  }

  const returnAddresses = normalizeAddressSet(policy.returnAddresses, 'external spend returnAddresses');
  const requiredAddresses = policy.requiredOutputAddresses?.length
    ? normalizeAddressSet(policy.requiredOutputAddresses, 'external spend requiredOutputAddresses')
    : new Set<string>();
  const seenRequiredAddresses = new Set<string>();

  let signedInputValue = 0n;
  for (const inputIndex of inputIndices) {
    const input = psbt.data.inputs[inputIndex];
    if (!input?.witnessUtxo) {
      throw new Error(`SECURITY: Missing witnessUtxo for requested input ${inputIndex}`);
    }
    signedInputValue += toSatsBigInt(input.witnessUtxo.value, `input ${inputIndex} value`);
  }

  let walletReturnValue = 0n;
  for (const out of psbt.txOutputs) {
    if (out.script[0] === 0x6a) {
      if (!allowOpReturn) {
        throw new Error('SECURITY: PSBT contains OP_RETURN output but allowOpReturn is false');
      }
      validateOpReturnOutput(out.script);
      continue;
    }

    const addr = validateAndNormalizeAddress(bitcoin.address.fromOutputScript(out.script, NETWORK));
    if (returnAddresses.has(addr)) {
      walletReturnValue += toSatsBigInt(out.value, `output to ${addr}`);
    }
    if (requiredAddresses.has(addr)) {
      seenRequiredAddresses.add(addr);
    }
  }

  for (const requiredAddress of requiredAddresses) {
    if (!seenRequiredAddresses.has(requiredAddress)) {
      throw new Error(`SECURITY: External PSBT missing required wallet output ${requiredAddress}`);
    }
  }

  const netSpend = signedInputValue - walletReturnValue;
  if (netSpend < 0n) {
    throw new Error('SECURITY: External PSBT returns more value than signed inputs');
  }

  const maxSpend = toSatsBigInt(policy.maxSpendSats, 'external spend maxSpendSats');
  if (netSpend > maxSpend) {
    throw new Error('SECURITY: External PSBT spends more than the approved maximum');
  }
}

/**
 * Basic intent enforcement for wallet/vault PSBT signing.
 * - Ensures all outputs are either the reviewed recipient or wallet-derived change.
 * - Ensures recipient amount is at least the approved minimum.
 */
function enforceIntentOutputs(
  psbt: bitcoin.Psbt,
  intent: PsbtSigningIntent | undefined,
  signInputs: Record<string, number[]>
): void {
  if (!intent?.recipient) {
    throw new Error('SECURITY: Missing intent for PSBT signing');
  }

  if (intent.expectedPsbtTemplates && intent.expectedPsbtTemplates.length > 0) {
    const matchedTemplate = intent.expectedPsbtTemplates.some((template) =>
      matchesExpectedPsbtTemplate(psbt, template)
    );

    if (!matchedTemplate) {
      throw new Error('SECURITY: Vault PSBT does not match the expected transaction template');
    }

    return;
  }

  if (!psbt.txOutputs || psbt.txOutputs.length === 0) {
    throw new Error('SECURITY: PSBT has no outputs to validate');
  }

  const recipient = validateAndNormalizeAddress(intent.recipient);
  const change = intent.change ? validateAndNormalizeAddress(intent.change) : null;
  const minAmount = toSatsBigInt(intent.minAmountSats ?? 0, 'intent minAmountSats');
  const allowOpReturn = intent.allowOpReturn ?? false;

  if (intent.externalSpend) {
    enforceExternalSpendPolicy(psbt, signInputs, intent.externalSpend, allowOpReturn);
    return;
  }

  let recipientValue = 0n;

  for (const out of psbt.txOutputs) {
    // OP_RETURN output validation — always validate size even for vault PSBTs
    if (out.script[0] === 0x6a) {
      if (!allowOpReturn) {
        throw new Error('SECURITY: PSBT contains OP_RETURN output but allowOpReturn is false');
      }

      // Always enforce size limit; only require Runestone marker for non-vault PSBTs
      const payloadLength = out.script.length - 1;
      if (payloadLength > MAX_OP_RETURN_PAYLOAD_SIZE) {
        throw new Error(
          `SECURITY: OP_RETURN payload size ${payloadLength} bytes exceeds maximum ` +
          `${MAX_OP_RETURN_PAYLOAD_SIZE} bytes (standard relay limit).`
        );
      }
      validateOpReturnOutput(out.script);
      continue;
    }

    const addr = validateAndNormalizeAddress(bitcoin.address.fromOutputScript(out.script, NETWORK));
    if (addr === recipient) {
      recipientValue += toSatsBigInt(out.value, `output to ${recipient}`);
      continue;
    }

    if (change && addr === change) {
      continue;
    }

    throw new Error('SECURITY: PSBT has outputs not matching recipient/change');
  }

  if (recipientValue < minAmount) {
    throw new Error('SECURITY: PSBT recipient amount below approved value');
  }
}
