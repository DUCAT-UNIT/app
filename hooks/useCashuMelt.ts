/**
 * useCashuMelt Hook
 * Handles Cashu melt operations (Cashu → Runes)
 */

import { useCallback, Dispatch, SetStateAction } from 'react';
import { logger } from '../utils/logger';
import { requestMelt, completeMelt } from '../services/cashu/cashuWalletService';
import type { MeltQuoteResult, MeltResult } from '../services/cashu/operations/cashuMeltOperations';

interface UseCashuMeltParams {
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setBalance: Dispatch<SetStateAction<number>>;
}

interface UseCashuMeltReturn {
  startMelt: (address: string, amount: number) => Promise<MeltQuoteResult>;
  finishMelt: (quoteId: string, totalAmount: number) => Promise<MeltResult>;
}

export function useCashuMelt({ setIsLoading, setError, setBalance }: UseCashuMeltParams): UseCashuMeltReturn {
  /**
   * Start melt process - get quote
   */
  const startMelt = useCallback(async (address: string, amount: number): Promise<MeltQuoteResult> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Starting melt', { address, amount });
      const quote = await requestMelt(address, amount);
      logger.info('Melt quote created', { quoteId: quote.quoteId, total: quote.total });
      return quote;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to start melt', { error: errorMessage });
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError]);

  /**
   * Complete melt - send proofs and get Runes
   */
  const finishMelt = useCallback(async (quoteId: string, totalAmount: number): Promise<MeltResult> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Completing melt', { quoteId, totalAmount });
      const result = await completeMelt(quoteId, totalAmount);
      setBalance(result.balance);
      logger.info('Melt completed', { txid: result.txid });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to complete melt', { error: errorMessage });
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError, setBalance]);

  return {
    startMelt,
    finishMelt,
  };
}
