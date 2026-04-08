/**
 * Cashu Receive Token Operation
 * Handles receiving tokens from QR codes or text
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../../../utils/logger';
import { getCurrentAccount } from '../../secureStorageService';
import { DEVICE_ONLY } from '../../storagePolicy';
import { getOrFetchKeys } from '../cashuBalanceService';
import { checkProofsSpent,MINT_URL,swapTokens as swapTokensAPI } from '../cashuMintClient';
import { addProofs,loadProofs } from '../cashuProofManager';
import {
createBlindedOutputs,
decodeToken,
splitAmount,
sumProofs,
unblindSignatures
} from '../crypto';
import {
findAccountForP2PKToken,
getP2PKRecipient,
isP2PKLocked,
signP2PKProofs,
verifyP2PKWitness,
} from '../p2pk';

const FAILED_PROOF_RECOVERY_KEYS = 'cashu_failed_proof_recovery_keys_v1';

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

    // Mint-side double-spend check before any processing
    const spendCheck = await checkProofsSpent(proofs);
    if (!Array.isArray(spendCheck?.states) || spendCheck.states.length !== proofs.length) {
      throw new Error('Unable to verify token spend state with mint');
    }
    if (spendCheck.states.some((s) => {
      const state = (s as { state: string }).state;
      return state === 'SPENT';
    })) {
      throw new Error('Token proofs already spent');
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

    // If P2PK locked, verify token belongs to current account and get the private key
    let p2pkPrivateKey: string | null = null;
    if (hasP2PKProofs) {
      logger.info('⚠️ P2PK token detected, verifying account ownership');

      // Extract recipient pubkey from first P2PK proof
      let recipientPubkey: string | null = null;
      for (const proof of proofs) {
        if (isP2PKLocked(proof)) {
          recipientPubkey = getP2PKRecipient(proof.secret);
          logger.info('[P2PK TOKEN] Extracted recipient pubkey from token', {
            pubkeyPrefix: recipientPubkey?.substring(0, 12) + '...',
          });
          if (recipientPubkey) {
            break;
          }
        }
      }

      if (recipientPubkey) {
        // Get current account first to log it
        const currentAccountIndex = await getCurrentAccount();
        logger.info(`[P2PK TOKEN] 📍 Current account index: ${currentAccountIndex}`);

        // Find which account owns this pubkey - this also returns the correct private key
        const accountMatch = await findAccountForP2PKToken(recipientPubkey);

        if (!accountMatch) {
          logger.error('[P2PK TOKEN] ❌ No matching account found for P2PK token');
          throw new Error('This token is not locked to any of your accounts. Make sure you are using the correct wallet.');
        }

        logger.info(`[P2PK TOKEN] ✅ Token locked to account: ${accountMatch.accountIndex}`);
        logger.info(`[P2PK TOKEN] 🔄 Comparing: current=${currentAccountIndex}, lockedTo=${accountMatch.accountIndex}`);

        if (accountMatch.accountIndex !== currentAccountIndex) {
          logger.error('⚠️ ACCOUNT MISMATCH - blocking claim');
          throw new Error(`This proof belongs to account ${accountMatch.accountIndex + 1}. Please switch to that account to claim this token.`);
        }

        logger.info('✅ P2PK token verified for current account', { accountIndex: currentAccountIndex });

        // Use the private key from accountMatch - this is the correct key for this specific token
        p2pkPrivateKey = accountMatch.privateKey;
        logger.info('[P2PK TOKEN] 🔑 Using private key from account match (not cached key)', {
          privateKeyLength: accountMatch.privateKey?.length,
          expectedPubkey: recipientPubkey?.substring(0, 16) + '...',
        });
      } else {
        logger.warn('⚠️ Could not extract recipient pubkey from P2PK token');
      }
    }

    // Get mint keys (P2PK private key already obtained above if needed)
    const t4 = Date.now();
    logger.info('Getting mint keys');
    const keyData = await getOrFetchKeys();
    logger.info('[PERF] getOrFetchKeys took', { durationMs: Date.now() - t4 });

    // Use the private key we got from findAccountForP2PKToken
    const privateKey = p2pkPrivateKey;

    // Extract keys from keyData
    let keys: Record<string, string>;
    let keysetId: string;
    if (keyData.keysets && keyData.keysets.length > 0) {
      const unitKeyset = keyData.keysets.find(
        (ks: { unit?: string }) => ks.unit === 'unit'
      ) || keyData.keysets[0];
      keysetId = unitKeyset.id;
      keys = unitKeyset.keys;
    } else if (keyData.keys) {
      keys = keyData.keys;
      keysetId = '';
    } else {
      throw new Error('No keys available from mint');
    }

    let proofsToSwap = proofs;

    // If P2PK locked, sign them with the private key we already got
    if (hasP2PKProofs && privateKey) {
      const t5 = Date.now();
      logger.info('[P2PK TOKEN] About to sign proofs with privateKey');
      proofsToSwap = await signP2PKProofs(proofs, privateKey);
      logger.info('[PERF] P2PK signing took', { durationMs: Date.now() - t5 });

      // Client-side witness verification before sending to mint
      for (const proof of proofsToSwap) {
        if (isP2PKLocked(proof) && proof.witness) {
          const recipientPub = getP2PKRecipient(proof.secret);
          if (recipientPub) {
            const valid = await verifyP2PKWitness(proof.secret, proof.witness, recipientPub);
            if (!valid) {
              logger.error('P2PK witness verification failed before swap', {
                proofAmount: proof.amount,
              });
              throw new Error('P2PK witness signature invalid - aborting swap');
            }
          }
        }
      }
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

    // SECURITY: Verify the swap returned proofs matching the expected total amount.
    // A malicious mint could return fewer/different proofs, causing silent fund loss.
    const newProofsTotal = sumProofs(newProofs);
    if (newProofsTotal !== totalSmallestUnits) {
      logger.error('SECURITY: Swap proof amount mismatch', {
        expected: totalSmallestUnits,
        received: newProofsTotal,
        proofsCount: newProofs.length,
      });
      throw new Error(
        `Swap verification failed: expected ${totalSmallestUnits} but received ${newProofsTotal}`
      );
    }

    // Add swapped proofs to wallet with retry logic to prevent fund loss
    const t9 = Date.now();
    const MAX_RETRIES = 3;
    let saveSuccess = false;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await addProofs(newProofs);
        saveSuccess = true;
        logger.info('Successfully saved received proofs', {
          attempt,
          proofCount: newProofs.length,
          amount,
        });
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Failed to save proofs (attempt ${attempt}/${MAX_RETRIES})`, {
          error: lastError.message,
          proofCount: newProofs.length,
          amount,
        });

        // Wait before retrying (exponential backoff: 100ms, 200ms, 400ms)
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
        }
      }
    }

    // CRITICAL: If all retries failed, log proofs for manual recovery
    if (!saveSuccess) {
      logger.error('CRITICAL: Failed to save received proofs after all retries - FUND LOSS RISK', {
        error: lastError?.message,
        proofCount: newProofs.length,
        amount,
        timestamp: new Date().toISOString(),
        recoveryNote: 'Proofs were received from the mint but could not be persisted locally',
      });

      // Attempt to store in a recovery queue
      try {
        const recoveryKey = `cashu_failed_proofs_${Date.now()}`;
        const existingRegistryRaw = await SecureStore.getItemAsync(FAILED_PROOF_RECOVERY_KEYS);
        const existingRegistry = existingRegistryRaw ? JSON.parse(existingRegistryRaw) as string[] : [];
        const updatedRegistry = Array.from(new Set([...existingRegistry, recoveryKey]));
        await SecureStore.setItemAsync(recoveryKey, JSON.stringify({
          proofs: newProofs,
          amount,
          timestamp: new Date().toISOString(),
          error: lastError?.message,
        }), DEVICE_ONLY);
        await SecureStore.setItemAsync(FAILED_PROOF_RECOVERY_KEYS, JSON.stringify(updatedRegistry), DEVICE_ONLY);
        logger.info('Stored failed proofs in recovery queue', { recoveryKey });
      } catch (recoveryError) {
        logger.error('Failed to store proofs in recovery queue', {
          error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
        });
      }

      // Re-throw the error to notify the user
      throw new Error(`Critical error: Received proofs from mint but failed to save locally. Error: ${lastError?.message}. Proofs logged for recovery.`);
    }

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
  } catch (error: unknown) {
    logger.cashu('receive_token_error', {
      step: 'RECEIVE',
      error: (error as Error).message,
    });
    txn.finish('error');
    throw error;
  }
};
