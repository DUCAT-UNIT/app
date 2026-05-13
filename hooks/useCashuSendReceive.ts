/**
 * useCashuSendReceive Hook
 * Handles Cashu send and receive operations (Cashu ↔ Cashu)
 */

import { useCallback, Dispatch, SetStateAction } from 'react';
import { logger } from '../utils/logger';
import {
  decodeTokenMetadata,
  receiveToken,
  sendToken as sendTokenService,
} from '../services/cashu/cashuWalletService';
import {
  deleteReceivedTokenByToken,
  saveReceivedToken,
} from '../services/cashu/cashuLockedTokensService';
import type { ReceiveTokenResult, SendTokenResult } from '../services/cashu/cashuWalletService';
import {
  DEFAULT_CASHU_UNIT,
  normalizeCashuUnit,
  type CashuUnit,
} from '../services/cashu/cashuUnits';

interface UseCashuSendReceiveParams {
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setBalance: Dispatch<SetStateAction<number>>;
  fetchBalance: () => Promise<number>;
  taprootAddress?: string;
  unit?: CashuUnit;
}

interface UseCashuSendReceiveReturn {
  receive: (token: string) => Promise<ReceiveTokenResult>;
  send: (amount: number) => Promise<SendTokenResult>;
}

export function useCashuSendReceive({
  setIsLoading,
  setError,
  setBalance,
  fetchBalance,
  taprootAddress,
  unit = DEFAULT_CASHU_UNIT,
}: UseCashuSendReceiveParams): UseCashuSendReceiveReturn {
  /**
   * Receive Cashu token from QR or paste
   */
  const receive = useCallback(async (token: string): Promise<ReceiveTokenResult> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Receiving Cashu token');
      let tokenUnit = unit;
      let pendingAmount = 0;
      try {
        const metadata = decodeTokenMetadata(token);
        tokenUnit = metadata.unit ? normalizeCashuUnit(metadata.unit) : DEFAULT_CASHU_UNIT;
        pendingAmount = metadata.amount;
        await saveReceivedToken(
          token,
          'Cashu Receive',
          metadata.amount,
          taprootAddress || '',
          tokenUnit,
          { pendingRedeem: true }
        );
      } catch (metadataError) {
        logger.warn('Failed to save pending received token:', {
          error: metadataError instanceof Error ? metadataError.message : String(metadataError),
        });
      }

      const result = await receiveToken(token, unit);

      // Save to transaction history
      try {
        await saveReceivedToken(
          token,
          'Cashu Receive',
          result.amount || pendingAmount,
          taprootAddress || '',
          tokenUnit
        );
        logger.info('Received token saved to history');
      } catch (saveErr) {
        logger.warn('Failed to save received token to history:', { error: saveErr instanceof Error ? saveErr.message : String(saveErr) });
      }

      await fetchBalance();
      logger.info('Token received', { amount: result.amount });
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to receive token', { error: errorMessage });
      setError(errorMessage);
      setIsLoading(false);
      await deleteReceivedTokenByToken(token);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError, fetchBalance, taprootAddress, unit]);

  /**
   * Send Cashu token (for QR code or sharing)
   */
  const send = useCallback(async (amount: number): Promise<SendTokenResult> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Sending Cashu token', { amount });
      const result = unit === DEFAULT_CASHU_UNIT
        ? await sendTokenService(amount, true)
        : await sendTokenService(amount, true, unit);
      setBalance(result.balance);
      logger.info('Token sent', { amount: result.amount });
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to send token', { error: errorMessage });
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError, setBalance, unit]);

  return {
    receive,
    send,
  };
}
