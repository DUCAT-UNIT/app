/**
 * Sentry Service - Comprehensive logging and session tracking
 * Uses device ID for session identification
 */

import * as Sentry from '@sentry/react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = '@ducat_device_id';

// Session state
let deviceId = null;
let sessionStartTime = null;
let isInitialized = false;

/**
 * Generate a unique device identifier
 * Uses a combination of device info + random UUID for persistence
 */
async function generateDeviceId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  const deviceInfo = `${Device.brand || 'unknown'}-${Device.modelName || 'device'}`.replace(/\s+/g, '-');
  return `${deviceInfo}-${timestamp}-${random}`;
}

/**
 * Get or create persistent device ID
 */
export async function getDeviceId() {
  if (deviceId) return deviceId;

  try {
    // Try to get existing device ID
    const storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (storedId) {
      deviceId = storedId;
      return deviceId;
    }

    // Generate new device ID
    deviceId = await generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  } catch (error) {
    // Fallback to generated ID without persistence
    deviceId = await generateDeviceId();
    return deviceId;
  }
}

/**
 * Initialize Sentry with device identification
 * Call this early in app startup after Sentry.init()
 */
export async function initializeSentrySession() {
  if (isInitialized) return;

  try {
    const id = await getDeviceId();
    sessionStartTime = new Date();

    // Set user identification
    Sentry.setUser({
      id: id,
      username: `device-${id.substring(0, 8)}`,
    });

    // Set device context
    Sentry.setContext('device_info', {
      device_id: id,
      brand: Device.brand,
      model: Device.modelName,
      os: Platform.OS,
      os_version: Platform.Version,
      device_type: Device.deviceType,
      is_device: Device.isDevice,
    });

    // Set app context
    Sentry.setContext('app_info', {
      version: Application.nativeApplicationVersion || 'unknown',
      build: Application.nativeBuildVersion || 'unknown',
      session_start: sessionStartTime.toISOString(),
    });

    // Tag for filtering
    Sentry.setTag('device_id', id);
    Sentry.setTag('platform', Platform.OS);
    Sentry.setTag('device_brand', Device.brand || 'unknown');

    isInitialized = true;

    // Log session start
    Sentry.addBreadcrumb({
      category: 'session',
      message: 'Session started',
      level: 'info',
      data: {
        device_id: id,
        timestamp: sessionStartTime.toISOString(),
      },
    });

    return id;
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}

/**
 * Track screen navigation
 */
export function trackScreen(screenName, params = {}) {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Screen: ${screenName}`,
    level: 'info',
    data: {
      screen: screenName,
      params: sanitizeParams(params),
      timestamp: new Date().toISOString(),
    },
  });

  // Set current screen tag for context
  Sentry.setTag('current_screen', screenName);
}

/**
 * Track user action
 */
export function trackAction(action, category = 'user_action', data = {}) {
  Sentry.addBreadcrumb({
    category,
    message: action,
    level: 'info',
    data: {
      ...sanitizeParams(data),
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track transaction flow with detailed steps
 */
export function trackTransactionFlow(step, data = {}) {
  const sanitizedData = sanitizeParams(data);

  Sentry.addBreadcrumb({
    category: 'transaction_flow',
    message: `TX: ${step}`,
    level: 'info',
    data: {
      step,
      ...sanitizedData,
      timestamp: new Date().toISOString(),
    },
  });

  // For critical transaction steps, also capture as a message
  const criticalSteps = ['broadcast_started', 'broadcast_success', 'broadcast_failed', 'signing_failed'];
  if (criticalSteps.includes(step)) {
    Sentry.captureMessage(`Transaction ${step}`, {
      level: step.includes('failed') ? 'error' : 'info',
      tags: { transaction_step: step },
      extra: sanitizedData,
    });
  }
}

/**
 * Track wallet operations
 */
export function trackWalletOperation(operation, data = {}) {
  Sentry.addBreadcrumb({
    category: 'wallet',
    message: `Wallet: ${operation}`,
    level: 'info',
    data: {
      operation,
      ...sanitizeParams(data),
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track Cashu/eCash operations
 */
export function trackCashuOperation(operation, data = {}) {
  Sentry.addBreadcrumb({
    category: 'cashu',
    message: `Cashu: ${operation}`,
    level: 'info',
    data: {
      operation,
      ...sanitizeParams(data),
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track authentication events
 */
export function trackAuth(event, data = {}) {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: `Auth: ${event}`,
    level: event.includes('failed') ? 'warning' : 'info',
    data: {
      event,
      ...sanitizeParams(data),
      timestamp: new Date().toISOString(),
    },
  });

  // Track failed auth attempts
  if (event.includes('failed')) {
    Sentry.captureMessage(`Auth failed: ${event}`, {
      level: 'warning',
      tags: { auth_event: event },
    });
  }
}

/**
 * Track network/API calls
 */
export function trackApiCall(endpoint, method, status, duration = null) {
  Sentry.addBreadcrumb({
    category: 'api',
    message: `API: ${method} ${endpoint}`,
    level: status >= 400 ? 'error' : 'info',
    data: {
      endpoint: sanitizeEndpoint(endpoint),
      method,
      status,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track errors with context
 */
export function trackError(error, context = {}, level = 'error') {
  const sanitizedContext = sanitizeParams(context);

  if (error instanceof Error) {
    Sentry.captureException(error, {
      level,
      tags: context.tags || {},
      extra: sanitizedContext,
    });
  } else {
    Sentry.captureMessage(String(error), {
      level,
      tags: context.tags || {},
      extra: sanitizedContext,
    });
  }
}

/**
 * Track performance metrics
 */
export function trackPerformance(metric, value, unit = 'ms') {
  Sentry.addBreadcrumb({
    category: 'performance',
    message: `Perf: ${metric}`,
    level: 'info',
    data: {
      metric,
      value,
      unit,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Set custom context for current session
 */
export function setSessionContext(key, data) {
  Sentry.setContext(key, sanitizeParams(data));
}

/**
 * Add tag for filtering
 */
export function setTag(key, value) {
  Sentry.setTag(key, String(value));
}

/**
 * Get session duration in seconds
 */
export function getSessionDuration() {
  if (!sessionStartTime) return 0;
  return Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
}

/**
 * End session tracking
 */
export function endSession() {
  if (sessionStartTime) {
    const duration = getSessionDuration();
    Sentry.addBreadcrumb({
      category: 'session',
      message: 'Session ended',
      level: 'info',
      data: {
        duration_seconds: duration,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// =============================================================================
// SANITIZATION HELPERS
// =============================================================================

const SENSITIVE_KEYS = /mnemonic|seed|private|secret|password|pin|passkey|credential|key|token|proof/i;
const SENSITIVE_VALUES = {
  // Mnemonics
  mnemonic: /\b([a-z]+\s+){11,23}[a-z]+\b/gi,
  // Private keys
  privateKey: /\b[KLc][1-9A-HJ-NP-Za-km-z]{51}\b/g,
  // Hex keys
  hexKey: /\b[0-9a-fA-F]{64}\b/g,
  // PIN
  pin: /\b\d{6}\b/g,
  // Cashu tokens
  cashuToken: /cashuA[A-Za-z0-9_-]+/g,
};

function sanitizeParams(params) {
  if (!params || typeof params !== 'object') return params;

  const sanitized = {};
  for (const [key, value] of Object.entries(params)) {
    if (SENSITIVE_KEYS.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      let sanitizedValue = value;
      for (const [, pattern] of Object.entries(SENSITIVE_VALUES)) {
        sanitizedValue = sanitizedValue.replace(pattern, '[REDACTED]');
      }
      sanitized[key] = sanitizedValue;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeParams(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function sanitizeEndpoint(endpoint) {
  // Remove any query params that might contain sensitive data
  return endpoint.split('?')[0];
}

export default {
  initializeSentrySession,
  getDeviceId,
  trackScreen,
  trackAction,
  trackTransactionFlow,
  trackWalletOperation,
  trackCashuOperation,
  trackAuth,
  trackApiCall,
  trackError,
  trackPerformance,
  setSessionContext,
  setTag,
  getSessionDuration,
  endSession,
};
