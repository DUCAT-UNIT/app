import { useMemo } from 'react';
import { logger } from '../utils/logger';
import { normalizeCashuUnit, type CashuUnit } from '../services/cashu/cashuUnits';

interface ConfirmationRouteParams {
  isTurbo?: boolean;
  mintQuoteId?: string;
  mintAmount?: number;
  mintClaimAmount?: number;
  turboRecipient?: string;
  senderTaprootAddress?: string;
  cashuUnit?: CashuUnit;
  skipMint?: boolean;
  cashuMint?: boolean;
  quoteId?: string;
  broadcastedTxid?: string;
}

interface RouteWithParams {
  params?: ConfirmationRouteParams;
}

interface ExtractedConfirmationParams {
  isTurbo: boolean;
  mintQuoteId: string | undefined;
  mintAmount: number | undefined;
  mintClaimAmount: number | undefined;
  turboRecipient: string | undefined;
  senderTaprootAddress: string | undefined;
  cashuUnit: CashuUnit | undefined;
  skipMint: boolean;
  cashuMint: boolean;
  quoteId: string | undefined;
  broadcastedTxid: string | undefined;
}

/**
 * Hook to extract and validate route params for ConfirmationScreen
 * Centralizes all route param handling in one place
 */
export function useConfirmationParams(route: RouteWithParams | undefined): ExtractedConfirmationParams {
  const params = useMemo((): ExtractedConfirmationParams => {
    const extractedParams: ExtractedConfirmationParams = {
      // Turbo transaction params
      isTurbo: route?.params?.isTurbo === true,
      mintQuoteId: route?.params?.mintQuoteId,
      mintAmount: route?.params?.mintAmount,
      mintClaimAmount: route?.params?.mintClaimAmount,
      turboRecipient: route?.params?.turboRecipient,
      senderTaprootAddress: route?.params?.senderTaprootAddress,
      cashuUnit: route?.params?.cashuUnit
        ? normalizeCashuUnit(route.params.cashuUnit)
        : undefined,
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
    route?.params?.mintClaimAmount,
    route?.params?.turboRecipient,
    route?.params?.senderTaprootAddress,
    route?.params?.cashuUnit,
    route?.params?.skipMint,
    route?.params?.cashuMint,
    route?.params?.quoteId,
    route?.params?.broadcastedTxid,
  ]);

  return params;
}
