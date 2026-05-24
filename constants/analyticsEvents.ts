/**
 * Analytics Event Constants
 * Typed event names for app instrumentation. No magic strings.
 */

// ── Onboarding ──────────────────────────────────────────────
export const ONBOARDING_EVENTS = {
  APP_OPENED: 'app_opened',
  ONBOARDING_VIEWED: 'onboarding_viewed',
  WALLET_CREATION_STARTED: 'wallet_creation_started',
  PIN_SETUP_COMPLETED: 'pin_setup_completed',
  WALLET_CREATED: 'wallet_created',
  WALLET_IMPORTED: 'wallet_imported',
  PASSKEY_SETUP_OFFERED: 'passkey_setup_offered',
  PASSKEY_SETUP_COMPLETED: 'passkey_setup_completed',
  PASSKEY_SETUP_SKIPPED: 'passkey_setup_skipped',
  BIOMETRIC_SETUP_OFFERED: 'biometric_setup_offered',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  BIOMETRIC_SKIPPED: 'biometric_skipped',
  ONBOARDING_COMPLETED: 'onboarding_completed',
} as const;

// ── Auth ─────────────────────────────────────────────────────
export const AUTH_EVENTS = {
  AUTH_ATTEMPT: 'auth_attempt',
  AUTH_SUCCESS: 'auth_success',
  AUTH_FAILED: 'auth_failed',
  APP_LOCKED: 'app_locked',
  APP_UNLOCKED: 'app_unlocked',
} as const;

// ── Transactions ─────────────────────────────────────────────
export const TRANSACTION_EVENTS = {
  SEND_STARTED: 'send_started',
  SEND_AMOUNT_ENTERED: 'send_amount_entered',
  SEND_ADDRESS_ENTERED: 'send_address_entered',
  SEND_REVIEWED: 'send_reviewed',
  SEND_CONFIRMED: 'send_confirmed',
  SEND_PROCESSING: 'send_processing',
  SEND_SIGNED: 'send_signed',
  SEND_BROADCAST: 'send_broadcast',
  SEND_CONFIRMED_ONCHAIN: 'send_confirmed_onchain',
  SEND_FAILED: 'send_failed',
} as const;

// ── Vault Operations ─────────────────────────────────────────
export const VAULT_EVENTS = {
  VAULT_CREATED: 'vault_created',
  VAULT_OPERATION_STARTED: 'vault_operation_started',
  VAULT_OPERATION_COMPLETED: 'vault_operation_completed',
  VAULT_OPERATION_FAILED: 'vault_operation_failed',
  VAULT_HEALTH_WARNING: 'vault_health_warning',
} as const;

// ── Liquidation ──────────────────────────────────────────────
export const LIQUIDATION_EVENTS = {
  LIQUIDATION_SCREEN_OPENED: 'liquidation_screen_opened',
  LIQUIDATION_CLAIMED: 'liquidation_claimed',
  LIQUIDATION_COMPLETED: 'liquidation_completed',
  LIQUIDATION_FAILED: 'liquidation_failed',
} as const;

// ── Cashu E-cash ─────────────────────────────────────────────
export const CASHU_EVENTS = {
  CASHU_MINT_STARTED: 'cashu_mint_started',
  CASHU_MINT_COMPLETED: 'cashu_mint_completed',
  CASHU_TOKEN_RECEIVED: 'cashu_token_received',
  CASHU_TOKEN_SENT: 'cashu_token_sent',
  CASHU_MELT_STARTED: 'cashu_melt_started',
  CASHU_MELT_COMPLETED: 'cashu_melt_completed',
} as const;

// ── Receive ──────────────────────────────────────────────────
export const RECEIVE_EVENTS = {
  RECEIVE_SCREEN_VIEWED: 'receive_screen_viewed',
  ADDRESS_COPIED: 'address_copied',
  ADDRESS_SHARED: 'address_shared',
} as const;

// ── Settings ─────────────────────────────────────────────────
export const SETTINGS_EVENTS = {
  SETTINGS_OPENED: 'settings_opened',
  SECURITY_SETTING_CHANGED: 'security_setting_changed',
  PREFERENCE_CHANGED: 'preference_changed',
  WALLET_DELETED: 'wallet_deleted',
} as const;

// ── Navigation ───────────────────────────────────────────────
export const NAVIGATION_EVENTS = {
  SCREEN_VIEWED: 'screen_viewed',
  TAB_SWITCHED: 'tab_switched',
} as const;

// ── Errors ───────────────────────────────────────────────────
export const ERROR_EVENTS = {
  ERROR_BOUNDARY_TRIGGERED: 'error_boundary_triggered',
  TRANSACTION_ERROR: 'transaction_error',
  API_ERROR: 'api_error',
} as const;

// ── Startup Diagnostics ─────────────────────────────────────
export const STARTUP_EVENTS = {
  /** Fired once at end of startup with timing for every gate. */
  STARTUP_COMPLETE: 'startup_complete',
  /** Fired if startup times out (splash hung). */
  STARTUP_TIMEOUT: 'startup_timeout',
  /** Fired per-checkpoint so we get partial data even if app crashes. */
  STARTUP_CHECKPOINT: 'startup_checkpoint',
  /** Fired when a startup-specific warning or fallback occurs. */
  STARTUP_WARNING: 'startup_warning',
  /** Fired when startup fails for a non-timeout reason. */
  STARTUP_FAILURE: 'startup_failure',
  /** Fired on next launch if the previous attempt never completed. */
  STARTUP_PREVIOUS_ATTEMPT_RECOVERED: 'startup_previous_attempt_recovered',
} as const;
