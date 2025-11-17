/**
 * Date Formatting Utilities
 * Functions for formatting timestamps and dates
 */

/**
 * Format a Unix timestamp to a human-readable date string
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeTime - Include time in output (default: true)
 * @param {boolean} options.shortFormat - Use short month names (default: true)
 * @returns {string} Formatted date string
 */
export function formatTimestamp(timestamp, options = {}) {
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

  const formatOptions = {
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
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted transaction date
 */
export function formatTransactionDate(timestamp) {
  return formatTimestamp(timestamp, { includeTime: true, shortFormat: true });
}

/**
 * Get relative time string (e.g., "2 hours ago", "just now")
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Relative time string
 */
export function formatRelativeTime(timestamp) {
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
 * @param {number} startTimestamp - Start Unix timestamp in seconds
 * @param {number} endTimestamp - End Unix timestamp in seconds
 * @returns {string} Formatted date range
 */
export function formatDateRange(startTimestamp, endTimestamp) {
  const start = formatTimestamp(startTimestamp, { includeTime: false });
  const end = formatTimestamp(endTimestamp, { includeTime: false });

  if (start === end) {
    return start;
  }

  return `${start} - ${end}`;
}

/**
 * Check if timestamp is today
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {boolean} True if timestamp is today
 */
export function isToday(timestamp) {
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
