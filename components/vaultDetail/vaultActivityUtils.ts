/**
 * VaultActivityList Utilities
 * Helper functions and constants for VaultActivityList component
 */

import { COLORS } from '../../theme';

export const INITIAL_LOAD_COUNT = 10;
export const LOAD_MORE_COUNT = 10;

/**
 * Format timestamp to readable date string
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Map action codes to human-readable labels
 */
export const formatAction = (action: string): string => {
  const actionMap: Record<string, string> = {
    'open': 'Open Vault',
    'borrow': 'Borrow',
    'repay': 'Repay',
    'deposit': 'Deposit',
    'withdraw': 'Withdraw',
    'liquidate': 'Liquidation',
  };
  return actionMap[action.toLowerCase()] || action;
};

/**
 * Get color for action type
 */
export const getActionColor = (action: string): string => {
  const colorMap: Record<string, string> = {
    'open': COLORS.SUCCESS_GREEN,
    'borrow': COLORS.SUCCESS_GREEN,
    'repay': COLORS.PRIMARY_BLUE,
    'deposit': COLORS.SUCCESS_GREEN,
    'withdraw': COLORS.RED,
    'liquidate': COLORS.RED,
  };
  return colorMap[action.toLowerCase()] || COLORS.WHITE;
};

/**
 * Determine UNIT amount color based on action
 */
export const getUnitColor = (actionLower: string): string => {
  if (actionLower === 'borrow' || actionLower === 'open') return COLORS.GREEN;
  return COLORS.RED;
};

/**
 * Determine BTC amount color based on action
 */
export const getBtcColor = (actionLower: string): string => {
  if (actionLower === 'deposit') return COLORS.GREEN;
  return COLORS.RED;
};

/**
 * Check if a transaction matches the highlighted event date (same day in UTC)
 */
export const isTransactionHighlighted = (
  txTimestamp: number,
  highlightedDate: number | null | undefined
): boolean => {
  if (!highlightedDate) return false;
  // Convert tx timestamp (seconds) to ms
  const txMs = txTimestamp * 1000;

  // Get start and end of the highlighted day in UTC
  const highlightedDay = new Date(highlightedDate);
  const startOfDayUTC = Date.UTC(
    highlightedDay.getUTCFullYear(),
    highlightedDay.getUTCMonth(),
    highlightedDay.getUTCDate(),
    0, 0, 0, 0
  );
  const endOfDayUTC = startOfDayUTC + 24 * 60 * 60 * 1000 - 1; // End of day (23:59:59.999)

  return txMs >= startOfDayUTC && txMs <= endOfDayUTC;
};
