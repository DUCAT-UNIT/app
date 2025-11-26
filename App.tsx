/**
 * App.js - Main application entry point
 * Minimal orchestrator that wires up providers and navigation
 */

// Polyfills - MUST BE FIRST
import './crypto-polyfill';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import React from 'react';
import { useFonts } from 'expo-font';
import BIP32Factory from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import * as Sentry from '@sentry/react-native';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { PendingTransactionsProvider } from './contexts/PendingTransactionsContext';
import { WalletDataProvider } from './contexts/WalletDataContext';
import { PriceProvider } from './contexts/PriceContext';
import { CashuProvider } from './contexts/CashuContext';
// AirdropProvider removed - not currently used in provider hierarchy
import { UIProvider } from './contexts/UIContext';
import { useNotifications } from './contexts/NotificationContext';

// Navigation
import AppNavigator from './navigation/AppNavigator';

// Components
import SplashScreen from './screens/SplashScreen';
import ErrorBoundary from './components/ErrorBoundary';

// Initialize BIP32 and ECC for bitcoinjs-lib
BIP32Factory(ecc); // Initializes the factory
bitcoin.initEccLib(ecc);

// CRITICAL: Validate network configuration at startup
// This must happen before any Bitcoin operations
import { validateNetworkConfig } from './utils/bitcoin';
import logger from './utils/logger';
import { initializeSentrySession } from './services/sentryService';

try {
  validateNetworkConfig();
  logger.info('Network validation passed: App is correctly configured for testnet');
} catch (error) {
  logger.error('CRITICAL NETWORK ERROR', { error: error instanceof Error ? error.message : String(error) });
  throw error; // Fail fast - do not allow app to start with wrong network
}

// Initialize Sentry session with device ID for tracking
initializeSentrySession().then((deviceId) => {
  if (deviceId) {
    logger.info('Sentry session initialized', { deviceId: deviceId.substring(0, 8) + '...' });
  }
});

// SECURITY: Sanitize sensitive data before sending to Sentry
function sanitizeSensitiveData(str: unknown): unknown {
  if (typeof str !== 'string') return str;

  return str
    // Mnemonics (12 or 24 words separated by spaces)
    .replace(/\b([a-z]+\s+){11,23}[a-z]+\b/gi, '[REDACTED_MNEMONIC]')
    // Bitcoin private keys (WIF format, starts with K, L, or c for testnet)
    .replace(/\b[KLc][1-9A-HJ-NP-Za-km-z]{51}\b/g, '[REDACTED_PRIVKEY]')
    // Hex private keys (64 hex characters)
    .replace(/\b[0-9a-fA-F]{64}\b/g, '[REDACTED_KEY]')
    // PIN codes (6 digits)
    .replace(/\b\d{6}\b/g, '[REDACTED_PIN]')
    // PSBTs (base64, usually starts with cHNi)
    .replace(/cHNi[A-Za-z0-9+/=]{100,}/g, '[REDACTED_PSBT]');
}

function sanitizeObject<T>(obj: T, depth = 0): T {
  if (!obj || typeof obj !== 'object' || depth > 5) return obj;

  const isArray = Array.isArray(obj);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sanitized: any = isArray ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive keys entirely
    const sensitiveKeys = /mnemonic|seed|private|secret|password|pin|passkey|credential/i;
    if (sensitiveKeys.test(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeSensitiveData(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

// Initialize Sentry with comprehensive sanitization
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enabled: true, // TEMPORARILY enabled in dev to test
  tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring

  beforeSend(event, _hint) {
    // SECURITY: Sanitize all sensitive data before sending to Sentry

    // Sanitize request data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;

      if (event.request.data) {
        event.request.data = sanitizeObject(event.request.data);
      }
    }

    // Sanitize exception messages
    if (event.exception?.values) {
      event.exception.values.forEach((exception) => {
        if (exception.value) {
          exception.value = sanitizeSensitiveData(exception.value) as string;
        }

        // Sanitize stack trace variables
        if (exception.stacktrace?.frames) {
          exception.stacktrace.frames.forEach((frame) => {
            if (frame.vars) {
              frame.vars = sanitizeObject(frame.vars);
            }
          });
        }
      });
    }

    // Sanitize breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs.forEach((breadcrumb) => {
        if (breadcrumb.message) {
          breadcrumb.message = sanitizeSensitiveData(breadcrumb.message) as string;
        }
        if (breadcrumb.data) {
          breadcrumb.data = sanitizeObject(breadcrumb.data);
        }
      });
    }

    // Sanitize extra context
    if (event.extra) {
      event.extra = sanitizeObject(event.extra);
    }

    // Sanitize contexts
    if (event.contexts) {
      event.contexts = sanitizeObject(event.contexts);
    }

    return event;
  },

  beforeBreadcrumb(breadcrumb, _hint) {
    // Sanitize breadcrumb before it's added
    if (breadcrumb.message) {
      breadcrumb.message = sanitizeSensitiveData(breadcrumb.message) as string;
    }
    if (breadcrumb.data) {
      breadcrumb.data = sanitizeObject(breadcrumb.data);
    }
    return breadcrumb;
  },
});

// 🧪 TEST: Send a test error to Sentry (disabled - uncomment to test)
// setTimeout(() => {
//   Sentry.captureException(new Error('🧪 Test Error - Sentry is working!'));
//   Sentry.captureMessage('🧪 Test Message - Sentry integration successful', 'info');
// }, 3000);

// Inner component to access wallet and notification contexts
function AppProviders({ children }: { children: React.ReactNode }) {
  const { currentAccount } = useWallet();
  const { showSnackbar } = useNotifications();

  return (
    <PendingTransactionsProvider currentAccount={currentAccount} showSnackbar={showSnackbar}>
      <CashuProvider>
        <WalletDataProvider>
          <PriceProvider>
            {children}
          </PriceProvider>
        </WalletDataProvider>
      </CashuProvider>
    </PendingTransactionsProvider>
  );
}

// Main App - Provider setup only
export default function App() {
  // Load fonts
  const [fontsLoaded] = useFonts({
    'CabinetGrotesk-Regular': require('./assets/fonts/CabinetGrotesk-Regular.otf'),
    'CabinetGrotesk-Medium': require('./assets/fonts/CabinetGrotesk-Medium.otf'),
    'CabinetGrotesk-Bold': require('./assets/fonts/CabinetGrotesk-Bold.otf'),
  });

  if (!fontsLoaded) {
    return <SplashScreen />;
  }

  return (
    <ErrorBoundary
      boundaryName="App"
      fallbackMessage="A critical error occurred. Please restart the app."
    >
      <AuthProvider>
        <UIProvider>
          <WalletProvider>
            <AppProviders>
              <AppNavigator />
            </AppProviders>
          </WalletProvider>
        </UIProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
