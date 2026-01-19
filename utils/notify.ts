/**
 * Centralized notification helper
 * Provides a clean API for showing notifications throughout the app
 */

import { useNotificationStore } from '../stores/notificationStore';
import type { SnackbarType, SnackbarParams } from '../types/notification';
import { NOTIFICATIONS } from './messages';

type TransactionAction = 'send' | 'claim' | 'convert' | 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'create' | 'faucet' | 'swap' | 'liquidation' | 'repossess' | 'conversion_turbo';

/**
 * Get the notification store's showMessage function
 * This is extracted to avoid issues with hook rules
 */
const getStore = () => useNotificationStore.getState();

/**
 * Centralized notification API
 * Use this instead of calling showToast/showSnackbar directly
 */
export const notify = {
  // ============================================
  // Base notification methods
  // ============================================

  /**
   * Show a success notification
   */
  success: (message: string, duration?: number) => {
    getStore().showMessage(message, 'success', duration);
  },

  /**
   * Show an error notification
   */
  error: (message: string, duration?: number) => {
    getStore().showMessage(message, 'error', duration);
  },

  /**
   * Show an info notification
   */
  info: (message: string, duration?: number) => {
    getStore().showMessage(message, 'info', duration);
  },

  /**
   * Show a warning notification
   */
  warning: (message: string, duration?: number) => {
    getStore().showMessage(message, 'warning', duration);
  },

  /**
   * Show a custom snackbar with full params
   */
  snackbar: (params: SnackbarParams) => {
    getStore().showSnackbar(params);
  },

  /**
   * Dismiss current notification
   */
  dismiss: () => {
    getStore().dismissSnackbar();
  },

  // ============================================
  // Semantic helpers - Authentication & Settings
  // ============================================

  auth: {
    requiredForFaceId: () => notify.error(NOTIFICATIONS.AUTH_REQUIRED_FACEID),
    requiredForNotifications: () => notify.error(NOTIFICATIONS.AUTH_REQUIRED_NOTIFICATIONS),
    requiredForDeleteWallet: () => notify.error(NOTIFICATIONS.AUTH_REQUIRED_DELETE_WALLET),
    required: (action: string) => notify.error(NOTIFICATIONS.AUTH_REQUIRED(action)),
  },

  settings: {
    faceIdEnabled: () => notify.success(NOTIFICATIONS.FACEID_ENABLED),
    faceIdDisabled: () => notify.success(NOTIFICATIONS.FACEID_DISABLED),
    faceIdFailed: () => notify.error(NOTIFICATIONS.FACEID_UPDATE_FAILED),

    notificationsEnabled: () => notify.success(NOTIFICATIONS.NOTIFICATIONS_ENABLED),
    notificationsDisabled: () => notify.success(NOTIFICATIONS.NOTIFICATIONS_DISABLED),
    notificationsFailed: () => notify.error(NOTIFICATIONS.NOTIFICATIONS_UPDATE_FAILED),

    enabled: (setting: string) => notify.success(NOTIFICATIONS.SETTING_ENABLED(setting)),
    disabled: (setting: string) => notify.success(NOTIFICATIONS.SETTING_DISABLED(setting)),
    failed: (setting: string) => notify.error(NOTIFICATIONS.SETTING_UPDATE_FAILED(setting)),
  },

  // ============================================
  // Semantic helpers - Wallet Management
  // ============================================

  wallet: {
    accountSwitched: (index: number) => notify.success(NOTIFICATIONS.ACCOUNT_SWITCHED(index)),
    saveFailed: () => notify.error(NOTIFICATIONS.WALLET_SAVE_FAILED),
    deleted: () => notify.success(NOTIFICATIONS.WALLET_DELETED),
    deleteFailed: () => notify.error(NOTIFICATIONS.WALLET_DELETE_FAILED),
  },

  // ============================================
  // Semantic helpers - Passkey Operations
  // ============================================

  passkey: {
    notSupported: () => notify.error(NOTIFICATIONS.PASSKEY_NOT_SUPPORTED),
    created: () => notify.success(NOTIFICATIONS.PASSKEY_CREATED),
    restored: () => notify.success(NOTIFICATIONS.PASSKEY_RESTORED),
    enabled: () => notify.success(NOTIFICATIONS.PASSKEY_ENABLED),
    noWallet: () => notify.error(NOTIFICATIONS.PASSKEY_NO_WALLET),
    icloudFailed: () => notify.warning(NOTIFICATIONS.PASSKEY_ICLOUD_FAILED),
    creationFailed: () => notify.error(NOTIFICATIONS.PASSKEY_CREATION_FAILED),
    restoreFailed: () => notify.error(NOTIFICATIONS.PASSKEY_RESTORE_FAILED),
    walletCreationFailed: () => notify.error(NOTIFICATIONS.PASSKEY_WALLET_CREATION_FAILED),
    walletRestoreFailed: () => notify.error(NOTIFICATIONS.PASSKEY_WALLET_RESTORE_FAILED),
    enableFailed: () => notify.error(NOTIFICATIONS.PASSKEY_ENABLE_FAILED),
    pinProcessFailed: () => notify.error(NOTIFICATIONS.PASSKEY_PIN_PROCESS_FAILED),
  },

  // ============================================
  // Semantic helpers - PIN Management
  // ============================================

  pin: {
    invalid: () => notify.error(NOTIFICATIONS.PIN_INVALID),
    mismatch: () => notify.error(NOTIFICATIONS.PIN_MISMATCH),
    changed: () => notify.success(NOTIFICATIONS.PIN_CHANGED),
  },

  // ============================================
  // Semantic helpers - Seed Phrase
  // ============================================

  seed: {
    incomplete: () => notify.error(NOTIFICATIONS.SEED_INCOMPLETE),
    incorrect: () => notify.error(NOTIFICATIONS.SEED_INCORRECT),
    notFound: () => notify.error(NOTIFICATIONS.SEED_NOT_FOUND),
  },

  // ============================================
  // Semantic helpers - Transaction Building
  // ============================================

  build: {
    missingRecipientAmount: () => notify.error(NOTIFICATIONS.MISSING_RECIPIENT_AMOUNT),
    assetRequired: () => notify.error(NOTIFICATIONS.ASSET_SELECTION_REQUIRED),
    error: (message: string) => notify.error(message),
  },

  // ============================================
  // Semantic helpers - Token/QR Operations
  // ============================================

  token: {
    checking: () => notify.info(NOTIFICATIONS.TOKEN_CHECKING),
    claiming: () => notify.info(NOTIFICATIONS.TOKEN_CLAIMING),
    claimingUnspent: () => notify.info(NOTIFICATIONS.TOKEN_CLAIMING_UNSPENT),
    alreadySpent: () => notify.info(NOTIFICATIONS.TOKEN_ALREADY_SPENT),
    extractFailed: () => notify.error(NOTIFICATIONS.TOKEN_EXTRACT_FAILED),
    extractError: (error: string) => notify.error(NOTIFICATIONS.TOKEN_EXTRACT_ERROR(error)),
    unknownFormat: () => notify.error(NOTIFICATIONS.QR_UNKNOWN_FORMAT),
    copied: () => notify.success(NOTIFICATIONS.TOKEN_COPIED),
    copyFailed: () => notify.error(NOTIFICATIONS.TOKEN_COPY_FAILED),
    detailsLoadFailed: () => notify.error(NOTIFICATIONS.TOKEN_DETAILS_LOAD_FAILED),
  },

  // ============================================
  // Semantic helpers - Cashu Operations
  // ============================================

  cashu: {
    cacheCleared: () => notify.success(NOTIFICATIONS.CASHU_CACHE_CLEARED),
    cacheClearFailed: () => notify.error(NOTIFICATIONS.CASHU_CACHE_CLEAR_FAILED),
    recoveringChange: () => notify.info(NOTIFICATIONS.CASHU_RECOVERING_CHANGE),
    lockedTokensCleared: () => notify.success(NOTIFICATIONS.CASHU_LOCKED_TOKENS_CLEARED),
    lockedTokensClearFailed: () => notify.error(NOTIFICATIONS.CASHU_LOCKED_TOKENS_CLEAR_FAILED),
    conversionComplete: () => notify.success(NOTIFICATIONS.CONVERSION_COMPLETE),
    conversionFailed: (error: string) => notify.error(NOTIFICATIONS.CONVERSION_FAILED(error)),
    paymentSentAwaiting: () => notify.info(NOTIFICATIONS.PAYMENT_SENT_AWAITING),
    navigationFailed: (error: string) => notify.error(NOTIFICATIONS.NAVIGATION_FAILED(error)),
    conversionStartFailed: (error: string) => notify.error(NOTIFICATIONS.CONVERSION_START_FAILED(error)),
    topupStartFailed: (error: string) => notify.error(NOTIFICATIONS.TOPUP_START_FAILED(error)),
  },

  // ============================================
  // Semantic helpers - Clipboard
  // ============================================

  clipboard: {
    copied: (item: string) => notify.success(NOTIFICATIONS.COPIED(item)),
    copyFailed: (item: string) => notify.error(NOTIFICATIONS.COPY_FAILED(item)),
    addressCopied: (type: string) => notify.success(NOTIFICATIONS.ADDRESS_COPIED(type)),
    linkCopied: () => notify.info(NOTIFICATIONS.LINK_COPIED),
  },

  // ============================================
  // Semantic helpers - Links/Share
  // ============================================

  link: {
    shareFailed: () => notify.error(NOTIFICATIONS.SHARE_FAILED),
    copyFailed: () => notify.error(NOTIFICATIONS.LINK_COPY_FAILED),
    openFailed: () => notify.error(NOTIFICATIONS.LINK_OPEN_FAILED),
  },

  // ============================================
  // Transaction snackbars (with progress states)
  // ============================================

  transaction: {
    pending: (action: TransactionAction, description?: string) => {
      getStore().showSnackbar({ type: 'pending', action, description });
    },
    submitted: (action: TransactionAction, txid?: string, description?: string) => {
      getStore().showSnackbar({ type: 'submitted', action, txid, description });
    },
    success: (action: TransactionAction, txid?: string, description?: string) => {
      getStore().showSnackbar({ type: 'success', action, txid, description });
    },
    error: (action: TransactionAction, description?: string) => {
      getStore().showSnackbar({ type: 'error', action, description });
    },
    conflict: () => notify.error(NOTIFICATIONS.TRANSACTION_CONFLICT),
  },

  // ============================================
  // Generic helpers
  // ============================================

  /**
   * Show error with optional custom message or error object
   */
  operationFailed: (operation: string, error?: Error | string) => {
    const message = typeof error === 'string'
      ? error
      : error?.message || NOTIFICATIONS.OPERATION_FAILED(operation);
    notify.error(message);
  },
};

export default notify;
