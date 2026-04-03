/**
 * Message signing utilities
 */

import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { MUTINYNET_NETWORK } from '../bitcoin';
import { getCurrentAccount, withMnemonic } from '../../services/secureStorageService';
import { getWalletDerivationMode } from '../../services/walletDerivationService';
import { bip32, getECPair, getDerivationPath } from './cryptoHelpers';

/**
 * Sign a message with the wallet
 * @param address - Address to sign with
 * @param message - Message to sign
 * @returns Signature
 */
export async function signMessage(address: string, message: string): Promise<string> {
  const [accountIndex, derivationMode] = await Promise.all([
    getCurrentAccount(),
    getWalletDerivationMode(),
  ]);

  return await withMnemonic(async (mnemonic: string) => {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed, MUTINYNET_NETWORK);

    const derivationPath = getDerivationPath(address, accountIndex, derivationMode);
    const child = root.derivePath(derivationPath);

    const ECPairInstance = getECPair();
    const keyPair = ECPairInstance.fromPrivateKey(child.privateKey!, { network: MUTINYNET_NETWORK });

    const messageHash = bitcoin.crypto.hash256(Buffer.from(message, 'utf8'));
    const signature = keyPair.sign(messageHash);

    return Buffer.from(signature).toString('hex');
  });
}
