/**
 * useTransactionPolling Hook
 * Handles polling Mutinynet API to check for transaction confirmation
 */

import { useEffect, useRef, useCallback } from 'react';

export function useTransactionPolling() {
  const pollIntervalRef = useRef(null);

  /**
   * Start polling for transaction confirmation
   * @param {string} txid - Transaction ID to poll
   * @param {function} onConfirmed - Callback when transaction is confirmed
   * @param {function} onError - Optional error callback
   */
  const startPolling = useCallback((txid, onConfirmed, onError) => {
    console.log('[POLLING] Starting poll for txid:', txid);
    const maxAttempts = 60; // Poll for up to 60 attempts (5 minutes with 5 second intervals)
    let attempts = 0;

    const checkConfirmation = async () => {
      try {
        const response = await fetch(`https://mutinynet.com/api/tx/${txid}`);
        if (!response.ok) {
          throw new Error('Failed to fetch transaction status');
        }
        const tx = await response.json();

        console.log('[POLLING] Attempt', attempts, 'status:', tx.status);

        // Check if transaction is confirmed
        if (tx.status && tx.status.confirmed) {
          console.log('[POLLING] Transaction confirmed!');
          return true;
        }

        return false;
      } catch (error) {
        console.log('[POLLING] Error checking confirmation:', error);
        if (onError) {
          onError(error);
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
        console.log('[POLLING] Stopping poll. Confirmed:', isConfirmed, 'Attempts:', attempts);
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;

        // Call confirmation callback
        if (onConfirmed) {
          console.log('[POLLING] Calling onConfirmed callback');
          onConfirmed(isConfirmed);
        } else {
          console.log('[POLLING] WARNING: No onConfirmed callback provided!');
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
