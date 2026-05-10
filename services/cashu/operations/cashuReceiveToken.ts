/**
 * Cashu Receive Token Operation
 * Handles receiving tokens from QR codes or text
 */

import { logger } from '../../../utils/logger';
import { getCurrentAccount } from '../../secureStorageService';
import { getOrFetchKeys } from '../cashuBalanceService';
import {
  checkProofsSpent,
  MINT_URL,
  mintRequiresDleqProofs,
  swapTokens as swapTokensAPI,
} from '../cashuMintClient';
import { addProofs, loadProofs } from '../cashuProofManager';
import { clearProofRecoveryRecord, persistProofRecoveryRecord } from '../cashuProofRecoveryQueue';
import { clearPendingSwap, savePendingSwap, updateSwapWithResponse } from '../cashuSwapRecovery';
import {
  assertProofsMatchCashuUnit,
  calculateInputFees,
  resolveResponseSignatureKeysetForUnit,
  selectActiveCashuKeyset,
} from '../cashuKeysetUtils';
import {
  createBlindedOutputs,
  decodeToken,
  decodeTokenMetadata,
  splitAmount,
  sumProofs,
  unblindSignatures,
} from '../crypto';
import { getKeysetIdsFromMintKeys } from '../cashuTsCompat';
import { DEFAULT_CASHU_UNIT, normalizeCashuUnit, type CashuUnit } from '../cashuUnits';
import {
  findAccountForP2PKToken,
  getP2PKRecipient,
  isP2PKLocked,
  signP2PKProofs,
  verifyP2PKWitness,
} from '../p2pk';
import {
  assertCashuOperationAccountUnchanged,
  requireCashuOperationAccount,
} from './cashuAccountGuard';

export interface ReceiveTokenResult {
  amount: number;
  proofCount: number;
}

/**
 * Receive Cashu token (from QR code or paste)
 * Validates proofs haven't been spent and swaps them to prevent double-spending
 */
