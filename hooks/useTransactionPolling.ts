/**
 * useTransactionPolling Hook
 * Handles polling Mutinynet API to check for transaction confirmation
 */

import { useEffect, useRef, useCallback } from 'react';
import { getTxApiUrl } from '../utils/constants';
import { logger } from '../utils/logger';
import { useSwapDiagnosticsStore } from '../stores/swapDiagnosticsStore';
import { getWithRetry } from '../utils/apiClient';

interface UseTransactionPollingReturn {
  startPolling: (txid: string, onConfirmed: (confirmed: boolean) => void, onError?: (error: Error) => void) => void;
  stopPolling: () => void;
}

export function useTransactionPolling(): UseTransactionPollingReturn {
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIdRef = useRef<string | null>(null);
  const isPollingRef = useRef<boolean>(false);

  const stopActiveDiagnosticPoll = useCallback((message: string) => {
    if (pollIdRef.current) {
      useSwapDiagnosticsStore.getState().stopPoll(pollIdRef.current, message);
      pollIdRef.current = null;
    }
  }, []);

  /**
   * Start polling for transaction confirmation
   * @param {string} txid - Transaction ID to poll
   * @param {function} onConfirmed - Callback when transaction is confirmed
   * @param {function} onError - Optional error callback
   */
  const startPolling = useCallback((
    txid: string,
    onConfirmed: (confirmed: boolean) => void,
    onError?: (error: Error) => void
  ) => {
    const maxAttempts = 60; // Poll for up to 60 attempts (5 minutes with 5 second intervals)
    const intervalMs = 5000;
    let attempts = 0;

    // Clear any existing interval before registering the replacement poll.
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      stopActiveDiagnosticPoll('Replaced by a newer transaction poll');
    }

    const pollId = useSwapDiagnosticsStore.getState().startPoll({
      id: `tx:${txid}`,
      kind: 'transaction_confirmation',
      label: 'Transaction confirmation',
      subject: txid,
      intervalMs,
      timeoutMs: maxAttempts * intervalMs,
    });
    pollIdRef.current = pollId;

    const checkConfirmation = async (): Promise<{
      confirmed: boolean;
      lastStatus: string;
      lastError: string | null;
      httpStatus: number | null;
      blockHeight: number | null;
      blockTime: number | null;
    }> => {
      try {
        const response = await getWithRetry(getTxApiUrl(txid), {
          timeout: 8000,
          retryOptions: { maxRetries: 0 },
          dedupeKey: `tx-poll:${txid}`,
          circuitKey: 'mutinynet-tx-poll',
        });
        const httpStatus = typeof response.status === 'number' ? response.status : null;
        if (!response.ok) {
          const error = new Error('Failed to fetch transaction status');
          if (onError) {
            onError(error);
          }
          return {
            confirmed: false,
            lastStatus: httpStatus ? `http_${httpStatus}` : 'http_error',
            lastError: error.message,
            httpStatus,
            blockHeight: null,
            blockTime: null,
          };
        }
        const tx = await response.json();
        const confirmed = Boolean(tx.status?.confirmed);

        return {
          confirmed,
          lastStatus: confirmed ? 'confirmed' : 'unconfirmed',
          lastError: null,
          httpStatus,
          blockHeight: tx.status?.block_height ?? null,
          blockTime: tx.status?.block_time ?? null,
        };
      } catch (error: unknown) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        if (onError) {
          onError(normalizedError);
        }
        return {
          confirmed: false,
          lastStatus: 'error',
          lastError: normalizedError.message,
          httpStatus: null,
          blockHeight: null,
          blockTime: null,
        };
      }
    };

    // Start polling
    pollIntervalRef.current = setInterval(async () => {
      // Guard against concurrent execution when network is slow
      if (isPollingRef.current) {
        logger.debug('[useTransactionPolling] Skipping tick - previous poll still in progress');
        return;
      }

      isPollingRef.current = true;
      try {
        attempts++;
        const confirmation = await checkConfirmation();

        useSwapDiagnosticsStore.getState().recordAttempt(pollId, {
          lastStatus: confirmation.lastStatus,
          lastError: confirmation.lastError,
          metadata: {
            httpStatus: confirmation.httpStatus,
            blockHeight: confirmation.blockHeight,
            blockTime: confirmation.blockTime,
          },
        });

        if (confirmation.confirmed || attempts >= maxAttempts) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          pollIntervalRef.current = null;
          useSwapDiagnosticsStore.getState().completePoll(pollId, {
            status: confirmation.confirmed ? 'success' : 'timeout',
            lastStatus: confirmation.lastStatus,
            lastMessage: confirmation.confirmed
              ? 'Transaction confirmed'
              : 'Transaction confirmation timed out',
            lastError: confirmation.lastError,
          });
          if (pollIdRef.current === pollId) {
            pollIdRef.current = null;
          }

          // Call confirmation callback
          if (onConfirmed) {
            onConfirmed(confirmation.confirmed);
          }
        }
      } finally {
        isPollingRef.current = false;
      }
    }, intervalMs); // Check every 5 seconds
    (pollIntervalRef.current as { unref?: () => void }).unref?.();
  }, [stopActiveDiagnosticPoll]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    stopActiveDiagnosticPoll('Polling stopped manually');
  }, [stopActiveDiagnosticPoll]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      stopActiveDiagnosticPoll('Polling stopped on unmount');
    };
  }, [stopActiveDiagnosticPoll]);

  return {
    startPolling,
    stopPolling,
  };
}
