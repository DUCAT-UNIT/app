/**
 * useCashuSendReceive Hook
 * Handles Cashu send and receive operations (Cashu ↔ Cashu)
 */

import { useCallback } from 'react';
import { logger } from '../utils/logger';
import {
  receiveToken,
  sendToken as sendTokenService,
} from '../services/cashu/cashuWalletService';

export function useCashuSendReceive({ setIsLoading, setError, setBalance, fetchBalance }) {
  /**
   * Receive Cashu token from QR or paste
   */
  const receive = useCallback(async (token) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Receiving Cashu token');
      const result = await receiveToken(token);
      await fetchBalance();
      logger.info('Token received', { amount: result.amount });
      return result;
    } catch (err) {
      logger.error('Failed to receive token', { error: err.message });
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError, fetchBalance]);

  /**
   * Send Cashu token (for QR code or sharing)
   */
  const send = useCallback(async (amount) => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Sending Cashu token', { amount });
      const result = await sendTokenService(amount, true);
      setBalance(result.balance);
      logger.info('Token sent', { amount: result.amount });
      return result;
    } catch (err) {
      logger.error('Failed to send token', { error: err.message });
      setError(err.message);
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
