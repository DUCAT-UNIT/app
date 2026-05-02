import { Buffer } from 'buffer';
import * as ecc from '@bitcoinerlab/secp256k1';
import { loadWalletFromStorage } from '../walletService';
import { getPrivateKeyForAddress } from '../../utils/wallet/keyDerivation';
import type { BlindedOutput } from './cashuMintClient';

const { createHash } = require('react-native-quick-crypto');

export interface MintQuoteSigningKey {
  pubkey: string;
  privateKey: string;
}

export const getMintQuoteSigningKey = async (): Promise<MintQuoteSigningKey> => {
  const { addresses, accountIndex } = await loadWalletFromStorage();
  if (!addresses?.segwitAddress) {
    throw new Error('Wallet not available for mint quote signing');
  }

  const keyData = await getPrivateKeyForAddress(addresses.segwitAddress, accountIndex);
  const pubkey = keyData.xOnlyPubkey;

  if (!/^(02|03)[0-9a-fA-F]{64}$/.test(pubkey)) {
    throw new Error('Mint quote signing key must be a compressed secp256k1 public key');
  }

  return {
    pubkey,
    privateKey: keyData.privateKey,
  };
};

export const signMintQuoteOutputs = (
  quoteId: string,
  outputs: BlindedOutput[],
  privateKey: string
): string => {
  const msgToSign = quoteId + outputs.map((output) => output.B_).join('');
  const messageHash = createHash('sha256').update(Buffer.from(msgToSign, 'utf8')).digest();
  const privateKeyBuffer = Buffer.from(privateKey, 'hex');

  if (messageHash.length !== 32) {
    throw new Error(`Invalid mint quote signature hash length: ${messageHash.length}`);
  }
  if (privateKeyBuffer.length !== 32) {
    throw new Error(`Invalid mint quote private key length: ${privateKeyBuffer.length}`);
  }

  return Buffer.from(ecc.signSchnorr(messageHash, privateKeyBuffer)).toString('hex');
};
