/**
 * P2PK Secrets - Key generation and secret creation (NUT-11)
 */

import * as crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { schnorr } from '@noble/secp256k1';
import { logger } from '../../../utils/logger';

/**
 * Generate a new secp256k1 keypair for P2PK
 * @returns {Promise<Object>} { privateKey: string, publicKey: string }
 */
export const generateP2PKKeyPair = async () => {
  const privateKeyBytes = await crypto.getRandomBytesAsync(32);
  const privateKey = Buffer.from(privateKeyBytes).toString('hex');

  // Derive public key (33 bytes compressed)
  const publicKeyBytes = schnorr.getPublicKey(privateKey);
  const publicKey = Buffer.from(publicKeyBytes).toString('hex');

  return {
    privateKey,
    publicKey
  };
};

/**
 * Create a P2PK secret locked to a recipient's public key
 * @param {string} recipientPubkey - Recipient's public key (hex)
 * @param {Object} options - Optional P2PK parameters
 * @param {string} options.sigflag - 'SIG_INPUTS' or 'SIG_ALL' (default: SIG_INPUTS)
 * @param {Array<string>} options.pubkeys - Additional authorized public keys
 * @param {number} options.n_sigs - Required number of signatures
 * @param {number} options.locktime - Unix timestamp for locktime
 * @param {Array<string>} options.refund - Refund public keys after locktime
 * @param {number} options.n_sigs_refund - Required refund signatures
 * @returns {Promise<string>} P2PK secret (serialized JSON)
 */
export const createP2PKSecret = async (recipientPubkey, options = {}) => {
  // Generate random nonce
  const nonceBytes = await crypto.getRandomBytesAsync(32);
  const nonce = Buffer.from(nonceBytes).toString('hex');

  // Build tags array
  const tags = [];

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
  const p2pkSecret = [
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