export const receiveToken = async (
  tokenString: string,
  expectedUnit?: CashuUnit
): Promise<ReceiveTokenResult> => {
  const txn = logger.startTransaction('receive_token');

  logger.cashu('receive_token_start', {
    step: 'RECEIVE',
    tokenLength: tokenString?.length,
  });

  try {
    const perfStart = Date.now();
    const operationAccount = requireCashuOperationAccount('Cashu receive token');

    // Decode token metadata first. cashuB tokens need mint keyset IDs for full proof hydration.
    const t1 = Date.now();
    const metadata = decodeTokenMetadata(tokenString);
    const decodeTime = Date.now() - t1;

    logger.cashu('token_decoded', {
      step: 'RECEIVE',
      decodeTimeMs: decodeTime,
      hasProofs: !!metadata?.proofs,
    });

    if (!metadata || !metadata.proofs || !Array.isArray(metadata.proofs)) {
      logger.cashu('token_invalid', { step: 'RECEIVE', error: 'Invalid token format' });
      throw new Error('Invalid token format');
    }

    const { mint } = metadata;
    const tokenUnit = normalizeCashuUnit(metadata.unit ?? DEFAULT_CASHU_UNIT);
    if (expectedUnit && tokenUnit !== expectedUnit) {
      throw new Error(`Expected Cashu ${expectedUnit} token but received ${tokenUnit}`);
    }
    const unit = expectedUnit ?? tokenUnit;

    logger.cashu('token_details', {
      step: 'RECEIVE',
      mint: mint?.substring(0, 30) + '...',
      proofCount: metadata.proofs.length,
      totalAmount: metadata.amount,
      unit,
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

    // Get mint keys before full decode so cashu-ts v4 can expand short keyset IDs.
    const t4 = Date.now();
    logger.info('Getting mint keys');
    const keyData = await getOrFetchKeys();
    const unitKeyset = selectActiveCashuKeyset(keyData, unit);
    logger.info('[PERF] getOrFetchKeys took', { durationMs: Date.now() - t4 });

    const decoded = decodeToken(tokenString, getKeysetIdsFromMintKeys(keyData));
    const { proofs } = decoded;
    assertProofsMatchCashuUnit(proofs, keyData, unit, 'Received Cashu token');

    // Check if we already have any of these proofs (prevent duplicate receives)
    const t2 = Date.now();
    const existingProofs = await loadProofs(unit);
    const existingSecrets = new Set(existingProofs.map((p) => p.secret));
    const hasDuplicate = proofs.some((p) => existingSecrets.has(p.secret));
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
    if (
      spendCheck.states.some((s) => {
        const state = (s as { state: string }).state;
        return state !== 'UNSPENT';
      })
    ) {
      throw new Error('Token proofs are not spendable');
    }

    // Check if any proofs are P2PK locked (do this first, it's fast)
    const t3 = Date.now();
    const hasP2PKProofs = proofs.some((p) => isP2PKLocked(p));
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
            pubkeyLength: recipientPubkey?.length,
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
          throw new Error(
            'This token is not locked to any of your accounts. Make sure you are using the correct wallet.'
          );
        }

        logger.info(`[P2PK TOKEN] ✅ Token locked to account: ${accountMatch.accountIndex}`);
        logger.info(
          `[P2PK TOKEN] 🔄 Comparing: current=${currentAccountIndex}, lockedTo=${accountMatch.accountIndex}`
        );

        if (accountMatch.accountIndex !== currentAccountIndex) {
          logger.error('⚠️ ACCOUNT MISMATCH - blocking claim');
          throw new Error(
            `This proof belongs to account ${accountMatch.accountIndex + 1}. Please switch to that account to claim this token.`
          );
        }

        logger.info('✅ P2PK token verified for current account', {
          accountIndex: currentAccountIndex,
        });

        // Use the private key from accountMatch - this is the correct key for this specific token
        p2pkPrivateKey = accountMatch.privateKey;
        logger.info('[P2PK TOKEN] Using private key from account match (not cached key)');
      } else {
        logger.warn('⚠️ Could not extract recipient pubkey from P2PK token');
      }
    }

    // Use the private key we got from findAccountForP2PKToken
    const privateKey = p2pkPrivateKey;

    const keysetId = unitKeyset.id;
    const keys = unitKeyset.keys!;

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

    // Create new blinded outputs for the net amount after mint input fees.
    // Use the actual sum in smallest units, not the display amount.
    const t6 = Date.now();
    const totalSmallestUnits = proofs.reduce((sum, proof) => sum + proof.amount, 0);
    const inputFees = calculateInputFees(proofsToSwap, keyData);
    const outputAmount = totalSmallestUnits - inputFees;
    if (outputAmount <= 0) {
      throw new Error('Token amount does not cover mint input fees');
    }
    const amounts = splitAmount(outputAmount);
    const { outputs, blindingData } = await createBlindedOutputs(amounts, keysetId);
    logger.info('[PERF] Create blinded outputs took', { durationMs: Date.now() - t6 });
    assertCashuOperationAccountUnchanged(operationAccount, 'Cashu receive swap setup');
    const pendingSwapId = await savePendingSwap({
      inputProofs: proofsToSwap,
      blindingData,
      keys,
      keysetId,
      secretTypeMap: Object.fromEntries(
        blindingData.map((item) => [item.secret, 'change' as const])
      ),
      unit,
    });

    // Swap: give received proofs (signed if P2PK), get new proofs
    const t7 = Date.now();
    logger.info('Swapping tokens', {
      inputCount: proofsToSwap.length,
      outputCount: outputs.length,
    });
    const requireDleq = await mintRequiresDleqProofs();
    const response = await swapTokensAPI(proofsToSwap, outputs);
    const { keysetId: signedKeysetId, keys: unblindKeys } = resolveResponseSignatureKeysetForUnit(
      response.signatures,
      keyData,
      unitKeyset,
      unit,
      `Cashu ${unit} receive swap`
    );
    await updateSwapWithResponse(
      {
        signatures: response.signatures,
      },
      pendingSwapId,
      { keysetId: signedKeysetId, keys: unblindKeys }
    );
    logger.info('[PERF] Swap API call took', { durationMs: Date.now() - t7 });

    // Unblind to create our new proofs
    const t8 = Date.now();
    const newProofs = unblindSignatures(
      response.signatures,
      blindingData,
      unblindKeys,
      signedKeysetId,
      { requireDleq }
    );
    logger.info('[PERF] Unblind signatures took', { durationMs: Date.now() - t8 });

    // SECURITY: Verify the swap returned proofs matching the expected total amount.
    // A malicious mint could return fewer/different proofs, causing silent fund loss.
    const newProofsTotal = sumProofs(newProofs);
    if (newProofsTotal !== outputAmount) {
      logger.error('SECURITY: Swap proof amount mismatch', {
        expected: outputAmount,
        received: newProofsTotal,
        proofsCount: newProofs.length,
      });
      throw new Error(
        `Swap verification failed: expected ${outputAmount} but received ${newProofsTotal}`
      );
    }

    // Add swapped proofs to wallet with retry logic to prevent fund loss
    const t9 = Date.now();
    const MAX_RETRIES = 3;
    let saveSuccess = false;
    let lastError: Error | null = null;
    let recoveryKey: string | null = null;

    assertCashuOperationAccountUnchanged(operationAccount, 'Cashu receive proof journaling');
    try {
      recoveryKey = await persistProofRecoveryRecord(
        newProofs,
        outputAmount,
        hasP2PKProofs ? 'receive_token_p2pk' : 'receive_token',
        undefined,
        unit
      );
    } catch (recoveryError) {
      logger.error('Failed to pre-store received proofs in recovery queue', {
        error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
        proofCount: newProofs.length,
        amount: outputAmount,
      });
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        assertCashuOperationAccountUnchanged(operationAccount, 'Cashu receive proof save');
        await addProofs(newProofs, true, unit);
        saveSuccess = true;
        logger.info('Successfully saved received proofs', {
          attempt,
          proofCount: newProofs.length,
          amount: outputAmount,
        });
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Failed to save proofs (attempt ${attempt}/${MAX_RETRIES})`, {
          error: lastError.message,
          proofCount: newProofs.length,
          amount: outputAmount,
        });

        // Wait before retrying (exponential backoff: 100ms, 200ms, 400ms)
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
        }
      }
    }

    // CRITICAL: If all retries failed, log proofs for manual recovery
    if (!saveSuccess) {
      logger.error('CRITICAL: Failed to save received proofs after all retries - FUND LOSS RISK', {
        error: lastError?.message,
        proofCount: newProofs.length,
        amount: outputAmount,
        timestamp: new Date().toISOString(),
        recoveryNote: 'Proofs were received from the mint but could not be persisted locally',
      });

      if (!recoveryKey) {
        try {
          assertCashuOperationAccountUnchanged(
            operationAccount,
            'Cashu receive fallback journaling'
          );
          recoveryKey = await persistProofRecoveryRecord(
            newProofs,
            outputAmount,
            hasP2PKProofs ? 'receive_token_p2pk' : 'receive_token',
            lastError?.message,
            unit
          );
        } catch (recoveryError) {
          logger.error('Failed to store proofs in recovery queue', {
            error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
          });
        }
      }

      // Re-throw the error to notify the user
      throw new Error(
        `Critical error: Received proofs from mint but failed to save locally. Error: ${lastError?.message}. Proofs logged for recovery.`
      );
    }

    if (recoveryKey) {
      try {
        await clearProofRecoveryRecord(recoveryKey);
      } catch (cleanupError) {
        logger.warn('Received proof recovery record cleanup failed after proof save', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          recoveryKey,
          unit,
        });
      }
    }

    try {
      assertCashuOperationAccountUnchanged(operationAccount, 'Cashu receive swap cleanup');
      await clearPendingSwap(pendingSwapId);
    } catch (cleanupError) {
      logger.warn('Pending receive swap cleanup failed after proof save', {
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        pendingSwapId,
        unit,
      });
    }

    const saveTime = Date.now() - t9;

    const totalTime = Date.now() - perfStart;

    logger.cashu('receive_token_complete', {
      step: 'RECEIVE',
      amount: outputAmount,
      proofCount: newProofs.length,
      totalTimeMs: totalTime,
      saveTimeMs: saveTime,
      wasP2PK: hasP2PKProofs,
      message: 'Token successfully received and added to wallet',
    });

    txn.finish('ok');

    return {
      amount: outputAmount,
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
