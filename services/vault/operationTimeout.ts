import { logger } from '../../utils/logger';

export const VAULT_BUILD_TIMEOUT_MS = 30_000;

/**
 * Bounds local SDK/fetch/signing work so vault screens can recover from stuck promises.
 */
export async function withVaultBuildTimeout<T>(
  operation: Promise<T>,
  message: string,
  timeoutMs: number = VAULT_BUILD_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      logger.warn('[VaultOps] Vault build operation timed out', {
        timeoutMs,
        message,
      });
      reject(new Error(message));
    }, timeoutMs);
    (timeoutId as { unref?: () => void }).unref?.();
  });

  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}
