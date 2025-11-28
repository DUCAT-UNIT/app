/**
 * Notification Type Definitions
 * Canonical types for snackbars (toasts have been consolidated into snackbars)
 */

/**
 * Snackbar notification types
 * - success: Completed actions (green checkmark)
 * - error: Failed actions (red alert)
 * - warning: Caution/attention needed (yellow warning)
 * - info: Informational messages (blue info)
 * - progress: Loading/in-progress states (spinning loader)
 * - pending: Transaction pending (alias for progress)
 * - submitted: Transaction submitted (alias for success)
 */
export type SnackbarType = 'success' | 'error' | 'warning' | 'info' | 'progress' | 'pending' | 'submitted';

/**
 * Action button for snackbar
 */
export interface SnackbarActionButton {
  label: string;
  variant: 'primary' | 'secondary';
  onPress: () => void;
}

/**
 * Action link for snackbar
 */
export interface SnackbarActionLink {
  label: string;
  url?: string;
  onPress?: () => void;
}

export interface SnackbarParams {
  /** Main title/message of the snackbar */
  title?: string;
  /** @deprecated Use title instead - kept for backwards compatibility */
  message?: string;
  /** Type of snackbar determining icon and styling */
  type: SnackbarType;
  /** Action identifier for transaction snackbars */
  action?: string;
  /** Secondary description text */
  description?: string;
  /** Transaction ID for linking */
  txid?: string;
  /** If true, snackbar won't auto-dismiss */
  persistent?: boolean;
  /** @deprecated Use actionLinks instead */
  onPress?: () => void;
  /** Action buttons to display */
  actionButtons?: SnackbarActionButton[];
  /** Action links to display */
  actionLinks?: SnackbarActionLink[];
  /** Duration in ms before auto-dismiss (default: 5000) */
  duration?: number;
  /** Internal key for forcing new instances */
  key?: number;
}

