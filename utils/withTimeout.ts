import { startupDiagnostics } from '../services/startupDiagnostics';
import { logger } from './logger';

/**
 * Race a promise against a timeout.
 * Returns the fallback value if the promise doesn't resolve in time.
 * Logs and records startup diagnostics when a timeout fires.
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
        try {
          startupDiagnostics.recordWarning('native_api_timeout', {
            label,
            timeout_ms: ms,
          });
        } catch {
          // startup diagnostics unavailable — swallow
        }

        try {
          logger.warn(`[withTimeout] ${label} timed out after ${ms}ms, using fallback`);
        } catch {
          // logger unavailable — swallow
        }
      }
      resolve(fallback);
    }, ms);
    (timer as { unref?: () => void }).unref?.();
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
