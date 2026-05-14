/**
 * Centralized logging utility
 * Logs to console in development; error/security methods also log in production
 */

const isDev = __DEV__;
const isVerboseDebugEnabled = process.env.EXPO_PUBLIC_VERBOSE_DEBUG_LOGS === 'true';

// Keys and payload shapes that should never appear in log output.
const SENSITIVE_KEY_PATTERNS = [
  /mnemonic/i,
  /private.*key/i,
  /secret/i,
  /seed/i,
  /password/i,
  /^pin/i,
  /passphrase/i,
  /cashu.*token/i,
  /^token$/i,
  /tokenstring/i,
  /^proofs?$/i,
  /psbt/i,
  /^raw/i,
  /rawtx/i,
  /txhex/i,
];
const SENSITIVE_STRING_PATTERNS = [/^cashu[AB]/i, /^ducat:\/\//i, /^cHNidP/i, /^[0-9a-f]{120,}$/i];
const MAX_LOG_STRING_LENGTH = 500;
const MAX_SANITIZE_DEPTH = 4;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeString(value: string, key?: string): string {
  if (
    (key && isSensitiveKey(key)) ||
    SENSITIVE_STRING_PATTERNS.some((pattern) => pattern.test(value))
  ) {
    return '[REDACTED]';
  }

  if (value.length > MAX_LOG_STRING_LENGTH) {
    return `${value.substring(0, MAX_LOG_STRING_LENGTH)}...[truncated]`;
  }

  return value;
}

function sanitizeValue(value: unknown, key?: string, depth = 0): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value, key);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
    };
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (key && isSensitiveKey(key)) {
    return '[REDACTED]';
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return '[TruncatedObject]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, undefined, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
    sanitized[childKey] = sanitizeValue(childValue, childKey, depth + 1);
  }
  return sanitized;
}

function sanitizeContext(context: LogContext): LogContext {
  return sanitizeValue(context) as LogContext;
}

function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map((arg) => sanitizeValue(arg));
}

export type LogContext = Record<string, unknown>;

export interface PerformanceTransaction {
  finish: (status?: string) => void;
}

/**
 * Logger service - abstracts logging for the app
 * In development: logs info/warn to console
 * Verbose debug logs require EXPO_PUBLIC_VERBOSE_DEBUG_LOGS=true
 * In production: error and security methods log to console; all others are silent
 */
