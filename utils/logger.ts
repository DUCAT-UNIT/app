/**
 * Centralized logging utility
 * Routes logs to Sentry in production, console in development
 * Enhanced with comprehensive tracking for testing
 */

/* eslint-disable no-console */

import * as Sentry from '@sentry/react-native';
import sentryService, { sanitizeParams } from '../services/sentryService';

// Determine if we're in development mode
const isDev = __DEV__;

// ============================================================================
// REAL-TIME SENTRY STREAMING
// Set to true to stream all logs to Sentry in real-time (uses quota!)
// ============================================================================
const STREAM_TO_SENTRY = false;

export type LogContext = Record<string, unknown>;
export type SentryLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

/**
 * Stream a log message to Sentry in real-time
 * This sends it as a captureMessage so it appears in Sentry immediately
 */
const streamToSentry = (
  category: string,
  message: string,
  data: LogContext = {},
  level: SentryLevel = 'info'
): void => {
  if (!STREAM_TO_SENTRY) return;

  Sentry.captureMessage(`[${category}] ${message}`, {
    level,
    tags: {
      log_category: category,
      stream: 'realtime',
    },
    extra: {
      ...data,
      timestamp: new Date().toISOString(),
    },
  });
};

export interface PerformanceTransaction {
  finish: (status?: string) => void;
}

/**
 * Logger service - abstracts logging to allow easy switching between console and Sentry
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
    const data = args.length > 0 ? (args[0] !== null && typeof args[0] === 'object' ? args[0] as LogContext : { args }) : {};
    const sanitized = sanitizeParams(data as Record<string, unknown>);
    Sentry.addBreadcrumb({
      message,
      level: 'debug',
      data: sanitized,
    });
    streamToSentry('DEBUG', message, sanitized, 'debug');
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
    const sanitized = sanitizeParams(context as Record<string, unknown>);
    Sentry.addBreadcrumb({
      message,
      level: 'info',
      data: sanitized,
    });
    streamToSentry('INFO', message, sanitized, 'info');
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
    const sanitized = sanitizeParams(context as Record<string, unknown>);
    Sentry.addBreadcrumb({
      message,
      level: 'warning',
      data: sanitized,
    });
    Sentry.captureMessage(message, 'warning');
  },

  /**
   * Error-level logs
   * @param error - Error object or message
   * @param context - Additional context
   */
  error: (error: Error | string | unknown, context: LogContext = {}): void => {
    if (isDev) {
      console.error('[ERROR]', error, context);
    }
    const sanitized = sanitizeParams(context as Record<string, unknown>);
    if (error instanceof Error) {
      Sentry.captureException(error, {
        contexts: { extra: sanitized },
      });
    } else {
      Sentry.captureMessage(String(error), {
        level: 'error',
        contexts: { extra: sanitized },
      });
    }
  },

  /**
   * Transaction breadcrumb - track transaction flow
   * @param step - Transaction step (e.g., 'intent_created', 'signed', 'broadcast')
   * @param data - Transaction data (sanitized, no sensitive info)
   */
  transaction: (step: string, data: LogContext = {}): void => {
    const sanitizedData = {
      step,
      timestamp: new Date().toISOString(),
      ...data,
    };

    if (isDev) {
      console.log(`[TRANSACTION] ${step}`, sanitizedData);
    }
    sentryService.trackTransactionFlow(step, data);
  },

  /**
   * Security event - track security-related events
   * @param event - Security event (e.g., 'pin_failed', 'lockout')
   * @param data - Event data
   */
  security: (event: string, data: LogContext = {}): void => {
    const sanitizedData = {
      event,
      timestamp: new Date().toISOString(),
      ...data,
    };

    if (isDev) {
      console.warn(`[SECURITY] ${event}`, sanitizedData);
    }
    sentryService.trackAuth(event, data);
  },

  // =============================================================================
  // ENHANCED TRACKING METHODS
  // =============================================================================

  /**
   * Track screen navigation
   * @param screenName - Name of the screen
   * @param params - Navigation params (will be sanitized)
   */
  screen: (screenName: string, params: LogContext = {}): void => {
    if (isDev) {
      console.log(`[SCREEN] ${screenName}`, params);
    }
    sentryService.trackScreen(screenName, params);
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
    sentryService.trackAction(action, category, data);
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
    sentryService.trackWalletOperation(operation, data);
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
    sentryService.trackCashuOperation(operation, data);
    streamToSentry('CASHU', operation, data, 'info');
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
    sentryService.trackApiCall(endpoint, method, status, duration ?? null);
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
    sentryService.trackAuth(event, data);
    streamToSentry('AUTH', event, data, 'info');
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
    sentryService.trackPerformance(metric, value, unit);
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
    Sentry.addBreadcrumb({
      category: 'turbo',
      message: `Turbo: ${operation}`,
      level: 'info',
      data: {
        operation,
        ...sanitizeParams(data as Record<string, unknown>),
        timestamp: new Date().toISOString(),
      },
    });
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
    Sentry.addBreadcrumb({
      category: 'vault',
      message: `Vault: ${operation}`,
      level: 'info',
      data: {
        operation,
        ...sanitizeParams(data as Record<string, unknown>),
        timestamp: new Date().toISOString(),
      },
    });
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
    Sentry.addBreadcrumb({
      category: 'onboarding',
      message: `Onboarding: ${step}`,
      level: 'info',
      data: {
        step,
        ...sanitizeParams(data as Record<string, unknown>),
        timestamp: new Date().toISOString(),
      },
    });
  },

  /**
   * Start a performance transaction
   * @param name - Transaction name
   * @param op - Operation type
   * @returns Transaction object with finish() method
   */
  startTransaction: (name: string, op = 'task'): PerformanceTransaction => {
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
        sentryService.trackPerformance(name, duration, 'ms');
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `${name} completed`,
          level: status === 'ok' ? 'info' : 'warning',
          data: { duration_ms: duration, status },
        });
      },
    };
  },

  /**
   * Set session context
   * @param key - Context key
   * @param data - Context data
   */
  setContext: (key: string, data: LogContext): void => {
    sentryService.setSessionContext(key, data);
  },

  /**
   * Set tag for filtering
   * @param key - Tag key
   * @param value - Tag value
   */
  setTag: (key: string, value: string): void => {
    sentryService.setTag(key, value);
  },
};

export default logger;
