import { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

/**
 * Hook to handle Cashu mint completion for threshold conversion
 * - Polls for payment confirmation
 * - Completes mint to get e-cash tokens
 * - Refreshes balances
 */
export function useCashuMintCompletion({
  cashuMint,
  quoteId,
  fetchTransactionHistory,
  refreshCashuBalance,
  showSnackbar,
  showToast,
}) {
  const [isCompletingMint, setIsCompletingMint] = useState(false);
  const hasCashuMintCompleted = useRef(false);

  useEffect(() => {
    logger.debug('[useCashuMintCompletion] Checking cashu mint completion:', {
      cashuMint,
      quoteId,
      hasCashuMintCompleted: hasCashuMintCompleted.current
    });

    // Only proceed if this is a Cashu mint flow with all required params
    if (!cashuMint || !quoteId) {
      return;
    }

    if (hasCashuMintCompleted.current) {
      logger.debug('[useCashuMintCompletion] Cashu mint already completed, skipping');
      return;
    }

    hasCashuMintCompleted.current = true;
    logger.debug('[useCashuMintCompletion] Starting cashu mint completion process');

    const completeCashuMintProcess = async () => {
      setIsCompletingMint(true);
      try {
        const { completeMint } = await import('../services/cashu/cashuWalletService');
        const { checkMintQuote } = await import('../services/cashu/cashuMintClient');
        logger.debug('[useCashuMintCompletion] Starting to poll for payment confirmation');

        // Poll for payment confirmation
        let paidQuote = null;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds

        while (!paidQuote && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const quote = await checkMintQuote(quoteId);
          logger.debug(`[useCashuMintCompletion] Cashu check ${attempts + 1}/${maxAttempts}:`, quote);
          if (quote.state === 'PAID' || quote.state === 'ISSUED') {
            paidQuote = quote;
            break;
          }
          attempts++;
        }

        if (paidQuote) {
          logger.debug('[useCashuMintCompletion] Payment confirmed! Completing cashu mint with amount:', paidQuote.amount);
          // Complete mint to get e-cash tokens - quote.amount is already in smallest units
          await completeMint(quoteId, paidQuote.amount);
          logger.debug('[useCashuMintCompletion] Cashu mint completed successfully');

          // Refresh transaction history and balance
          if (fetchTransactionHistory) {
            await fetchTransactionHistory();
          }

          // Refresh cashu balance to reflect the new tokens
          await refreshCashuBalance();
          logger.debug('[useCashuMintCompletion] Cashu balance refreshed after threshold conversion');

          setIsCompletingMint(false);
          showSnackbar({ type: 'success', action: 'convert' });
        } else {
          logger.debug('[useCashuMintCompletion] Payment not confirmed after 30 seconds');
          setIsCompletingMint(false);
          showToast('Payment sent. Ecash will be available once confirmed.', 'info');
        }
      } catch (error) {
        logger.error('[useCashuMintCompletion] Error during cashu mint completion:', error);
        setIsCompletingMint(false);
        showToast(`Failed to complete conversion: ${error.message}`, 'error');
      }
    };

    completeCashuMintProcess();
  }, [cashuMint, quoteId, fetchTransactionHistory, refreshCashuBalance, showSnackbar, showToast]);

  return {
    isCompletingMint,
  };
}
