/**
 * useTransactionPolling Hook
 * Handles polling Mutinynet API to check for transaction confirmation
 */

import { useEffect, useRef, useCallback } from 'react';
import { getTxApiUrl } from '../utils/constants';

interface UseTransactionPollingReturn {
  startPolling: (txid: string, onConfirmed: (confirmed: boolean) => void, onError?: (error: Error) => void) => void;
  stopPolling: () => void;
}

export function useTransactionPolling(): UseTransactionPollingReturn {
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    let attempts = 0;

    const checkConfirmation = async () => {
      try {
        const response = await fetch(getTxApiUrl(txid));
        if (!response.ok) {
          throw new Error('Failed to fetch transaction status');
        }
        const tx = await response.json();

        // Check if transaction is confirmed
        if (tx.status && tx.status.confirmed) {
          return true;
        }

        return false;
      } catch (error: unknown) {
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
        return false;
      }
    };

    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Start polling
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      const isConfirmed = await checkConfirmation();

      if (isConfirmed || attempts >= maxAttempts) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        pollIntervalRef.current = null;

        // Call confirmation callback
        if (onConfirmed) {
          onConfirmed(isConfirmed);
        }
      }
    }, 5000); // Check every 5 seconds
  }, []);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    startPolling,
    stopPolling,
  };
}
