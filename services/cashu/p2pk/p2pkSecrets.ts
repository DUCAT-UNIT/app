/**
 * P2PK Secrets - Key generation and secret creation (NUT-11)
 */

import { schnorr } from '@noble/secp256k1';
import { Buffer } from 'buffer';
import * as crypto from 'expo-crypto';
import { logger } from '../../../utils/logger';

export interface P2PKKeyPair {
  privateKey: string;
  publicKey: string;
}

export interface P2PKOptions {
  sigflag?: string;
  pubkeys?: string[];
  n_sigs?: number;
  locktime?: number;
  refund?: string[];
  n_sigs_refund?: number;
}

interface P2PKSecretData {
  nonce: string;
  data: string;
  tags?: Array<[string, ...string[]]>;
}

/**
 * Generate a new secp256k1 keypair for P2PK
 */
export const generateP2PKKeyPair = async (): Promise<P2PKKeyPair> => {
  const privateKeyBytes = await crypto.getRandomBytesAsync(32);
  const privateKey = Buffer.from(privateKeyBytes).toString('hex');

  // Derive public key (33 bytes compressed)
  const publicKeyBytes = schnorr.getPublicKey(Buffer.from(privateKey, 'hex'));
  const publicKey = Buffer.from(publicKeyBytes).toString('hex');

  return {
    privateKey,
    publicKey
  };
};

/**
 * Create a P2PK secret locked to a recipient's public key
 * @param recipientPubkey - Recipient's public key (hex)
 * @param options - Optional P2PK parameters
 * @returns P2PK secret (serialized JSON)
 */
export const createP2PKSecret = async (
  recipientPubkey: string,
  options: P2PKOptions = {}
): Promise<string> => {
  // Generate random nonce
  const nonceBytes = await crypto.getRandomBytesAsync(32);
  const nonce = Buffer.from(nonceBytes).toString('hex');

  // Build tags array
  const tags: Array<[string, ...string[]]> = [];

  // Add sigflag (default: SIG_INPUTS)
  const sigflag = options.sigflag || 'SIG_INPUTS';
  tags.push(['sigflag', sigflag]);

  // Add additional pubkeys if provided
  if (options.pubkeys && options.pubkeys.length > 0) {
    tags.push(['pubkeys', ...options.pubkeys]);
  }

  // Add n_sigs if provided
  if (options.n_sigs) {
    tags.push(['n_sigs', options.n_sigs.toString()]);
  }

  // Add locktime if provided
  if (options.locktime) {
    tags.push(['locktime', options.locktime.toString()]);
  }

  // Add refund pubkeys if provided
  if (options.refund && options.refund.length > 0) {
    tags.push(['refund', ...options.refund]);
  }

  // Add n_sigs_refund if provided
  if (options.n_sigs_refund) {
    tags.push(['n_sigs_refund', options.n_sigs_refund.toString()]);
  }

  // Build P2PK secret structure
  const p2pkSecret: ['P2PK', P2PKSecretData] = [
    'P2PK',
    {
      nonce,
      data: recipientPubkey,
      tags: tags.length > 0 ? tags : undefined
    }
  ];

  // Serialize to JSON
  const secretJson = JSON.stringify(p2pkSecret);

  logger.info('Created P2PK secret', {
    nonce: nonce.substring(0, 16) + '...',
    recipientPubkey: recipientPubkey.substring(0, 16) + '...',
    sigflag,
    tagCount: tags.length
  });

  return secretJson;
};
