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
};

export const SUCCESS = {
  // Transaction success
  TRANSACTION_SENT: 'Transaction Sent',

  // Wallet success
  WALLET_DELETED: 'Wallet has been deleted from this device',
  ACCOUNT_SWITCHED: 'Account switched successfully',

  // Settings success
  PIN_CHANGED: 'Your PIN has been changed',
  SETTINGS_SAVED: 'Settings saved successfully',
};

export const WARNINGS = {
  // Wallet warnings
  WALLET_DELETE_WARNING:
    'WARNING: This will permanently delete your wallet from this device. Make sure you have your recovery phrase backed up!',
  WALLET_LOGOUT_WARNING: 'This will lock your wallet. You can unlock it again with Face ID or PIN.',
};

export const PROMPTS = {
  // User prompts
  ENTER_PIN: 'Enter 6-Digit PIN',
  CONFIRM_PIN: 'Confirm Your PIN',
  ENTER_ADDRESS: 'Enter Address',
  ENTER_AMOUNT: 'Enter Amount',
};

export const DIALOGS = {
  DELETE_WALLET_TITLE: 'Delete Wallet',
  LOGOUT_TITLE: 'Logout',
  INVALID_ACCOUNT_TITLE: 'Invalid Account',
  AUTH_FAILED_TITLE: 'Authentication Failed',
  ERROR_TITLE: 'Error',
};