export const logger = {
  /**
   * Debug-level logs (development only, opt-in)
   * @param message - Log message
   * @param args - Additional arguments
   */
  debug: (message: string, ...args: unknown[]): void => {
    if (isDev && isVerboseDebugEnabled) {
      console.log(`[DEBUG] ${message}`, ...sanitizeArgs(args));
    }
  },

  /**
   * Info-level logs
   * @param message - Log message
   * @param context - Additional context
   */
  info: (message: string, context: LogContext = {}): void => {
    if (isDev) {
      console.log(`[INFO] ${message}`, sanitizeContext(context));
    }
  },

  /**
   * Warning-level logs
   * @param message - Warning message
   * @param context - Additional context
   */
  warn: (message: string, context: LogContext = {}): void => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, sanitizeContext(context));
    }
  },

  /**
   * Error-level logs — active in both dev and production
   * @param error - Error object or message
   * @param context - Additional context
   */
  error: (error: Error | string | unknown, context: LogContext = {}): void => {
    const sanitizedError = sanitizeValue(error);
    const sanitizedContext = sanitizeContext(context);
    if (isDev) {
      // Use console.warn in dev to avoid triggering the red error overlay
      // Errors are still clearly labeled [ERROR] in the log output
      console.warn('[ERROR]', sanitizedError, sanitizedContext);
    } else {
      // Production: log to console.error so crash reporters (e.g. EAS Updates) can capture
      console.error('[ERROR]', sanitizedError, sanitizedContext);
    }
  },

  /**
   * Transaction breadcrumb - track transaction flow
   * @param step - Transaction step (e.g., 'intent_created', 'signed', 'broadcast')
   * @param data - Transaction data
   */
  transaction: (step: string, data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[TRANSACTION] ${step}`, {
        step,
        timestamp: new Date().toISOString(),
        ...sanitizeContext(data),
      });
    }
  },

  /**
   * Security event - track security-related events
   * @param event - Security event (e.g., 'pin_failed', 'lockout')
   * @param data - Event data
   */
  security: (event: string, data: LogContext = {}): void => {
    if (isDev) {
      console.warn(`[SECURITY] ${event}`, {
        event,
        timestamp: new Date().toISOString(),
        ...sanitizeContext(data),
      });
    } else {
      // Production: always log security events so crash reporters can capture
      console.warn(`[SECURITY] ${event}`);
    }
  },

  // =============================================================================
  // ENHANCED TRACKING METHODS
  // =============================================================================

  /**
   * Track screen navigation
   * @param screenName - Name of the screen
   * @param params - Navigation params
   */
  screen: (screenName: string, params: LogContext = {}): void => {
    if (isDev) {
      console.log(`[SCREEN] ${screenName}`, sanitizeContext(params));
    }
  },

  /**
   * Track user action
   * @param action - Action name
   * @param category - Action category
   * @param data - Additional data
   */
  action: (action: string, category = 'user_action', data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[ACTION] ${category}: ${action}`, sanitizeContext(data));
    }
  },

  /**
   * Track wallet operations
   * @param operation - Operation name
   * @param data - Operation data
   */
  wallet: (operation: string, data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[WALLET] ${operation}`, sanitizeContext(data));
    }
  },

  /**
   * Track Cashu/eCash operations
   * @param operation - Operation name
   * @param data - Operation data
   */
  cashu: (operation: string, data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[CASHU] ${operation}`, sanitizeContext(data));
    }
  },

  /**
   * Track API calls
   * @param endpoint - API endpoint
   * @param method - HTTP method
   * @param status - Response status
   * @param duration - Request duration in ms
   */
  api: (endpoint: string, method: string, status: number, duration?: number | null): void => {
    if (isDev) {
      console.log(`[API] ${method} ${endpoint} -> ${status}`, duration ? `(${duration}ms)` : '');
    }
  },

  /**
   * Track authentication events
   * @param event - Auth event name
   * @param data - Event data
   */
  auth: (event: string, data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[AUTH] ${event}`, sanitizeContext(data));
    }
  },

  /**
   * Track performance metrics
   * @param metric - Metric name
   * @param value - Metric value
   * @param unit - Unit of measurement
   */
  perf: (metric: string, value: number, unit = 'ms'): void => {
    if (isDev) {
      console.log(`[PERF] ${metric}: ${value}${unit}`);
    }
  },

  /**
   * Track Turbo mode operations
   * @param operation - Operation name
   * @param data - Operation data
   */
  turbo: (operation: string, data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[TURBO] ${operation}`, sanitizeContext(data));
    }
  },

  /**
   * Track vault operations
   * @param operation - Operation name
   * @param data - Operation data
   */
  vault: (operation: string, data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[VAULT] ${operation}`, sanitizeContext(data));
    }
  },

  /**
   * Track onboarding flow
   * @param step - Onboarding step
   * @param data - Step data
   */
  onboarding: (step: string, data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[ONBOARDING] ${step}`, sanitizeContext(data));
    }
  },

  /**
   * Start a performance transaction
   * @param name - Transaction name
   * @param _op - Operation type (unused, kept for API compatibility)
   * @returns Transaction object with finish() method
   */
  startTransaction: (name: string, _op = 'task'): PerformanceTransaction => {
    const startTime = Date.now();

    if (isDev) {
      console.log(`[PERF START] ${name}`);
    }

    return {
      finish: (status = 'ok'): void => {
        const duration = Date.now() - startTime;
        if (isDev) {
          console.log(`[PERF END] ${name}: ${duration}ms (${status})`);
        }
      },
    };
  },
};
