import { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { completeMint } from '../services/cashu/cashuWalletService';
import { checkMintQuote } from '../services/cashu/cashuMintClient';
import { sendP2PKToken } from '../services/cashu/operations/cashuSendP2PK';
import { extractPubkeyFromTaprootAddress } from '../utils/bitcoin';
import { saveSentLockedToken } from '../services/cashu/cashuLockedTokensService';
import { shortenCashuToken } from '../services/urlShortener';
import type { SnackbarParams } from '../contexts/NotificationContext';

type ProcessingStage = 'converting' | 'ready';

interface UseTurboMintCompletionParams {
  isTurbo: boolean;
  mintQuoteId: string | null;
  mintAmount: number;
  turboRecipient: string | null;
  skipMint: boolean;
  senderTaprootAddress: string | undefined;
  fetchTransactionHistory: () => Promise<void>;
  refreshCashuBalance: () => Promise<void>;
  showSnackbar: (params: SnackbarParams) => void;
  showToast: (message: string, type: string) => void;
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
  refreshCashuBalance,
  showSnackbar,
  showToast,
}: UseTurboMintCompletionParams): UseTurboMintCompletionReturn {
  const [turboToken, setTurboToken] = useState<string | null>(null);
  const [turboDeeplink, setTurboDeeplink] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(
    (skipMint || !isTurbo) ? 'ready' : 'converting'
  );
  const [isCompletingMint, setIsCompletingMint] = useState(false);
  const hasMintCompleted = useRef(false);

  useEffect(() => {
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
      setIsCompletingMint(true);
      try {
        logger.debug('[useTurboMintCompletion] Starting to poll for payment confirmation');

        // Poll for payment confirmation
        let paidQuote = null;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds

        while (!paidQuote && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const quote = await checkMintQuote(mintQuoteId);
          logger.debug(`[useTurboMintCompletion] Check ${attempts + 1}/${maxAttempts}:`, quote);
          if (quote.state === 'PAID' || quote.state === 'ISSUED') {
            paidQuote = quote;
            break;
          }
          attempts++;
        }

        if (paidQuote && paidQuote.amount !== undefined) {
          logger.debug('[useTurboMintCompletion] Payment confirmed! Completing mint with amount:', paidQuote.amount);
          // Complete mint to get e-cash tokens - quote.amount is already in smallest units
          const proofs = await completeMint(mintQuoteId, paidQuote.amount);
          logger.debug('[useTurboMintCompletion] Mint completed successfully, received proofs:', proofs?.length);

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
              logger.debug('[useTurboMintCompletion] sendP2PKToken result:', { hasToken: !!result?.token, resultType: typeof result });
              const token = result?.token;
              if (!token) {
                throw new Error('sendP2PKToken returned no token');
              }
              logger.debug('[useTurboMintCompletion] P2PK token created:', token.substring(0, 50));

              // Generate shortened URL for the token
              const shortUrl = await shortenCashuToken(token);
              logger.debug('[useTurboMintCompletion] Generated short URL:', shortUrl);
              setTurboDeeplink(shortUrl);

              // Store the sent P2PK token
              // saveSentLockedToken(token, recipient, amount, txid, shortUrl, taprootAddress)
              await saveSentLockedToken(token, turboRecipient, mintAmount, null, shortUrl, senderTaprootAddress);
              logger.debug('[useTurboMintCompletion] P2PK token stored successfully');

              // Store token for display
              logger.debug('[useTurboMintCompletion] Setting turboToken state with token length:', token?.length);
              setTurboToken(token);
              setProcessingStage('ready'); // Transition to ready stage
              logger.debug('[useTurboMintCompletion] turboToken state has been set, transitioned to ready stage');
            } catch (storageError) {
              logger.error('[useTurboMintCompletion] Failed to generate/save token:', { error: storageError instanceof Error ? storageError.message : String(storageError) });
              // Non-critical error - still transition to ready stage so user isn't stuck
              setProcessingStage('ready');
            }
          } else {
            // No turbo recipient - just transition to ready
            setProcessingStage('ready');
          }

          // Refresh balance
          await fetchTransactionHistory();

          setIsCompletingMint(false);

          // Refresh cashu balance to reflect the new tokens
          await refreshCashuBalance();
          logger.debug('[useTurboMintCompletion] Cashu balance refreshed');

          // Different message based on whether this is address-bound or regular Turbo
          if (turboRecipient) {
            showSnackbar({ type: 'success', action: 'send' });
          } else {
            showSnackbar({ type: 'success', action: 'convert' });
          }
        } else {
          logger.debug('[useTurboMintCompletion] Payment not confirmed after 30 seconds');
          setIsCompletingMint(false);
          showToast('Payment sent. E-cash will be available once confirmed.', 'info');
        }
      } catch (error: unknown) {
        logger.error('[useTurboMintCompletion] Error during mint completion:', { error: error instanceof Error ? error.message : String(error) });
        setIsCompletingMint(false);
        showToast(`Failed to complete conversion: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    };

    completeMintProcess();
  }, [isTurbo, mintQuoteId, mintAmount, turboRecipient, skipMint, senderTaprootAddress, fetchTransactionHistory, refreshCashuBalance, showSnackbar, showToast, processingStage]);

  return {
    turboToken,
    turboDeeplink,
    processingStage,
    isCompletingMint,
  };
}
