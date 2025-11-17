/**
 * Centralized logging utility
 * Routes logs to Sentry in production, console in development
 */

/* eslint-disable no-console */

import * as Sentry from '@sentry/react-native';

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
    } else {
      Sentry.addBreadcrumb({
        message,
        level: 'info',
        data: context,
      });
    }
  },

  /**
   * Warning-level logs
   * @param {string} message - Warning message
   * @param {Object} context - Additional context
   */
  warn: (message, context = {}) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, context);
    } else {
      Sentry.addBreadcrumb({
        message,
        level: 'warning',
        data: context,
      });
      Sentry.captureMessage(message, 'warning');
    }
  },

  /**
   * Error-level logs
   * @param {string|Error} error - Error object or message
   * @param {Object} context - Additional context
   */
  error: (error, context = {}) => {
    if (isDev) {
      console.error('[ERROR]', error, context);
    } else {
      if (error instanceof Error) {
        Sentry.captureException(error, {
          contexts: { extra: context },
        });
      } else {
        Sentry.captureMessage(error, {
          level: 'error',
          contexts: { extra: context },
        });
      }
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
    } else {
      Sentry.addBreadcrumb({
        category: 'transaction',
        message: `Transaction: ${step}`,
        level: 'info',
        data: sanitizedData,
      });
    }
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
    } else {
      Sentry.addBreadcrumb({
        category: 'security',
        message: `Security: ${event}`,
        level: 'warning',
        data: sanitizedData,
      });
    }
  },
};

export default logger;
