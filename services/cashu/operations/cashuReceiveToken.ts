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
  CashuProof,
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

export interface ReceiveTokenResult {
  amount: number;
  proofCount: number;
}

/**
 * Receive Cashu token (from QR code or paste)
 * Validates proofs haven't been spent and swaps them to prevent double-spending
 */
export const receiveToken = async (tokenString: string): Promise<ReceiveTokenResult> => {
  const txn = logger.startTransaction('receive_token');

  logger.cashu('receive_token_start', {
    step: 'RECEIVE',
    tokenLength: tokenString?.length,
    tokenPrefix: tokenString?.substring(0, 20) + '...',
  });

  try {
    const perfStart = Date.now();

    // Decode token
    const t1 = Date.now();
    const decoded = decodeToken(tokenString);
    const decodeTime = Date.now() - t1;

    logger.cashu('token_decoded', {
      step: 'RECEIVE',
      decodeTimeMs: decodeTime,
      hasProofs: !!decoded?.proofs,
    });

    if (!decoded || !decoded.proofs || !Array.isArray(decoded.proofs)) {
      logger.cashu('token_invalid', { step: 'RECEIVE', error: 'Invalid token format' });
      throw new Error('Invalid token format');
    }

    const { mint, proofs, amount } = decoded;

    logger.cashu('token_details', {
      step: 'RECEIVE',
      mint: mint?.substring(0, 30) + '...',
      proofCount: proofs.length,
      totalAmount: amount,
    });

    // Verify mint matches
    if (mint !== MINT_URL) {
      logger.cashu('mint_mismatch', {
        step: 'RECEIVE',
        expected: MINT_URL?.substring(0, 30),
        actual: mint?.substring(0, 30),
      });
      throw new Error(`Token from different mint: ${mint}`);
    }

    // Check if we already have any of these proofs (prevent duplicate receives)
    const t2 = Date.now();
    const existingProofs = await loadProofs();
    const existingSecrets = new Set(existingProofs.map(p => p.secret));
    const hasDuplicate = proofs.some(p => existingSecrets.has(p.secret));
    const duplicateCheckTime = Date.now() - t2;

    logger.cashu('duplicate_check', {
      step: 'RECEIVE',
      duplicateCheckTimeMs: duplicateCheckTime,
      existingProofCount: existingProofs.length,
      hasDuplicate,
    });

    if (hasDuplicate) {
      logger.cashu('duplicate_rejected', { step: 'RECEIVE', error: 'Token already received' });
      throw new Error('Token already received');
    }

    // Check if any proofs are P2PK locked (do this first, it's fast)
    const t3 = Date.now();
    const hasP2PKProofs = proofs.some(p => isP2PKLocked(p));
    const p2pkDetectionTime = Date.now() - t3;

    logger.cashu('p2pk_detection', {
      step: 'RECEIVE',
      hasP2PKProofs,
      p2pkDetectionTimeMs: p2pkDetectionTime,
      message: hasP2PKProofs ? 'Token contains P2PK locked proofs' : 'Regular token (no P2PK)',
    });

    // If P2PK locked, verify token belongs to current account
    if (hasP2PKProofs) {
      logger.info('⚠️ P2PK token detected, verifying account ownership');

      // Extract recipient pubkey from first P2PK proof
      let recipientPubkey: string | null = null;
      for (const proof of proofs) {
        if (isP2PKLocked(proof)) {
          recipientPubkey = getP2PKRecipient(proof.secret);
          logger.info('⚠️ Extracted recipient pubkey', { pubkey: recipientPubkey?.substring(0, 16) + '...' });
          if (recipientPubkey) {
            break;
          }
        }
      }

      if (recipientPubkey) {
        // Get current account first to log it
        const currentAccountIndex = await getCurrentAccount();
        logger.info('⚠️ Current account index', { accountIndex: currentAccountIndex });

        // Find which account owns this pubkey
        const accountMatch = await findAccountForP2PKToken(recipientPubkey, 50);

        if (!accountMatch) {
          logger.error('⚠️ No matching account found for P2PK token');
          throw new Error('This token is not locked to any of your accounts (checked 50 accounts). Make sure you are using the correct wallet.');
        }

        logger.info('⚠️ Token locked to account', { accountIndex: accountMatch.accountIndex });
        logger.info('⚠️ Comparing accounts', { current: currentAccountIndex, lockedTo: accountMatch.accountIndex });

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
        logger.info('[PERF] getOrFetchKeys took', { durationMs: Date.now() - t4b });
        return result;
      })(),

      // 2. Get private key if P2PK (only if needed)
      hasP2PKProofs ? (async () => {
        const t4c = Date.now();
        logger.info('P2PK locked proofs detected, getting private key');

        // Get cached taproot address and private key
        const p2pkKey = await getP2PKPrivateKey();

        logger.info('[PERF] getP2PKPrivateKey took', { durationMs: Date.now() - t4c });
        return p2pkKey;
      })() : null
    ]);
    logger.info('[PERF] Parallel operations (getKeys + deriveKey) took', { durationMs: Date.now() - t4 });

    // Extract keys from keyData
    let keys: Record<string, string>;
    let keysetId: string;
    if (keyData.keysets && keyData.keysets.length > 0) {
      keysetId = keyData.keysets[0].id;
      keys = keyData.keysets[0].keys;
    } else {
      keys = keyData.keys || keyData;
      keysetId = '';
    }

    let proofsToSwap = proofs;

    // If P2PK locked, sign them with the private key we already got
    if (hasP2PKProofs && privateKey) {
      const t5 = Date.now();
      logger.info('Signing P2PK proofs');
      proofsToSwap = await signP2PKProofs(proofs, privateKey);
      logger.info('[PERF] P2PK signing took', { durationMs: Date.now() - t5 });
    }

    // Create new blinded outputs for the same amounts
    // Use the actual sum in smallest units, not the display amount
    const t6 = Date.now();
    const totalSmallestUnits = proofs.reduce((sum, proof) => sum + proof.amount, 0);
    const amounts = splitAmount(totalSmallestUnits);
    const { outputs, blindingData } = await createBlindedOutputs(amounts, keysetId);
    logger.info('[PERF] Create blinded outputs took', { durationMs: Date.now() - t6 });

    // Swap: give received proofs (signed if P2PK), get new proofs
    const t7 = Date.now();
    logger.info('Swapping tokens', { inputCount: proofsToSwap.length, outputCount: outputs.length });
    const response = await swapTokensAPI(proofsToSwap, outputs);
    logger.info('[PERF] Swap API call took', { durationMs: Date.now() - t7 });

    // Unblind to create our new proofs
    const t8 = Date.now();
    const newProofs = unblindSignatures(
      response.signatures,
      blindingData,
      keys,
      response.signatures[0]?.id || keysetId
    );
    logger.info('[PERF] Unblind signatures took', { durationMs: Date.now() - t8 });

    // Add swapped proofs to wallet
    const t9 = Date.now();
    await addProofs(newProofs);
    const saveTime = Date.now() - t9;

    const totalTime = Date.now() - perfStart;

    logger.cashu('receive_token_complete', {
      step: 'RECEIVE',
      amount,
      proofCount: newProofs.length,
      totalTimeMs: totalTime,
      saveTimeMs: saveTime,
      wasP2PK: hasP2PKProofs,
      message: 'Token successfully received and added to wallet',
    });

    txn.finish('ok');

    return {
      amount,
      proofCount: newProofs.length,
    };
  } catch (error) {
    logger.cashu('receive_token_error', {
      step: 'RECEIVE',
      error: (error as Error).message,
    });
    txn.finish('error');
    throw error;
  }
};
