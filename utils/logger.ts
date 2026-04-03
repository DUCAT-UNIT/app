/**
 * Centralized logging utility
 * Logs to console in development; error/security methods also log in production
 */

// Determine if we're in development mode
const isDev = __DEV__;

export type LogContext = Record<string, unknown>;

export interface PerformanceTransaction {
  finish: (status?: string) => void;
}

/**
 * Logger service - abstracts logging for the app
 * In development: logs to console
 * In production: error and security methods log to console; all others are silent
 */
export const logger = {
  /**
   * Debug-level logs (only in development)
   * @param message - Log message
   * @param args - Additional arguments
   */
  debug: (message: string, ...args: unknown[]): void => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info-level logs
   * @param message - Log message
   * @param context - Additional context
   */
  info: (message: string, context: LogContext = {}): void => {
    if (isDev) {
      console.log(`[INFO] ${message}`, context);
    }
  },

  /**
   * Warning-level logs
   * @param message - Warning message
   * @param context - Additional context
   */
  warn: (message: string, context: LogContext = {}): void => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, context);
    }
  },

  /**
   * Error-level logs — active in both dev and production
   * @param error - Error object or message
   * @param context - Additional context
   */
  error: (error: Error | string | unknown, context: LogContext = {}): void => {
    if (isDev) {
      // Use console.warn in dev to avoid triggering the red error overlay
      // Errors are still clearly labeled [ERROR] in the log output
      console.warn('[ERROR]', error, context);
    } else {
      // Production: log to console.error so crash reporters (e.g. EAS Updates) can capture
      console.error('[ERROR]', error instanceof Error ? error.message : error);
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
        ...data,
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
        ...data,
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
      console.log(`[SCREEN] ${screenName}`, params);
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
      console.log(`[ACTION] ${category}: ${action}`, data);
    }
  },

  /**
   * Track wallet operations
   * @param operation - Operation name
   * @param data - Operation data
   */
  wallet: (operation: string, data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[WALLET] ${operation}`, data);
    }
  },

  /**
   * Track Cashu/eCash operations
   * @param operation - Operation name
   * @param data - Operation data
   */
  cashu: (operation: string, data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[CASHU] ${operation}`, data);
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
      console.log(`[AUTH] ${event}`, data);
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
      console.log(`[TURBO] ${operation}`, data);
    }
  },

  /**
   * Track vault operations
   * @param operation - Operation name
   * @param data - Operation data
   */
  vault: (operation: string, data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[VAULT] ${operation}`, data);
    }
  },

  /**
   * Track onboarding flow
   * @param step - Onboarding step
   * @param data - Step data
   */
  onboarding: (step: string, data: LogContext = {}): void => {
    if (isDev) {
      console.log(`[ONBOARDING] ${step}`, data);
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
