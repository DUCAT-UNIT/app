/**
 * Cashu Receive Token Operation
 * Handles receiving tokens from QR codes or text
 */

import { logger } from '../../../utils/logger';
import { MINT_URL, swapTokens as swapTokensAPI } from '../cashuMintClient';
import {
  createBlindedOutputs,
  unblindSignatures,
  splitAmount,
  decodeToken,
} from '../crypto';
import {
  isP2PKLocked,
  getP2PKRecipient,
  findAccountForP2PKToken,
  getP2PKPrivateKey,
  signP2PKProofs,
} from '../p2pk';
import { getCurrentAccount } from '../../secureStorageService';
import { getOrFetchKeys } from '../cashuBalanceService';
import { loadProofs, addProofs } from '../cashuProofManager';

/**
 * Receive Cashu token (from QR code or paste)
 * Validates proofs haven't been spent and swaps them to prevent double-spending
 * @param {string} tokenString - Encoded Cashu token
 * @returns {Promise<Object>} Received amount and proofs
 */
export const receiveToken = async (tokenString) => {
  try {
    const perfStart = Date.now();
    logger.info('[PERF] receiveToken started');

    // Decode token
    const t1 = Date.now();
    const decoded = decodeToken(tokenString);
    logger.info('[PERF] Token decode took:', Date.now() - t1, 'ms');

    if (!decoded || !decoded.proofs || !Array.isArray(decoded.proofs)) {
      throw new Error('Invalid token format');
    }

    const { mint, proofs, amount } = decoded;

    // Verify mint matches
    if (mint !== MINT_URL) {
      throw new Error(`Token from different mint: ${mint}`);
    }

    // Check if we already have any of these proofs (prevent duplicate receives)
    const t2 = Date.now();
    const existingProofs = await loadProofs();
    const existingSecrets = new Set(existingProofs.map(p => p.secret));
    const hasDuplicate = proofs.some(p => existingSecrets.has(p.secret));
    logger.info('[PERF] Duplicate check took:', Date.now() - t2, 'ms');

    if (hasDuplicate) {
      throw new Error('Token already received');
    }

    // Check if any proofs are P2PK locked (do this first, it's fast)
    const t3 = Date.now();
    const hasP2PKProofs = proofs.some(p => isP2PKLocked(p));
    logger.info('[PERF] P2PK detection took:', Date.now() - t3, 'ms');

    // If P2PK locked, verify token belongs to current account
    if (hasP2PKProofs) {
      logger.info('⚠️ P2PK token detected, verifying account ownership');

      // Extract recipient pubkey from first P2PK proof
      let recipientPubkey = null;
      for (const proof of proofs) {
        if (isP2PKLocked(proof)) {
          recipientPubkey = getP2PKRecipient(proof.secret);
          logger.info('⚠️ Extracted recipient pubkey:', recipientPubkey?.substring(0, 16) + '...');
          if (recipientPubkey) {
            break;
          }
        }
      }

      if (recipientPubkey) {
        // Get current account first to log it
        const currentAccountIndex = await getCurrentAccount();
        logger.info('⚠️ Current account index:', currentAccountIndex);

        // Find which account owns this pubkey
        const accountMatch = await findAccountForP2PKToken(recipientPubkey, 50);

        if (!accountMatch) {
          logger.error('⚠️ No matching account found for P2PK token');
          throw new Error('This token is not locked to any of your accounts (checked 50 accounts). Make sure you are using the correct wallet.');
        }

        logger.info('⚠️ Token locked to account:', accountMatch.accountIndex);
        logger.info('⚠️ Comparing accounts - current:', currentAccountIndex, 'token locked to:', accountMatch.accountIndex);

        if (accountMatch.accountIndex !== currentAccountIndex) {
          logger.error('⚠️ ACCOUNT MISMATCH - blocking claim');
          throw new Error(`This proof belongs to account ${accountMatch.accountIndex + 1}. Please switch to that account to claim this token.`);
        }

        logger.info('✅ P2PK token verified for current account', { accountIndex: currentAccountIndex });
      } else {
        logger.warn('⚠️ Could not extract recipient pubkey from P2PK token');
      }
    }

    // Parallelize independent operations (removed spent check - swap will fail if spent)
    const t4 = Date.now();
    const [keyData, privateKey] = await Promise.all([
      // 1. Get mint keys (network call or cache)
      (async () => {
        const t4b = Date.now();
        logger.info('Getting mint keys');
        const result = await getOrFetchKeys();
        logger.info('[PERF] getOrFetchKeys took:', Date.now() - t4b, 'ms');
        return result;
      })(),

      // 2. Get private key if P2PK (only if needed)
      hasP2PKProofs ? (async () => {
        const t4c = Date.now();
        logger.info('P2PK locked proofs detected, getting private key');

        // Get cached taproot address and private key
        const p2pkKey = await getP2PKPrivateKey();

        logger.info('[PERF] getP2PKPrivateKey took:', Date.now() - t4c, 'ms');
        return p2pkKey;
      })() : null
    ]);
    logger.info('[PERF] Parallel operations (getKeys + deriveKey) took:', Date.now() - t4, 'ms');

    // Extract keys from keyData
    let keys, keysetId;
    if (keyData.keysets && keyData.keysets.length > 0) {
      keysetId = keyData.keysets[0].id;
      keys = keyData.keysets[0].keys;
    } else {
      keys = keyData.keys || keyData;
    }

    let proofsToSwap = proofs;

    // If P2PK locked, sign them with the private key we already got
    if (hasP2PKProofs && privateKey) {
      const t5 = Date.now();
      logger.info('Signing P2PK proofs');
      proofsToSwap = await signP2PKProofs(proofs, privateKey);
      logger.info('[PERF] P2PK signing took:', Date.now() - t5, 'ms');
    }

    // Create new blinded outputs for the same amounts
    // Use the actual sum in smallest units, not the display amount
    const t6 = Date.now();
    const totalSmallestUnits = proofs.reduce((sum, proof) => sum + proof.amount, 0);
    const amounts = splitAmount(totalSmallestUnits);
    const { outputs, blindingData } = await createBlindedOutputs(amounts, keysetId);
    logger.info('[PERF] Create blinded outputs took:', Date.now() - t6, 'ms');

    // Swap: give received proofs (signed if P2PK), get new proofs
    const t7 = Date.now();
    logger.info('Swapping tokens', { inputCount: proofsToSwap.length, outputCount: outputs.length });
    const response = await swapTokensAPI(proofsToSwap, outputs);
    logger.info('[PERF] Swap API call took:', Date.now() - t7, 'ms');

    // Unblind to create our new proofs
    const t8 = Date.now();
    const newProofs = unblindSignatures(
      response.signatures,
      blindingData,
      keys,
      response.signatures[0]?.id || keysetId
    );
    logger.info('[PERF] Unblind signatures took:', Date.now() - t8, 'ms');

    // Add swapped proofs to wallet
    const t9 = Date.now();
    await addProofs(newProofs);
    logger.info('[PERF] Save proofs took:', Date.now() - t9, 'ms');

    logger.info('[PERF] TOTAL receiveToken took:', Date.now() - perfStart, 'ms');
    logger.info('Token received and swapped', { amount, proofCount: newProofs.length });

    return {
      amount,
      proofCount: newProofs.length,
    };
  } catch (error) {
    logger.error('Failed to receive token', { error: error.message });
    throw error;
  }
};
