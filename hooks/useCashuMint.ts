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
import { getCurrentCashuAccount } from '../services/cashu/cashuProofManager';
import { usePolling } from './usePolling';
import type { CashuProof, MintQuoteResult } from '../services/cashu/cashuWalletService';
import { DEFAULT_CASHU_UNIT, type CashuUnit } from '../services/cashu/cashuUnits';

export interface PendingMintQuote extends MintQuoteResult {
  createdAt: number;
  taprootAddress?: string;
  [key: string]: unknown;
}

interface UseCashuMintParams {
  fetchBalance: () => Promise<number>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  unit?: CashuUnit;
}

interface MintCheckResult {
  completed: boolean;
  proofs?: CashuProof[];
  amount?: number;
  state?: string;
  alreadyIssued?: boolean;
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

export function useCashuMint({
  fetchBalance,
  setIsLoading,
  setError,
  unit = DEFAULT_CASHU_UNIT,
}: UseCashuMintParams): UseCashuMintReturn {
  const [pendingMints, setPendingMints] = useState<PendingMintQuote[]>([]);
  const isDefaultUnit = unit === DEFAULT_CASHU_UNIT;

  const assertPendingMintAccount = useCallback((quote: PendingMintQuote | undefined): void => {
    if (!quote?.taprootAddress) {
      return;
    }

    const currentAccount = getCurrentCashuAccount();
    if (currentAccount !== quote.taprootAddress) {
      throw new Error('Cashu account changed during mint completion; switch back to the account that created this quote to recover it');
    }
  }, []);

  /**
   * Start mint process - get deposit address
   */
  const startMint = useCallback(async (amount: number): Promise<MintQuoteResult> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.cashu('mint_started', { amount });
      const quote = isDefaultUnit ? await requestMint(amount) : await requestMint(amount, unit);
      const taprootAddress = getCurrentCashuAccount() ?? undefined;

      setPendingMints((prev) => [
        ...prev,
        { ...quote, createdAt: Date.now(), taprootAddress },
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
  }, [setIsLoading, setError, unit, isDefaultUnit]);

  /**
   * Check mint status and complete if paid
   */
  const checkAndCompleteMint = useCallback(async (quoteId: string): Promise<MintCheckResult> => {
    try {
      logger.cashu('mint_check_status', { quoteId: quoteId?.substring(0, 8) });
      const status = await checkMintStatus(quoteId);

      const hasMintAccounting = status.amountPaid !== undefined || status.amountIssued !== undefined;
      const hasAvailableAmount = status.availableAmount > 0;
      const shouldCompleteMint = hasAvailableAmount || (!hasMintAccounting && status.state === 'PAID');
      const quote = pendingMints.find((q) => q.quoteId === quoteId);

      if (shouldCompleteMint) {
        logger.cashu('mint_paid_completing', { quoteId: quoteId?.substring(0, 8) });

        if (!quote) {
          throw new Error('Quote not found');
        }
        assertPendingMintAccount(quote);
        if (quote.amount === undefined) {
          throw new Error('Quote amount is undefined');
        }

        const claimAmount = hasAvailableAmount ? status.availableAmount : quote.amount;
        const proofs = isDefaultUnit
          ? await completeMint(quoteId, claimAmount)
          : await completeMint(quoteId, claimAmount, unit);
        setPendingMints((prev) => prev.filter((q) => q.quoteId !== quoteId));
        await fetchBalance();

        logger.cashu('mint_completed', { quoteId: quoteId?.substring(0, 8), proofCount: proofs.length });

        return {
          completed: true,
          proofs,
          amount: claimAmount,
        };
      }

      const alreadyIssued = status.state === 'ISSUED'
        || (
          hasMintAccounting
          && (status.amountPaid ?? 0) > 0
          && (status.amountIssued ?? 0) >= (status.amountPaid ?? 0)
        );

      if (alreadyIssued) {
        assertPendingMintAccount(quote);
        setPendingMints((prev) => prev.filter((q) => q.quoteId !== quoteId));
        await fetchBalance();
        logger.cashu('mint_already_issued', { quoteId: quoteId?.substring(0, 8) });
        return {
          completed: true,
          amount: status.amountIssued,
          state: status.state,
          alreadyIssued: true,
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
  }, [pendingMints, fetchBalance, unit, isDefaultUnit, assertPendingMintAccount]);

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
      const quote = isDefaultUnit ? await requestMint(amount) : await requestMint(amount, unit);
      const taprootAddress = getCurrentCashuAccount() ?? undefined;

      setPendingMints((prev) => [
        ...prev,
        { ...quote, createdAt: Date.now(), taprootAddress },
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
  }, [setIsLoading, setError, unit, isDefaultUnit]);

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
