/**
 * Crypto Utilities for PSBT Signing
 *
 * Shared cryptographic functions extracted from both wallet and vault signing implementations.
 * These utilities handle witness data extraction, key tweaking, and sighash computation.
 */

import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import * as SecureStore from 'expo-secure-store';
import { BIP32Interface } from 'bip32';
import { ECPairInterface } from 'ecpair';

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
import type { PsbtCache, WitnessData, AddressTypeInfo, SignatureData } from './types';

// Secp256k1 curve order for key negation
const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

/**
 * Get the current account index from SecureStore
 */
export async function getAccountIndex(): Promise<number> {
  try {
    const storedAccount = await SecureStore.getItemAsync(SECURE_KEYS.CURRENT_ACCOUNT);
    if (storedAccount) {
      return parseInt(storedAccount, 10);
    }
  } catch (error: unknown) {
    logger.debug('[cryptoUtils] SecureStore read failed, using default account 0', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return 0;
}

/**
 * Extract witnessUtxo data from all PSBT inputs with validation
 * @throws Error if any input is missing witnessUtxo
 */
export function extractWitnessData(psbt: bitcoin.Psbt): WitnessData {
  const scripts: Buffer[] = [];
  const values: bigint[] = [];

  for (let i = 0; i < psbt.data.inputs.length; i++) {
    const input = psbt.data.inputs[i];
    if (!input.witnessUtxo) {
      throw new Error(`Input ${i} is missing witnessUtxo - cannot sign PSBT`);
    }
    scripts.push(Buffer.from(input.witnessUtxo.script));
    values.push(input.witnessUtxo.value);
  }

  return { scripts, values };
}

/**
 * Detect address type and get appropriate derivation path
 */
export function getAddressTypeInfo(
  address: string,
  scriptHex: string,
  accountIndex: number
): AddressTypeInfo {
  const isSegwit = scriptHex.startsWith('0014'); // P2WPKH: OP_0 <20-byte-hash>
  const isTaproot = scriptHex.startsWith('5120'); // P2TR: OP_1 <32-byte-key>

  let derivationPath: string;
  if (isSegwit || address.startsWith('tb1q')) {
    derivationPath = `m/84'/1'/0'/0/${accountIndex}`;
  } else if (isTaproot || address.startsWith('tb1p')) {
    derivationPath = `m/86'/1'/0'/0/${accountIndex}`;
  } else {
    throw new Error(`Unsupported address type: ${address}`);
  }

  return { isSegwit, isTaproot, derivationPath };
}

/**
 * Derive a key pair from mnemonic for the given derivation path
 */
export function deriveKeyPair(
  mnemonic: string,
  derivationPath: string
): BIP32Interface {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);
  return root.derivePath(derivationPath);
}

/**
 * Get EC key pair for SegWit signing
 */
export function getSegwitKeyPair(
  mnemonic: string,
  accountIndex: number
): ECPairInterface {
  const derivationPath = `m/84'/1'/0'/0/${accountIndex}`;
  const child = deriveKeyPair(mnemonic, derivationPath);

  if (!child.privateKey) {
    throw new Error('Failed to derive private key for SegWit signing');
  }

  const ECPairInstance = getECPair();
  return ECPairInstance.fromPrivateKey(child.privateKey, { network: MUTINYNET_NETWORK });
}

/**
 * Compute tapleaf hash for script-path signing
 */
export function computeTapleafHash(script: Buffer, leafVersion: number): Buffer {
  const scriptLengthVarint = Buffer.allocUnsafe(varIntSize(script.length));
  writeVarInt(scriptLengthVarint, script.length, 0);

  const hash = bitcoin.crypto.taggedHash(
    'TapLeaf',
    Buffer.concat([Buffer.from([leafVersion]), scriptLengthVarint, script])
  );
  return Buffer.from(hash);
}

/**
 * Get sighash for Taproot witness v1 spending
 */
export function getTaprootSighash(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  scripts: Buffer[],
  values: bigint[],
  sighashType: number,
  leafHash?: Buffer
): Buffer {
  // Access internal PSBT cache for low-level Taproot signing (required by bitcoinjs-lib)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const psbtCache = (psbt as any).__CACHE as PsbtCache;
  const hash = psbtCache.__TX.hashForWitnessV1(
    inputIndex,
    scripts,
    values,
    sighashType,
    leafHash
  );
  return Buffer.from(hash);
}

/**
 * Ensure private key is a Buffer
 */
export function ensurePrivateKeyBuffer(privateKey: Uint8Array | Buffer | undefined): Buffer {
  if (!privateKey) {
    throw new Error('Key pair is missing private key for signing');
  }
  return Buffer.isBuffer(privateKey) ? privateKey : Buffer.from(privateKey);
}

/**
 * Negate private key if y-coordinate is odd (for Taproot key-path)
 */
export function negatePrivateKeyIfNeeded(
  privateKey: Buffer,
  publicKey: Buffer
): Buffer {
  if (publicKey[0] === 0x03) {
    const privKeyHex = privateKey.toString('hex');
    const privKeyNum = BigInt('0x' + privKeyHex);
    const negatedNum = CURVE_ORDER - privKeyNum;
    return Buffer.from(negatedNum.toString(16).padStart(64, '0'), 'hex');
  }
  return privateKey;
}

/**
 * Tweak private key for Taproot key-path spending
 */
export function tweakPrivateKey(privateKey: Buffer, xOnlyPubkey: Buffer): Buffer {
  const tweakHash = Buffer.from(bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey));

  const privKeyHex = privateKey.toString('hex');
  const tweakHashHex = tweakHash.toString('hex');
  const privKeyNum = BigInt('0x' + privKeyHex);
  const tweakNum = BigInt('0x' + tweakHashHex);
  const tweakedNum = (privKeyNum + tweakNum) % CURVE_ORDER;

  return Buffer.from(tweakedNum.toString(16).padStart(64, '0'), 'hex');
}

