// Centralized user-facing messages for the UNIT wallet app

export const ERRORS = {
  // Transaction errors
  INSUFFICIENT_FUNDS: 'Insufficient funds for this transaction',
  INSUFFICIENT_FUNDS_FOR_FEES: 'Insufficient funds to cover transaction fees',
  INVALID_AMOUNT: 'Invalid amount',
  INVALID_ADDRESS: 'Invalid Bitcoin address',
  MISSING_RECIPIENT_AMOUNT: 'Please enter recipient address and amount',
  TRANSACTION_TOO_LARGE: 'Transaction size exceeds limit',
  AMOUNT_TOO_SMALL: 'Amount too small (below dust limit)',
  TRANSACTION_ALREADY_SPENT: 'Transaction inputs already spent',
  TRANSACTION_CONFLICT: 'This transaction is already pending. Please wait.',
  TRANSACTION_NOT_FINAL: 'Transaction is not yet final',
  FEE_TOO_LOW: 'Transaction fee too low',
  FEE_OUT_OF_RANGE: 'Transaction fee is outside acceptable range',
  BROADCAST_FAILED: 'Failed to broadcast transaction',
  INVALID_TRANSACTION: 'Invalid transaction format',
  TRANSACTION_CANCELLED: 'Transaction was cancelled',
  NO_CONFIRMED_FUNDS: 'No confirmed funds available',
  NO_UNIT_BALANCE: 'No available UNIT balance to send',
  ASSET_SELECTION_REQUIRED: 'Please select Bitcoin or UNIT to send',

  // Wallet errors
  WALLET_GENERATION_FAILED: 'Failed to generate wallet. Please try again.',
  INVALID_SEED_PHRASE: 'Invalid seed phrase. Please check and try again.',
  WALLET_IMPORT_FAILED: 'Failed to import wallet. Please check your seed phrase and try again.',
  WALLET_LOAD_FAILED: 'Cannot access your wallet. Please restart the app.',
  WALLET_SWITCH_FAILED: 'Failed to switch account. Please try again.',
  WALLET_DELETE_FAILED: 'Failed to delete wallet. Please try again.',

  // Seed phrase errors
  SEED_PHRASE_INCOMPLETE: 'Please select an answer for all words',
  SEED_PHRASE_INCORRECT: 'One or more words are incorrect. Please try again.',
  SEED_PHRASE_NOT_FOUND: 'Recovery phrase not found',
  SEED_PHRASE_RETRIEVAL_FAILED: 'Failed to retrieve recovery phrase. Please try again.',

  // Authentication errors
  INCORRECT_PIN: 'Incorrect PIN',
  PINS_DO_NOT_MATCH: "PINs don't match. Please try again.",
  PIN_SAVE_FAILED: 'Failed to save PIN. Please try again.',
  BIOMETRIC_AUTH_FAILED: 'Biometric authentication failed',
  AUTH_REQUIRED: 'You must authenticate to view your recovery phrase',

  // Account errors
  INVALID_ACCOUNT_NUMBER: 'Please enter a valid account number (1 or greater)',
  ACCOUNT_SWITCH_FAILED: 'Failed to switch account. Please try again.',

  // Address validation
  INVALID_ADDRESS_FORMAT: 'Invalid Bitcoin address format',
  INVALID_ADDRESS_LENGTH: 'Address length is invalid',

  // Network errors
  NETWORK_FAILED: 'Network connection failed. Please check your internet.',
  REQUEST_TIMEOUT: 'Request timed out. Please try again.',
  BALANCE_FETCH_FAILED: 'Failed to update balance. Please try again.',

  // Generic fallback
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  SOMETHING_WENT_WRONG: 'Something went wrong. Please try again.',
} as const;

export const SUCCESS = {
  // Transaction success
  TRANSACTION_SENT: 'Transaction Sent',

  // Wallet success
  WALLET_DELETED: 'Wallet has been deleted from this device',
  ACCOUNT_SWITCHED: 'Account switched successfully',

  // Settings success
  PIN_CHANGED: 'Your PIN has been changed',
  SETTINGS_SAVED: 'Settings saved successfully',
} as const;

export const WARNINGS = {
  // Wallet warnings
  WALLET_DELETE_WARNING:
    'WARNING: This will permanently delete your wallet from this device. Make sure you have your recovery phrase backed up!',
  WALLET_LOGOUT_WARNING: 'This will lock your wallet. You can unlock it again with Face ID or PIN.',
} as const;

export const PROMPTS = {
  // User prompts
  ENTER_PIN: 'Enter 6-Digit PIN',
  CONFIRM_PIN: 'Confirm Your PIN',
  ENTER_ADDRESS: 'Enter Address',
  ENTER_AMOUNT: 'Enter Amount',
} as const;

export const DIALOGS = {
  DELETE_WALLET_TITLE: 'Delete Wallet',
  LOGOUT_TITLE: 'Logout',
  INVALID_ACCOUNT_TITLE: 'Invalid Account',
  AUTH_FAILED_TITLE: 'Authentication Failed',
  ERROR_TITLE: 'Error',
} as const;

/**
 * Notification messages for toasts/snackbars
 * Organized by feature area
 */
