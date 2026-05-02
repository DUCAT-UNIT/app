import { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { checkMintQuote, completeMint, sendP2PKToken } from '../services/cashu/cashuWalletService';
import { extractPubkeyFromTaprootAddress } from '../utils/bitcoin';
import { saveSentLockedToken } from '../services/cashu/cashuLockedTokensService';
import { shortenCashuToken } from '../services/urlShortener';
import { notify } from '../utils/notify';
import {
  savePendingTurboSend,
  updateTurboSendStage,
  clearPendingTurboSend,
} from '../services/cashu/cashuTurboRecovery';

type ProcessingStage = 'converting' | 'ready';

interface UseTurboMintCompletionParams {
  isTurbo: boolean;
  mintQuoteId: string | null;
  mintAmount: number;
  turboRecipient: string | null;
  skipMint: boolean;
  senderTaprootAddress: string | undefined;
  fetchTransactionHistory: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  refreshCashuBalance: () => Promise<void>;
}

interface UseTurboMintCompletionReturn {
  turboToken: string | null;
  turboDeeplink: string | null;
  processingStage: ProcessingStage;
  isCompletingMint: boolean;
}

/**
 * Hook to handle Turbo mint completion flow
 * - Polls for payment confirmation
 * - Completes mint to get e-cash tokens
 * - Creates P2PK locked token for recipient
 * - Generates shortened URL deeplink
 * - Manages processing stages
 */
export function useTurboMintCompletion({
  isTurbo,
  mintQuoteId,
  mintAmount,
  turboRecipient,
  skipMint,
  senderTaprootAddress,
  fetchTransactionHistory,
  fetchBalance,
  refreshCashuBalance,
}: UseTurboMintCompletionParams): UseTurboMintCompletionReturn {
  const [turboToken, setTurboToken] = useState<string | null>(null);
  const [turboDeeplink, setTurboDeeplink] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(
    (skipMint || !isTurbo) ? 'ready' : 'converting'
  );
  const [isCompletingMint, setIsCompletingMint] = useState(false);
  const hasMintCompleted = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    logger.debug('[useTurboMintCompletion] Checking mint completion:', {
      isTurbo,
      skipMint,
      mintQuoteId,
      hasMintCompleted: hasMintCompleted.current,
      processingStage,
    });

    // Only proceed if this is a Turbo flow that needs mint completion
    if (!isTurbo || skipMint || !mintQuoteId) {
      logger.debug('[useTurboMintCompletion] Not a turbo mint flow, skipping');
      return;
    }

    if (hasMintCompleted.current) {
      logger.debug('[useTurboMintCompletion] Mint already completed, skipping');
      return;
    }

    hasMintCompleted.current = true;
    logger.debug('[useTurboMintCompletion] Starting mint completion process');

    const completeMintProcess = async () => {
      if (!mountedRef.current) return;
      setIsCompletingMint(true);
      try {
        // Save pending turbo send state BEFORE starting (for crash recovery)
        if (turboRecipient && senderTaprootAddress) {
          await savePendingTurboSend(mintQuoteId, turboRecipient, mintAmount, senderTaprootAddress);
        }

        logger.debug('[useTurboMintCompletion] Starting to poll for payment confirmation');

        // Poll for payment confirmation
        // Mutinynet blocks ~30s + Ord indexing + mint deposit monitor (30s poll)
        // Need at least 120s to reliably catch deposits
        let paidQuote = null;
        let attempts = 0;
        const maxAttempts = 120;

        while (!paidQuote && attempts < maxAttempts) {
          if (!mountedRef.current) return;
          await new Promise(resolve => setTimeout(resolve, 2000));
          if (!mountedRef.current) return;
          try {
            const quote = await checkMintQuote(mintQuoteId);
            logger.debug(`[useTurboMintCompletion] Check ${attempts + 1}/${maxAttempts}:`, quote);
            if (quote.state === 'PAID' || quote.state === 'ISSUED') {
              paidQuote = quote;
              break;
            }
          } catch (pollError: unknown) {
            logger.warn(`[useTurboMintCompletion] Poll ${attempts + 1}/${maxAttempts} failed, retrying`, {
              error: pollError instanceof Error ? pollError.message : String(pollError),
            });
          }
          attempts++;
        }

        if (!mountedRef.current) return;

        if (paidQuote && paidQuote.amount !== undefined) {
          logger.debug('[useTurboMintCompletion] Payment confirmed! Completing mint with amount:', paidQuote.amount);
          // Complete mint to get e-cash tokens - quote.amount is already in smallest units
          const proofs = await completeMint(mintQuoteId, paidQuote.amount);
          if (!mountedRef.current) return;
          logger.debug('[useTurboMintCompletion] Mint completed successfully, received proofs:', proofs?.length);

          // Update stage: mint completed
          await updateTurboSendStage('mint_completed');

          // If we have a turbo recipient, create a P2PK locked token
          if (turboRecipient) {
            try {
              logger.debug('[useTurboMintCompletion] Creating P2PK locked token for recipient:', turboRecipient);

              // Extract pubkey from P2TR address
              const recipientPubkey = extractPubkeyFromTaprootAddress(turboRecipient);
              logger.debug('[useTurboMintCompletion] Extracted recipient pubkey:', recipientPubkey);

              if (!recipientPubkey) {
                throw new Error('Failed to extract pubkey from recipient address');
              }

              // Send exactly the mint amount as P2PK locked token
              logger.debug('[useTurboMintCompletion] Creating P2PK token for amount:', mintAmount);
              const result = await sendP2PKToken(mintAmount, recipientPubkey, {});
              if (!mountedRef.current) return;
              logger.debug('[useTurboMintCompletion] sendP2PKToken result:', { hasToken: !!result?.token, resultType: typeof result });
              const token = result?.token;
              if (!token) {
                throw new Error('sendP2PKToken returned no token');
              }
              logger.debug('[useTurboMintCompletion] P2PK token created', { tokenLength: token.length });

              // SECURITY: Save token in recovery state IMMEDIATELY after creation.
              // If app crashes before saveSentLockedToken, recovery can re-save.
              await updateTurboSendStage('p2pk_created', { token });

              // Generate shortened URL for the token
              const shortUrl = await shortenCashuToken(token);
              if (!mountedRef.current) return;
              logger.debug('[useTurboMintCompletion] Generated short URL', { shortUrlLength: shortUrl.length });
              setTurboDeeplink(shortUrl);

              // Store the sent P2PK token
              // saveSentLockedToken(token, recipient, amount, txid, shortUrl, taprootAddress)
              await saveSentLockedToken(token, turboRecipient, mintAmount, null, shortUrl, senderTaprootAddress);
              if (!mountedRef.current) return;
              logger.debug('[useTurboMintCompletion] P2PK token stored successfully');

              // Clear pending turbo send - successfully completed!
              await clearPendingTurboSend();

              // Store token for display
              logger.debug('[useTurboMintCompletion] Setting turboToken state with token length:', token?.length);
              setTurboToken(token);
              setProcessingStage('ready'); // Transition to ready stage
              logger.debug('[useTurboMintCompletion] turboToken state has been set, transitioned to ready stage');
            } catch (storageError) {
              logger.error('[useTurboMintCompletion] Failed to generate/save token:', { error: storageError instanceof Error ? storageError.message : String(storageError) });
              // Non-critical error - still transition to ready stage so user isn't stuck
              // Note: pending turbo send NOT cleared - will be recovered on next app start
              if (mountedRef.current) setProcessingStage('ready');
            }
          } else {
            // No turbo recipient - just transition to ready
            // Clear pending since there's no P2PK to send
            await clearPendingTurboSend();
            setProcessingStage('ready');
          }

          // Refresh all balances — Runes (ord indexer) + Cashu + TX history
          await Promise.all([
            fetchTransactionHistory(),
            fetchBalance(),
          ]);

          if (!mountedRef.current) return;
          setIsCompletingMint(false);

          // Refresh cashu balance to reflect the new tokens
          await refreshCashuBalance();
          logger.debug('[useTurboMintCompletion] Cashu balance refreshed');

          // Different message based on whether this is address-bound or regular Turbo
          if (turboRecipient) {
            notify.transaction.success('send');
          } else {
            notify.transaction.success('convert');
          }
        } else {
          logger.debug('[useTurboMintCompletion] Payment not confirmed after 4 minutes');
          // Don't clear pending turbo send - will resume polling on next app start
          if (mountedRef.current) setIsCompletingMint(false);
          notify.cashu.paymentSentAwaiting();
        }
      } catch (error: unknown) {
        logger.error('[useTurboMintCompletion] Error during mint completion:', { error: error instanceof Error ? error.message : String(error) });
        // Don't clear pending turbo send - will retry on next app start
        if (mountedRef.current) setIsCompletingMint(false);
        notify.cashu.conversionFailed(error instanceof Error ? error.message : String(error));
      }
    };

    completeMintProcess();

    return () => {
      mountedRef.current = false;
    };
  }, [isTurbo, mintQuoteId, mintAmount, turboRecipient, skipMint, senderTaprootAddress, fetchTransactionHistory, fetchBalance, refreshCashuBalance, processingStage]);

  return {
    turboToken,
    turboDeeplink,
    processingStage,
    isCompletingMint,
  };
}
