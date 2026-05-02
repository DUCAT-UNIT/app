/**
 * usePolling - Unified polling mechanism
 * Replaces multiple setInterval timers with a single coordinated polling system
 * Supports pause/resume and synchronized intervals
 */

import { AppState, type AppStateStatus } from 'react-native';
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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Update callback ref when it changes (avoids stale closures)
  useEffect(() => {
    savedCallback.current = onPoll;
  }, [onPoll]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((triggerImmediate = immediate) => {
    if (!enabled || appStateRef.current !== 'active') return;

    stopPolling();

    const safeInvoke = () => {
      try {
        const result = savedCallback.current();
        // Catch unhandled promise rejections from async callbacks
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          (result as Promise<unknown>).catch(() => {});
        }
      } catch (_) {
        // Swallow sync errors from polling callbacks
      }
    };

    // Execute immediately if requested
    if (triggerImmediate) {
      safeInvoke();
    }

    // Start interval
    intervalRef.current = setInterval(safeInvoke, interval);
    (intervalRef.current as { unref?: () => void }).unref?.();
  }, [enabled, immediate, interval, stopPolling]);

  useEffect(() => {
    startPolling();
    return stopPolling;
  }, [startPolling, stopPolling]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'active') {
        startPolling(previousState !== 'active');
      } else {
        stopPolling();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [startPolling, stopPolling]);

  return { startPolling, stopPolling };
};
