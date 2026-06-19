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
    'open_settled_to_usdc': 'Open Settled',
    'borrow': 'Borrow',
    'borrow_settled_to_usdc': 'Borrow Settled',
    'repay': 'Repay',
    'repay_from_usdc': 'Repay from Sepolia USDC',
    'deposit': 'Deposit',
    'withdraw': 'Withdraw',
    'liquidate': 'Repossess',
    'repo': 'Repossess',
    'trim': 'Repossess',
    'repossess': 'Repossess',
    'swap': 'Swap',
  };
  return actionMap[action.toLowerCase()] || action;
};

/**
 * Determine UNIT amount color based on action
 * Green: Repay, Swap (UNIT received)
 * Red: Open, Borrow, Repossess (debt added)
 */
export const getUnitColor = (actionLower: string): string => {
  if (
    actionLower === 'repay'
    || actionLower === 'swap'
    || actionLower === 'open_settled_to_usdc'
    || actionLower === 'borrow_settled_to_usdc'
    || actionLower === 'repay_from_usdc'
  ) {
    return COLORS.GREEN;
  }
  return COLORS.RED;
};

/**
 * Determine BTC amount color based on action
 * Green: Deposit, Repossess (collateral added)
 * Red: Withdraw (collateral removed)
 */
export const getBtcColor = (actionLower: string): string => {
  if (actionLower === 'withdraw') return COLORS.RED;
  return COLORS.GREEN;
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
