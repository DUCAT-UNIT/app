export const DEFAULT_AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export const AUTO_LOCK_TIMEOUT_OPTIONS = [
  { label: '30 seconds', value: 30 * 1000 },
  { label: '1 minute', value: 60 * 1000 },
  { label: '5 minutes', value: DEFAULT_AUTO_LOCK_TIMEOUT_MS },
  { label: '15 minutes', value: 15 * 60 * 1000 },
  { label: '30 minutes', value: 30 * 60 * 1000 },
] as const;

export const USDC_FEATURE_UNLOCK_PHRASE = 'fx-570ES PLUS';

export function formatAutoLockTimeout(timeoutMs: number): string {
  const option = AUTO_LOCK_TIMEOUT_OPTIONS.find((item) => item.value === timeoutMs);
  if (option) return option.label;

  const seconds = Math.round(timeoutMs / 1000);
  if (seconds < 60) return `${seconds} seconds`;

  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}
