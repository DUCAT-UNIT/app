import { useMemo } from 'react';
import { logger } from '../utils/logger';

/**
 * Hook to extract and validate route params for ConfirmationScreen
 * Centralizes all route param handling in one place
 */
export function useConfirmationParams(route) {
  const params = useMemo(() => {
    const extractedParams = {
      // Turbo transaction params
      isTurbo: route?.params?.isTurbo === true,
      mintQuoteId: route?.params?.mintQuoteId,
      mintAmount: route?.params?.mintAmount,
      turboRecipient: route?.params?.turboRecipient,
      skipMint: route?.params?.skipMint === true,

      // Cashu mint params (for threshold conversion)
      cashuMint: route?.params?.cashuMint === true,
      quoteId: route?.params?.quoteId,

      // Regular transaction params
      broadcastedTxid: route?.params?.broadcastedTxid,
    };

    logger.debug('[useConfirmationParams] Extracted route params:', extractedParams);

    return extractedParams;
  }, [
    route?.params?.isTurbo,
    route?.params?.mintQuoteId,
    route?.params?.mintAmount,
    route?.params?.turboRecipient,
    route?.params?.skipMint,
    route?.params?.cashuMint,
    route?.params?.quoteId,
    route?.params?.broadcastedTxid,
  ]);

  return params;
}
