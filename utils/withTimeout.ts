/**
 * Race a promise against a timeout.
 * Returns the fallback value if the promise doesn't resolve in time.
 * Logs + reports to PostHog when a timeout fires so we have visibility.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      if (label) {
        let startupAttemptId: string | null = null;

        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { startupDiagnostics } = require('../services/startupDiagnostics');
          startupAttemptId = startupDiagnostics.getCurrentAttemptId();
          startupDiagnostics.recordWarning('native_api_timeout', {
            label,
            timeout_ms: ms,
          });
        } catch {
          // startup diagnostics unavailable — swallow
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { logger } = require('./logger');
          logger.warn(`[withTimeout] ${label} timed out after ${ms}ms, using fallback`);
        } catch {
          // logger unavailable — swallow
        }
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { analytics } = require('../services/analyticsService');
          analytics.track('native_api_timeout', {
            label,
            timeout_ms: ms,
            startup_attempt_id: startupAttemptId,
          });
          analytics.flush();
        } catch {
          // analytics unavailable — swallow
        }
      }
      resolve(fallback);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
