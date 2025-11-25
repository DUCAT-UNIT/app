/**
 * Centralized logging utility
 * Routes logs to Sentry in production, console in development
 * Enhanced with comprehensive tracking for testing
 */

/* eslint-disable no-console */

import * as Sentry from '@sentry/react-native';
import sentryService from '../services/sentryService';

// Determine if we're in development mode
const isDev = __DEV__;

/**
 * Logger service - abstracts logging to allow easy switching between console and Sentry
 */
export const logger = {
  /**
   * Debug-level logs (only in development)
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  debug: (message, ...args) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    } else {
      Sentry.addBreadcrumb({
        message,
        level: 'debug',
        data: args.length > 0 ? (typeof args[0] === 'object' ? args[0] : { args }) : {},
      });
    }
  },

  /**
   * Info-level logs
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   */
  info: (message, context = {}) => {
    if (isDev) {
      console.log(`[INFO] ${message}`, context);
    }
    // Always send to Sentry for comprehensive tracking
    Sentry.addBreadcrumb({
      message,
      level: 'info',
      data: context,
    });
  },

  /**
   * Warning-level logs
   * @param {string} message - Warning message
   * @param {Object} context - Additional context
   */
  warn: (message, context = {}) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, context);
    }
    Sentry.addBreadcrumb({
      message,
      level: 'warning',
      data: context,
    });
    Sentry.captureMessage(message, 'warning');
  },

  /**
   * Error-level logs
   * @param {string|Error} error - Error object or message
   * @param {Object} context - Additional context
   */
  error: (error, context = {}) => {
    if (isDev) {
      console.error('[ERROR]', error, context);
    }
    if (error instanceof Error) {
      Sentry.captureException(error, {
        contexts: { extra: context },
      });
    } else {
      Sentry.captureMessage(String(error), {
        level: 'error',
        contexts: { extra: context },
      });
    }
  },

  /**
   * Transaction breadcrumb - track transaction flow
   * @param {string} step - Transaction step (e.g., 'intent_created', 'signed', 'broadcast')
   * @param {Object} data - Transaction data (sanitized, no sensitive info)
   */
  transaction: (step, data = {}) => {
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
   * @param {string} event - Security event (e.g., 'pin_failed', 'lockout')
   * @param {Object} data - Event data
   */
  security: (event, data = {}) => {
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
   * @param {string} screenName - Name of the screen
   * @param {Object} params - Navigation params (will be sanitized)
   */
  screen: (screenName, params = {}) => {
    if (isDev) {
      console.log(`[SCREEN] ${screenName}`, params);
    }
    sentryService.trackScreen(screenName, params);
  },

  /**
   * Track user action
   * @param {string} action - Action name
   * @param {string} category - Action category
   * @param {Object} data - Additional data
   */
  action: (action, category = 'user_action', data = {}) => {
    if (isDev) {
      console.log(`[ACTION] ${category}: ${action}`, data);
    }
    sentryService.trackAction(action, category, data);
  },

  /**
   * Track wallet operations
   * @param {string} operation - Operation name
   * @param {Object} data - Operation data
   */
  wallet: (operation, data = {}) => {
    if (isDev) {
      console.log(`[WALLET] ${operation}`, data);
    }
    sentryService.trackWalletOperation(operation, data);
  },

  /**
   * Track Cashu/eCash operations
   * @param {string} operation - Operation name
   * @param {Object} data - Operation data
   */
  cashu: (operation, data = {}) => {
    if (isDev) {
      console.log(`[CASHU] ${operation}`, data);
    }
    sentryService.trackCashuOperation(operation, data);
  },

  /**
   * Track API calls
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {number} status - Response status
   * @param {number} duration - Request duration in ms
   */
  api: (endpoint, method, status, duration = null) => {
    if (isDev) {
      console.log(`[API] ${method} ${endpoint} -> ${status}`, duration ? `(${duration}ms)` : '');
    }
    sentryService.trackApiCall(endpoint, method, status, duration);
  },

  /**
   * Track authentication events
   * @param {string} event - Auth event name
   * @param {Object} data - Event data
   */
  auth: (event, data = {}) => {
    if (isDev) {
      console.log(`[AUTH] ${event}`, data);
    }
    sentryService.trackAuth(event, data);
  },

  /**
   * Track performance metrics
   * @param {string} metric - Metric name
   * @param {number} value - Metric value
   * @param {string} unit - Unit of measurement
   */
  perf: (metric, value, unit = 'ms') => {
    if (isDev) {
      console.log(`[PERF] ${metric}: ${value}${unit}`);
    }
    sentryService.trackPerformance(metric, value, unit);
  },

  /**
   * Track Turbo mode operations
   * @param {string} operation - Operation name
   * @param {Object} data - Operation data
   */
  turbo: (operation, data = {}) => {
    if (isDev) {
      console.log(`[TURBO] ${operation}`, data);
    }
    Sentry.addBreadcrumb({
      category: 'turbo',
      message: `Turbo: ${operation}`,
      level: 'info',
      data: {
        operation,
        ...data,
        timestamp: new Date().toISOString(),
      },
    });
  },

  /**
   * Track vault operations
   * @param {string} operation - Operation name
   * @param {Object} data - Operation data
   */
  vault: (operation, data = {}) => {
    if (isDev) {
      console.log(`[VAULT] ${operation}`, data);
    }
    Sentry.addBreadcrumb({
      category: 'vault',
      message: `Vault: ${operation}`,
      level: 'info',
      data: {
        operation,
        ...data,
        timestamp: new Date().toISOString(),
      },
    });
  },

  /**
   * Track onboarding flow
   * @param {string} step - Onboarding step
   * @param {Object} data - Step data
   */
  onboarding: (step, data = {}) => {
    if (isDev) {
      console.log(`[ONBOARDING] ${step}`, data);
    }
    Sentry.addBreadcrumb({
      category: 'onboarding',
      message: `Onboarding: ${step}`,
      level: 'info',
      data: {
        step,
        ...data,
        timestamp: new Date().toISOString(),
      },
    });
  },

  /**
   * Start a performance transaction
   * @param {string} name - Transaction name
   * @param {string} op - Operation type
   * @returns {Object} Transaction object with finish() method
   */
  startTransaction: (name, op = 'task') => {
    const startTime = Date.now();

    if (isDev) {
      console.log(`[PERF START] ${name}`);
    }

    return {
      finish: (status = 'ok') => {
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
   * @param {string} key - Context key
   * @param {Object} data - Context data
   */
  setContext: (key, data) => {
    sentryService.setSessionContext(key, data);
  },

  /**
   * Set tag for filtering
   * @param {string} key - Tag key
   * @param {string} value - Tag value
   */
  setTag: (key, value) => {
    sentryService.setTag(key, value);
  },
};

export default logger;
