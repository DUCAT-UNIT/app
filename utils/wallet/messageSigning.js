/**
 * Message signing utilities
 */

import * as bitcoin from 'bitcoinjs-lib';
import { MUTINYNET_NETWORK } from '../bitcoin';
import { withMnemonic } from '../../services/secureStorageService';
import { bip32, getECPair, getDerivationPath } from './cryptoHelpers';

/**
 * Sign a message with the wallet
 * @param {string} address - Address to sign with
 * @param {string} message - Message to sign
 * @returns {Promise<string>} Signature
 */
export async function signMessage(address, message) {
  const accountIndex = 0;

  return await withMnemonic(async (mnemonic) => {
    const seed = require('bip39').mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    const derivationPath = getDerivationPath(address, accountIndex);
    const child = root.derivePath(derivationPath);

    const ECPairInstance = getECPair();
    const keyPair = ECPairInstance.fromPrivateKey(child.privateKey, { network: MUTINYNET_NETWORK });

    const messageHash = bitcoin.crypto.hash256(Buffer.from(message, 'utf8'));
    const signature = keyPair.sign(messageHash);

    return Buffer.from(signature).toString('hex');
  });
}
