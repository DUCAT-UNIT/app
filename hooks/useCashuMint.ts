/**
 * useCashuMint Hook
 * Handles Cashu mint operations (Runes → Cashu)
 */

import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';
import { logger } from '../utils/logger';
import {
  requestMint,
  checkMintStatus,
  completeMint,
} from '../services/cashu/cashuWalletService';
import { usePolling } from './usePolling';
import type { MintQuoteResult } from '../services/cashu/operations/cashuMintOperations';
import type { CashuProof } from '../services/cashu/crypto';

export interface PendingMintQuote extends MintQuoteResult {
  createdAt: number;
  [key: string]: unknown;
}

interface UseCashuMintParams {
  fetchBalance: () => Promise<number>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

interface MintCheckResult {
  completed: boolean;
  proofs?: CashuProof[];
  amount?: number;
  state?: string;
}

interface AutoMintSuccessData {
  address: string;
  amount: number;
  quoteId: string;
}

interface UseCashuMintReturn {
  pendingMints: PendingMintQuote[];
  startMint: (amount: number) => Promise<MintQuoteResult>;
  checkAndCompleteMint: (quoteId: string) => Promise<MintCheckResult>;
  removePendingMint: (quoteId: string) => void;
  autoMint: (amount: number, onSuccess?: (data: AutoMintSuccessData) => void) => Promise<MintQuoteResult>;
  setPendingMints: Dispatch<SetStateAction<PendingMintQuote[]>>;
}

export function useCashuMint({ fetchBalance, setIsLoading, setError }: UseCashuMintParams): UseCashuMintReturn {
  const [pendingMints, setPendingMints] = useState<PendingMintQuote[]>([]);

  /**
   * Start mint process - get deposit address
   */
  const startMint = useCallback(async (amount: number): Promise<MintQuoteResult> => {
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to start mint', { error: errorMessage });
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError]);

  /**
   * Check mint status and complete if paid
   */
  const checkAndCompleteMint = useCallback(async (quoteId: string): Promise<MintCheckResult> => {
    try {
      logger.cashu('mint_check_status', { quoteId: quoteId?.substring(0, 8) });
      const status = await checkMintStatus(quoteId);

      if (status.paid) {
        logger.cashu('mint_paid_completing', { quoteId: quoteId?.substring(0, 8) });

        const quote = pendingMints.find((q) => q.quoteId === quoteId);
        if (!quote) {
          throw new Error('Quote not found');
        }
        if (quote.amount === undefined) {
          throw new Error('Quote amount is undefined');
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to check/complete mint', { error: errorMessage, quoteId });
      throw err;
    }
  }, [pendingMints, fetchBalance]);

  /**
   * Remove a pending mint quote
   */
  const removePendingMint = useCallback((quoteId: string): void => {
    setPendingMints((prev) => prev.filter((q) => q.quoteId !== quoteId));
  }, []);

  /**
   * Automatic one-step mint
   */
  const autoMint = useCallback(async (amount: number, onSuccess?: (data: AutoMintSuccessData) => void): Promise<MintQuoteResult> => {
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

      if (onSuccess && quote.amount !== undefined) {
        onSuccess({
          address: quote.depositAddress,
          amount: quote.amount,
          quoteId: quote.quoteId,
        });
      }

      return quote;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to auto-mint', { error: errorMessage });
      setError(errorMessage);
      Alert.alert('Error', errorMessage || 'Failed to start mint');
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
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.debug('Error auto-completing mint', { quoteId: mint.quoteId, error: errorMessage });
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
