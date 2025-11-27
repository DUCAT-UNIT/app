/**
 * useCashuSendReceive Hook
 * Handles Cashu send and receive operations (Cashu ↔ Cashu)
 */

import { useCallback, Dispatch, SetStateAction } from 'react';
import { logger } from '../utils/logger';
import {
  receiveToken,
  sendToken as sendTokenService,
} from '../services/cashu/cashuWalletService';
import type { ReceiveTokenResult } from '../services/cashu/operations/cashuReceiveToken';
import type { SendTokenResult } from '../services/cashu/operations/cashuSendToken';

interface UseCashuSendReceiveParams {
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setBalance: Dispatch<SetStateAction<number>>;
  fetchBalance: () => Promise<number>;
}

interface UseCashuSendReceiveReturn {
  receive: (token: string) => Promise<ReceiveTokenResult>;
  send: (amount: number) => Promise<SendTokenResult>;
}

export function useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance }: UseCashuSendReceiveParams): UseCashuSendReceiveReturn {
  /**
   * Receive Cashu token from QR or paste
   */
  const receive = useCallback(async (token: string): Promise<ReceiveTokenResult> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Receiving Cashu token');
      const result = await receiveToken(token);
      await fetchBalance();
      logger.info('Token received', { amount: result.amount });
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to receive token', { error: errorMessage });
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError, fetchBalance]);

  /**
   * Send Cashu token (for QR code or sharing)
   */
  const send = useCallback(async (amount: number): Promise<SendTokenResult> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Sending Cashu token', { amount });
      const result = await sendTokenService(amount, true);
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
  }, [setIsLoading, setError, setBalance]);

  return {
    receive,
    send,
  };
}
