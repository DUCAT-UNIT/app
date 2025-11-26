/**
 * Date Formatting Utilities
 * Functions for formatting timestamps and dates
 */

export interface FormatTimestampOptions {
  includeTime?: boolean;
  shortFormat?: boolean;
}

/**
 * Format a Unix timestamp to a human-readable date string
 * @param timestamp - Unix timestamp in seconds
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: number | null | undefined, options: FormatTimestampOptions = {}): string {
  const { includeTime = true, shortFormat = true } = options;

  if (!timestamp) {
    return 'Pending';
  }

  if (typeof timestamp !== 'number' || isNaN(timestamp)) {
    return 'Invalid date';
  }

  const date = new Date(timestamp * 1000);

  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    month: shortFormat ? 'short' : 'long',
    day: 'numeric',
    year: 'numeric',
  };

  if (includeTime) {
    formatOptions.hour = '2-digit';
    formatOptions.minute = '2-digit';
  }

  return date.toLocaleDateString('en-US', formatOptions);
}

/**
 * Format a transaction date (shorthand for formatTimestamp with defaults)
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted transaction date
 */
export function formatTransactionDate(timestamp: number | null | undefined): string {
  return formatTimestamp(timestamp, { includeTime: true, shortFormat: true });
}

/**
 * Get relative time string (e.g., "2 hours ago", "just now")
 * @param timestamp - Unix timestamp in seconds
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return 'Pending';
  }

  const now = Date.now() / 1000;
  const diffSeconds = Math.floor(now - timestamp);

  if (diffSeconds < 60) {
    return 'just now';
  }

  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  if (diffSeconds < 604800) {
    const days = Math.floor(diffSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }

  if (diffSeconds < 2592000) {
    const weeks = Math.floor(diffSeconds / 604800);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }

  // For older dates, show the actual date
  return formatTimestamp(timestamp, { includeTime: false });
}

/**
 * Format a date range
 * @param startTimestamp - Start Unix timestamp in seconds
 * @param endTimestamp - End Unix timestamp in seconds
 * @returns Formatted date range
 */
export function formatDateRange(startTimestamp: number | null | undefined, endTimestamp: number | null | undefined): string {
  const start = formatTimestamp(startTimestamp, { includeTime: false });
  const end = formatTimestamp(endTimestamp, { includeTime: false });

  if (start === end) {
    return start;
  }

  return `${start} - ${end}`;
}

/**
 * Check if timestamp is today
 * @param timestamp - Unix timestamp in seconds
 * @returns True if timestamp is today
 */
export function isToday(timestamp: number | null | undefined): boolean {
  if (!timestamp || typeof timestamp !== 'number') {
    return false;
  }

  const date = new Date(timestamp * 1000);
  const today = new Date();

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}
