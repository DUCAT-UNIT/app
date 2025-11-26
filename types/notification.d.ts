/**
 * Notification Type Definitions
 * Canonical types for toasts, snackbars, and other notifications
 */

/**
 * Toast notification types
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

/**
 * Snackbar notification types
 */
export type SnackbarType = 'pending' | 'submitted' | 'success' | 'error';

export interface SnackbarParams {
  message?: string;
  type: SnackbarType;
  action?: string;
  description?: string;
  txid?: string;
  persistent?: boolean;
  onPress?: () => void;
  key?: number;
}
