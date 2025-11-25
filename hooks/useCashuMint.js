/**
 * useCashuMint Hook
 * Handles Cashu mint operations (Runes → Cashu)
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { logger } from '../utils/logger';
import {
  requestMint,
  checkMintStatus,
  completeMint,
} from '../services/cashu/cashuWalletService';
import { usePolling } from './usePolling';

export function useCashuMint({ fetchBalance, setIsLoading, setError }) {
  const [pendingMints, setPendingMints] = useState([]);

  /**
   * Start mint process - get deposit address
   */
  const startMint = useCallback(async (amount) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.cashu('mint_started', { amount });
      const quote = await requestMint(amount);

      setPendingMints((prev) => [
        ...prev,
        { ...quote, createdAt: Date.now() },
      ]);

      logger.cashu('mint_quote_received', { quoteId: quote.quoteId?.substring(0, 8) });
      return quote;
    } catch (err) {
      logger.error('Failed to start mint', { error: err.message });
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError]);

  /**
   * Check mint status and complete if paid
   */
  const checkAndCompleteMint = useCallback(async (quoteId) => {
    try {
      logger.cashu('mint_check_status', { quoteId: quoteId?.substring(0, 8) });
      const status = await checkMintStatus(quoteId);

      if (status.paid) {
        logger.cashu('mint_paid_completing', { quoteId: quoteId?.substring(0, 8) });

        const quote = pendingMints.find((q) => q.quoteId === quoteId);
        if (!quote) {
          throw new Error('Quote not found');
        }

        const proofs = await completeMint(quoteId, quote.amount);
        setPendingMints((prev) => prev.filter((q) => q.quoteId !== quoteId));
        await fetchBalance();

        logger.cashu('mint_completed', { quoteId: quoteId?.substring(0, 8), proofCount: proofs.length });

        return {
          completed: true,
          proofs,
          amount: quote.amount,
        };
      }

      return {
        completed: false,
        state: status.state,
      };
    } catch (err) {
      logger.error('Failed to check/complete mint', { error: err.message, quoteId });
      throw err;
    }
  }, [pendingMints, fetchBalance]);

  /**
   * Remove a pending mint quote
   */
  const removePendingMint = useCallback((quoteId) => {
    setPendingMints((prev) => prev.filter((q) => q.quoteId !== quoteId));
  }, []);

  /**
   * Automatic one-step mint
   */
  const autoMint = useCallback(async (amount, onSuccess) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Starting auto-mint', { amount });
      const quote = await requestMint(amount);

      setPendingMints((prev) => [
        ...prev,
        { ...quote, createdAt: Date.now() },
      ]);

      logger.info('Auto-mint quote created', {
        quoteId: quote.quoteId,
        depositAddress: quote.depositAddress,
      });

      if (onSuccess) {
        onSuccess({
          address: quote.depositAddress,
          amount: quote.amount,
          quoteId: quote.quoteId,
        });
      }

      return quote;
    } catch (err) {
      logger.error('Failed to auto-mint', { error: err.message });
      setError(err.message);
      Alert.alert('Error', err.message || 'Failed to start mint');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError]);

  // Auto-complete pending mints
  usePolling({
    onPoll: async () => {
      for (const mint of pendingMints) {
        try {
          const result = await checkAndCompleteMint(mint.quoteId);
          if (result.completed) {
            logger.info('Auto-completed mint', { quoteId: mint.quoteId, amount: result.amount });
          }
        } catch (error) {
          logger.debug('Error auto-completing mint', { quoteId: mint.quoteId, error: error.message });
        }
      }
    },
    interval: 5000,
    enabled: pendingMints.length > 0,
    immediate: false,
  });

  return {
    pendingMints,
    startMint,
    checkAndCompleteMint,
    removePendingMint,
    autoMint,
    setPendingMints,
  };
}
