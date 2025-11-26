/**
 * usePolling - Unified polling mechanism
 * Replaces multiple setInterval timers with a single coordinated polling system
 * Supports pause/resume and synchronized intervals
 */

import { useEffect, useRef, useCallback } from 'react';

interface UsePollingOptions {
  onPoll: () => void | Promise<unknown>;
  interval: number;
  enabled?: boolean;
  immediate?: boolean;
}

interface UsePollingReturn {
  startPolling: () => void;
  stopPolling: () => void;
}

export const usePolling = ({ onPoll, interval, enabled = true, immediate = true }: UsePollingOptions): UsePollingReturn => {
  const savedCallback = useRef(onPoll);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
