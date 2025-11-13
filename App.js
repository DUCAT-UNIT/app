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
// AirdropProvider removed - not currently used in provider hierarchy
import { UIProvider, useToastContext } from './contexts/UIContext';

// Navigation
import AppNavigator from './navigation/AppNavigator';

// Components
import SplashScreen from './components/SplashScreen';

// Initialize BIP32 and ECC for bitcoinjs-lib
BIP32Factory(ecc); // Initializes the factory
bitcoin.initEccLib(ecc);

// Initialize Sentry
Sentry.init({
  dsn: 'https://73c5edc0813cd1be8eba194004f1ec1a@o4510347963072512.ingest.us.sentry.io/4510347966873600',
  environment: __DEV__ ? 'development' : 'production',
  enabled: true, // TEMPORARILY enabled in dev to test
  tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
  beforeSend(event, _hint) {
    // Filter out sensitive data before sending to Sentry
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }
    return event;
  },
});

// 🧪 TEST: Send a test error to Sentry (disabled - uncomment to test)
// setTimeout(() => {
//   Sentry.captureException(new Error('🧪 Test Error - Sentry is working!'));
//   Sentry.captureMessage('🧪 Test Message - Sentry integration successful', 'info');
// }, 3000);

// Inner component to access wallet and toast contexts
function AppProviders({ children }) {
  const { currentAccount } = useWallet();
  const { showToast } = useToastContext();

  return (
    <PendingTransactionsProvider currentAccount={currentAccount} showToast={showToast}>
      <WalletDataProvider>
        <PriceProvider>
          {children}
        </PriceProvider>
      </WalletDataProvider>
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
    <AuthProvider>
      <WalletProvider>
        <UIProvider>
          <AppProviders>
            <AppNavigator />
          </AppProviders>
        </UIProvider>
      </WalletProvider>
    </AuthProvider>
  );
}
