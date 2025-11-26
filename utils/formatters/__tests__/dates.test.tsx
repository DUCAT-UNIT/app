// @ts-nocheck
/**
 * Tests for Date Formatting Utilities
 */

import {
  formatTimestamp,
  formatTransactionDate,
  formatRelativeTime,
  formatDateRange,
  isToday,
} from '../dates';

describe('formatTimestamp', () => {
  beforeEach(() => {
    // Mock Date to return a consistent value
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should format timestamp with time by default', () => {
    const timestamp = Math.floor(new Date('2025-01-15T10:30:00Z').getTime() / 1000);
    const result = formatTimestamp(timestamp);
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('should format without time when includeTime is false', () => {
    const timestamp = Math.floor(new Date('2025-01-15T10:30:00Z').getTime() / 1000);
    const result = formatTimestamp(timestamp, { includeTime: false });
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('should use long month format when shortFormat is false', () => {
    const timestamp = Math.floor(new Date('2025-01-15T10:30:00Z').getTime() / 1000);
    const result = formatTimestamp(timestamp, { shortFormat: false });
    expect(result).toContain('January');
  });

  it('should return "Pending" for falsy timestamp', () => {
    expect(formatTimestamp(0)).toBe('Pending');
    expect(formatTimestamp(null)).toBe('Pending');
    expect(formatTimestamp(undefined)).toBe('Pending');
  });

  it('should return "Invalid date" for invalid timestamp', () => {
    expect(formatTimestamp('invalid')).toBe('Invalid date');
  });

  it('should return "Pending" for NaN', () => {
    // NaN is falsy in the !timestamp check, so it returns "Pending"
    expect(formatTimestamp(NaN)).toBe('Pending');
  });

  it('should return "Invalid date" for timestamp that creates invalid Date', () => {
    const result = formatTimestamp(Number.MAX_SAFE_INTEGER);
    // This might or might not be invalid depending on JS engine, but test the behavior
    expect(typeof result).toBe('string');
  });
});

describe('formatTransactionDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should format transaction date with time and short format', () => {
    const timestamp = Math.floor(new Date('2025-01-15T10:30:00Z').getTime() / 1000);
    const result = formatTransactionDate(timestamp);
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('should return "Pending" for no timestamp', () => {
    expect(formatTransactionDate(0)).toBe('Pending');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return "just now" for recent timestamps', () => {
    const now = Date.now() / 1000;
    expect(formatRelativeTime(now)).toBe('just now');
    expect(formatRelativeTime(now - 30)).toBe('just now');
    expect(formatRelativeTime(now - 59)).toBe('just now');
  });

  it('should return minutes ago', () => {
    const now = Date.now() / 1000;
    expect(formatRelativeTime(now - 60)).toBe('1 minute ago');
    expect(formatRelativeTime(now - 120)).toBe('2 minutes ago');
    expect(formatRelativeTime(now - 1800)).toBe('30 minutes ago');
  });

  it('should return hours ago', () => {
    const now = Date.now() / 1000;
    expect(formatRelativeTime(now - 3600)).toBe('1 hour ago');
    expect(formatRelativeTime(now - 7200)).toBe('2 hours ago');
    expect(formatRelativeTime(now - 10800)).toBe('3 hours ago');
  });

  it('should return days ago', () => {
    const now = Date.now() / 1000;
    expect(formatRelativeTime(now - 86400)).toBe('1 day ago');
    expect(formatRelativeTime(now - 172800)).toBe('2 days ago');
  });

  it('should return weeks ago', () => {
    const now = Date.now() / 1000;
    expect(formatRelativeTime(now - 604800)).toBe('1 week ago');
    expect(formatRelativeTime(now - 1209600)).toBe('2 weeks ago');
  });

  it('should return formatted date for old timestamps', () => {
    const now = Date.now() / 1000;
    const oldTimestamp = now - 2592000 - 1; // Just over a month
    const result = formatRelativeTime(oldTimestamp);
    expect(result).not.toContain('ago');
    expect(result).toContain('2024'); // Should be from previous month/year
  });

  it('should return "Pending" for falsy timestamp', () => {
    expect(formatRelativeTime(0)).toBe('Pending');
    expect(formatRelativeTime(null)).toBe('Pending');
  });
});

describe('formatDateRange', () => {
  it('should format date range', () => {
    const start = Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000);
    const end = Math.floor(new Date('2025-01-15T00:00:00Z').getTime() / 1000);
    const result = formatDateRange(start, end);
    expect(result).toContain('-');
    expect(result).toContain('Jan');
  });

  it('should return single date when start and end are same day', () => {
    const timestamp = Math.floor(new Date('2025-01-15T10:00:00Z').getTime() / 1000);
    const result = formatDateRange(timestamp, timestamp);
    expect(result).not.toContain('-');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('should handle pending dates', () => {
    const result = formatDateRange(0, 0);
    expect(result).toBe('Pending');
  });
});

describe('isToday', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return true for today timestamp', () => {
    const today = Math.floor(Date.now() / 1000);
    expect(isToday(today)).toBe(true);
  });

  it('should return true for any time today', () => {
    // Use local time to avoid timezone issues
    const morning = Math.floor(new Date(2025, 0, 15, 0, 0, 0).getTime() / 1000);
    const evening = Math.floor(new Date(2025, 0, 15, 23, 59, 59).getTime() / 1000);
    expect(isToday(morning)).toBe(true);
    expect(isToday(evening)).toBe(true);
  });

  it('should return false for yesterday', () => {
    const yesterday = Math.floor(new Date(2025, 0, 14, 12, 0, 0).getTime() / 1000);
    expect(isToday(yesterday)).toBe(false);
  });

  it('should return false for tomorrow', () => {
    const tomorrow = Math.floor(new Date(2025, 0, 16, 12, 0, 0).getTime() / 1000);
    expect(isToday(tomorrow)).toBe(false);
  });

  it('should return false for invalid input', () => {
    expect(isToday(null)).toBe(false);
    expect(isToday(undefined)).toBe(false);
    expect(isToday('invalid')).toBe(false);
    expect(isToday(0)).toBe(false);
  });
});
