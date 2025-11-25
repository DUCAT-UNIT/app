/**
 * PSBT signing utilities
 */

import * as bitcoin from 'bitcoinjs-lib';
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

  return await withMnemonic(async (mnemonic) => {
    const seed = require('bip39').mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network: MUTINYNET_NETWORK });

    for (const [address, inputIndices] of Object.entries(signInputs)) {
      let derivationPath;
      let keyPair;
      const ECPairInstance = getECPair();

      if (address.startsWith('tb1q')) {
        derivationPath = `m/84'/1'/0'/0/${accountIndex}`;
        const child = root.derivePath(derivationPath);
        keyPair = ECPairInstance.fromPrivateKey(child.privateKey, { network: MUTINYNET_NETWORK });
      } else if (address.startsWith('tb1p')) {
        derivationPath = `m/86'/1'/0'/0/${accountIndex}`;
        keyPair = root.derivePath(derivationPath);
      } else {
        throw new Error(`Unsupported address type: ${address}`);
      }

      for (const inputIndex of inputIndices) {
        try {
          if (address.startsWith('tb1p')) {
            await signTaprootInput(psbt, inputIndex, keyPair);
          } else {
            signSegwitInput(psbt, inputIndex, keyPair);
          }
        } catch (error) {
          throw error;
        }
      }
    }

    return psbt.toBase64();
  });
}

/**
 * Sign a Taproot input (key-path or script-path)
 */
async function signTaprootInput(psbt, inputIndex, keyPair) {
  const input = psbt.data.inputs[inputIndex];
  const isScriptPath = !!(input.tapLeafScript && input.tapLeafScript.length > 0);

  if (isScriptPath) {
    signScriptPathInput(psbt, inputIndex, keyPair, input);
  } else {
    signKeyPathInput(psbt, inputIndex, keyPair);
  }
}

/**
 * Sign a script-path Taproot input
 */
function signScriptPathInput(psbt, inputIndex, keyPair, input) {
  const tapLeafScript = input.tapLeafScript[0];
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
  const hash = psbt.__CACHE.__TX.hashForWitnessV1(
    inputIndex,
    psbt.data.inputs.map((i) => i.witnessUtxo.script),
    psbt.data.inputs.map((i) => i.witnessUtxo.value),
    sighash,
    tapleafHash
  );

  let privateKey = keyPair.privateKey;
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
 * Sign a key-path Taproot input
 */
function signKeyPathInput(psbt, inputIndex, keyPair) {
  const xOnlyPubkey = keyPair.publicKey.slice(1, 33);

  try {
    const tweakedSigner = keyPair.tweak(
      bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey)
    );
    psbt.signInput(inputIndex, tweakedSigner);
  } catch (error) {
    // Fall back to manual signing
    const tx = psbt.__CACHE.__TX.clone();
    const sighash = tx.hashForWitnessV1(
      inputIndex,
      psbt.data.inputs.map((input) => input.witnessUtxo.script),
      psbt.data.inputs.map((input) => input.witnessUtxo.value),
      bitcoin.Transaction.SIGHASH_DEFAULT
    );

    const tweakedSigner = keyPair.tweak(
      bitcoin.crypto.taggedHash('TapTweak', xOnlyPubkey)
    );

    const signature = ecc.signSchnorr(sighash, tweakedSigner.privateKey);
    psbt.updateInput(inputIndex, { tapKeySig: Buffer.from(signature) });
  }
}

/**
 * Sign a SegWit input
 */
function signSegwitInput(psbt, inputIndex, keyPair) {
  psbt.signInput(inputIndex, keyPair);

  try {
    psbt.finalizeInput(inputIndex);
  } catch (error) {
    // Ignore finalization errors
  }
}
