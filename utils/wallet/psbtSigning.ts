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
