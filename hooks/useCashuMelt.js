/**
 * useCashuMelt Hook
 * Handles Cashu melt operations (Cashu → Runes)
 */

import { useCallback } from 'react';
import { logger } from '../utils/logger';
import { requestMelt, completeMelt } from '../services/cashu/cashuWalletService';

export function useCashuMelt({ setIsLoading, setError, setBalance }) {
  /**
   * Start melt process - get quote
   */
  const startMelt = useCallback(async (address, amount) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Starting melt', { address, amount });
      const quote = await requestMelt(address, amount);
      logger.info('Melt quote created', { quoteId: quote.quoteId, total: quote.total });
      return quote;
    } catch (err) {
      logger.error('Failed to start melt', { error: err.message });
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError]);

  /**
   * Complete melt - send proofs and get Runes
   */
  const finishMelt = useCallback(async (quoteId, totalAmount) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Completing melt', { quoteId, totalAmount });
      const result = await completeMelt(quoteId, totalAmount);
      setBalance(result.balance);
      logger.info('Melt completed', { txid: result.txid });
      return result;
    } catch (err) {
      logger.error('Failed to complete melt', { error: err.message });
      setError(err.message);
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
