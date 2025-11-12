/**
 * usePolling - Unified polling mechanism
 * Replaces multiple setInterval timers with a single coordinated polling system
 * Supports pause/resume and synchronized intervals
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for polling with automatic cleanup
 * @param {Object} options - Polling configuration
 * @param {Function} options.onPoll - Function to call on each poll
 * @param {number} options.interval - Polling interval in milliseconds
 * @param {boolean} options.enabled - Whether polling is enabled (default: true)
 * @param {boolean} options.immediate - Whether to call onPoll immediately (default: true)
 */
export const usePolling = ({ onPoll, interval, enabled = true, immediate = true }) => {
  const savedCallback = useRef(onPoll);
  const intervalRef = useRef(null);

  // Update callback ref when it changes (avoids stale closures)
  useEffect(() => {
    savedCallback.current = onPoll;
  }, [onPoll]);

  const startPolling = useCallback(() => {
    if (!enabled) return;

    // Execute immediately if requested
    if (immediate) {
      savedCallback.current();
    }

    // Start interval
    intervalRef.current = setInterval(() => {
      savedCallback.current();
    }, interval);
  }, [interval, enabled, immediate]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    startPolling();
    return stopPolling;
  }, [startPolling, stopPolling]);

  return { startPolling, stopPolling };
};