/**
 * Sign with Schnorr and return signature buffer
 */
export function signSchnorr(hash: Buffer, privateKey: Buffer): Buffer {
  const signature = ecc.signSchnorr(hash, privateKey);
  return Buffer.from(signature);
}

/**
 * Get x-only public key (remove prefix byte)
 */
export function getXOnlyPubkey(publicKey: Buffer): Buffer {
  return publicKey.slice(1, 33);
}

/**
 * Sign a Taproot script-path input
 */
export function signTaprootScriptPath(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  keyPair: BIP32Interface
): SignatureData {
  const input = psbt.data.inputs[inputIndex];

  if (!input.tapLeafScript || input.tapLeafScript.length === 0) {
    throw new Error(`Input ${inputIndex} has no tapLeafScript for script-path signing`);
  }

  const tapLeafScript = input.tapLeafScript[0];
  const scriptBuffer = Buffer.from(tapLeafScript.script);
  const tapleafHash = computeTapleafHash(scriptBuffer, tapLeafScript.leafVersion);

  const { scripts, values } = extractWitnessData(psbt);
  const sighash = input.sighashType || 0x00;
  const hash = getTaprootSighash(psbt, inputIndex, scripts, values, sighash, tapleafHash);

  const privateKey = ensurePrivateKeyBuffer(keyPair.privateKey);
  const signature = signSchnorr(hash, privateKey);
  const xOnlyPubkey = getXOnlyPubkey(Buffer.from(keyPair.publicKey));

  return {
    inputIndex,
    type: 'taproot-script',
    pubkey: xOnlyPubkey,
    signature,
    leafHash: tapleafHash,
  };
}

/**
 * Sign a Taproot key-path input
 */
export function signTaprootKeyPath(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  keyPair: BIP32Interface
): SignatureData {
  const input = psbt.data.inputs[inputIndex];

  let privateKey = ensurePrivateKeyBuffer(keyPair.privateKey);
  const publicKeyBuffer = Buffer.from(keyPair.publicKey);
  privateKey = negatePrivateKeyIfNeeded(privateKey, publicKeyBuffer);

  const { scripts, values } = extractWitnessData(psbt);
  const sighash = input.sighashType || 0x00;
  const hash = getTaprootSighash(psbt, inputIndex, scripts, values, sighash);

  const xOnlyPubkey = getXOnlyPubkey(publicKeyBuffer);
  const tweakedPrivateKey = tweakPrivateKey(privateKey, xOnlyPubkey);
  const signature = signSchnorr(hash, tweakedPrivateKey);

  return {
    inputIndex,
    type: 'taproot-key',
    signature,
  };
}

/**
 * Sign a SegWit input and return signature data
 */
export function signSegwitInput(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  keyPair: ECPairInterface
): SignatureData | null {
  psbt.signInput(inputIndex, keyPair);

  const signedInput = psbt.data.inputs[inputIndex];
  if (signedInput.partialSig && signedInput.partialSig.length > 0) {
    const ps = signedInput.partialSig[0];
    return {
      inputIndex,
      type: 'segwit',
      pubkey: Buffer.from(ps.pubkey),
      signature: Buffer.from(ps.signature),
    };
  }

  return null;
}

/**
 * Sign a SegWit input with finalization (for wallet-level signing)
 */
export function signAndFinalizeSegwitInput(
  psbt: bitcoin.Psbt,
  inputIndex: number,
  keyPair: ECPairInterface
): void {
  psbt.signInput(inputIndex, keyPair);

  try {
    psbt.finalizeInput(inputIndex);
  } catch (error: unknown) {
    // Finalization may fail for partially-signed PSBTs - this is expected behavior
    logger.debug('[cryptoUtils] SegWit input finalization skipped (expected for multi-sig)', {
      inputIndex,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check if input is script-path Taproot spend
 */
export function isScriptPathSpend(input: { tapLeafScript?: unknown[] }): boolean {
  return !!(input.tapLeafScript && input.tapLeafScript.length > 0);
}

/**
 * Execute signing operation with mnemonic access
 */
export async function withSigningContext<T>(
  operation: (mnemonic: string, accountIndex: number) => Promise<T>
): Promise<T> {
  const accountIndex = await getAccountIndex();
  return withMnemonic(async (mnemonic: string) => {
    return operation(mnemonic, accountIndex);
  });
}

/**
 * Convert witness stack to script witness format
 * Properly serializes witness elements with compact size prefixes
 */
export function witnessToScriptWitness(witness: Buffer[]): Buffer {
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