export const NOTIFICATIONS = {
  // ============================================
  // Authentication & Settings
  // ============================================
  AUTH_REQUIRED_FACEID: 'Authentication required to enable Face ID',
  AUTH_REQUIRED_NOTIFICATIONS: 'Authentication required to enable notifications',
  AUTH_REQUIRED_DELETE_WALLET: 'Authentication required to delete wallet',
  AUTH_REQUIRED: (action: string) => `Authentication required to ${action}`,

  FACEID_ENABLED: 'Face ID enabled',
  FACEID_DISABLED: 'Face ID disabled',
  FACEID_UPDATE_FAILED: 'Failed to update Face ID setting',

  NOTIFICATIONS_ENABLED: 'Notifications enabled',
  NOTIFICATIONS_DISABLED: 'Notifications disabled',
  NOTIFICATIONS_UPDATE_FAILED: 'Failed to update notifications setting',

  SETTING_ENABLED: (setting: string) => `${setting} enabled`,
  SETTING_DISABLED: (setting: string) => `${setting} disabled`,
  SETTING_UPDATE_FAILED: (setting: string) => `Failed to update ${setting}`,

  // ============================================
  // Wallet Management
  // ============================================
  ACCOUNT_SWITCHED: (index: number) => `Switched to Account ${index}`,
  WALLET_SAVE_FAILED: 'Failed to save wallet',
  WALLET_DELETED: 'Wallet deleted successfully',
  WALLET_DELETE_FAILED: 'Failed to delete wallet',

  // ============================================
  // Passkey Operations
  // ============================================
  PASSKEY_NOT_SUPPORTED: 'Passkeys are not supported on this device',
  PASSKEY_CREATED: 'Wallet created with passkey!',
  PASSKEY_RESTORED: 'Wallet restored from passkey!',
  PASSKEY_ENABLED: 'Passkey enabled! Your wallet is now backed up to iCloud.',
  PASSKEY_NO_WALLET: 'No passkey wallet found in iCloud',
  PASSKEY_ICLOUD_FAILED: 'iCloud backup failed - restoration may not work on new devices',
  PASSKEY_CREATION_FAILED: 'Failed to start passkey creation',
  PASSKEY_RESTORE_FAILED: 'Failed to start passkey restore',
  PASSKEY_WALLET_CREATION_FAILED: 'Failed to create wallet with passkey',
  PASSKEY_WALLET_RESTORE_FAILED: 'Failed to restore wallet with passkey',
  PASSKEY_ENABLE_FAILED: 'Failed to enable passkey',
  PASSKEY_PIN_PROCESS_FAILED: 'Failed to process PIN',

  // ============================================
  // PIN Management
  // ============================================
  PIN_INVALID: 'Please enter a 6-digit PIN',
  PIN_MISMATCH: 'PINs do not match. Please try again.',
  PIN_CHANGED: 'Your PIN has been changed',

  // ============================================
  // Seed Phrase
  // ============================================
  SEED_INCOMPLETE: 'Please select an answer for all words',
  SEED_INCORRECT: 'One or more words are incorrect. Please try again.',
  SEED_NOT_FOUND: 'Recovery phrase not found',

  // ============================================
  // Transaction Building
  // ============================================
  MISSING_RECIPIENT_AMOUNT: 'Please enter recipient address and amount',
  ASSET_SELECTION_REQUIRED: 'Please select Bitcoin or UNIT to send',

  // ============================================
  // QR Code / Token Operations
  // ============================================
  TOKEN_CHECKING: 'Checking token...',
  TOKEN_CLAIMING: 'Claiming token...',
  TOKEN_CLAIMING_UNSPENT: 'Claiming unspent proofs...',
  TOKEN_ALREADY_SPENT: 'Token already spent',
  TOKEN_EXTRACT_FAILED: 'Failed to extract token from URL',
  TOKEN_EXTRACT_ERROR: (error: string) => `Failed to extract token: ${error}`,
  QR_UNKNOWN_FORMAT: 'Unknown QR code format',

  // ============================================
  // Ecash / Cashu Operations
  // ============================================
  CASHU_CACHE_CLEARED: 'Cashu cache cleared successfully',
  CASHU_CACHE_CLEAR_FAILED: 'Failed to clear Cashu cache',
  CASHU_RECOVERING_CHANGE: 'Recovering change from sent tokens...',
  CASHU_LOCKED_TOKENS_CLEARED: 'Sent locked tokens history cleared',
  CASHU_LOCKED_TOKENS_CLEAR_FAILED: 'Failed to clear locked tokens history',
  CONVERSION_COMPLETE: 'Conversion complete',
  CONVERSION_FAILED: (error: string) => `Failed to complete conversion: ${error}`,
  PAYMENT_SENT_AWAITING: 'Payment sent. Ecash will be available once confirmed.',

  // ============================================
  // Ecash Threshold / Navigation
  // ============================================
  NAVIGATION_FAILED: (error: string) => `Navigation failed: ${error}`,
  CONVERSION_START_FAILED: (error: string) => `Failed to start conversion: ${error}`,
  TOPUP_START_FAILED: (error: string) => `Failed to start top-up: ${error}`,

  // ============================================
  // Clipboard Operations
  // ============================================
  COPIED: (item: string) => `${item} copied to clipboard`,
  COPY_FAILED: (item: string) => `Failed to copy ${item}`,
  ADDRESS_COPIED: (type: string) => `${type} address copied to clipboard`,
  TOKEN_COPIED: 'Cashu token copied to clipboard',
  TOKEN_COPY_FAILED: 'Failed to copy token to clipboard',
  LINK_COPIED: 'Link copied to clipboard',

  // ============================================
  // Link/Share Operations
  // ============================================
  SHARE_FAILED: 'Failed to share link. Please try again.',
  LINK_COPY_FAILED: 'Failed to copy link. Please try again.',
  LINK_OPEN_FAILED: 'Failed to open link. Please try again.',

  // ============================================
  // Token Details
  // ============================================
  TOKEN_DETAILS_LOAD_FAILED: 'Failed to load token details',

  // ============================================
  // Transaction Conflicts
  // ============================================
  TRANSACTION_CONFLICT: 'Transaction conflict: inputs already used',

  // ============================================
  // Generic Operations
  // ============================================
  OPERATION_FAILED: (operation: string) => `Failed to ${operation}. Please try again.`,
} as const;
