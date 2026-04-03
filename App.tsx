/**
 * App.js - Main application entry point
 * Minimal orchestrator that wires up providers and navigation
 */

// Polyfills - MUST BE FIRST
import './crypto-polyfill';
import { Buffer } from 'buffer';
global.Buffer = Buffer;


import { LogBox } from 'react-native';

if (!__DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true') {
  throw new Error('EXPO_PUBLIC_E2E_BYPASS must never be enabled outside development builds');
}

// Suppress all log notifications in E2E mode to prevent overlay interference
if (__DEV__ && process.env.EXPO_PUBLIC_E2E_BYPASS === 'true') {
  LogBox.ignoreAllLogs(true);
}

import React, { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import BIP32Factory from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { usePendingTransactionsStore } from './stores/pendingTransactionsStore';
import { WalletDataProvider } from './contexts/WalletDataContext';
import { usePriceStore } from './stores/priceStore';
import { CashuProvider } from './contexts/CashuContext';
// UIProvider removed — fully migrated to Zustand (displayPreferencesStore, notificationStore)
// AirdropProvider removed — airdrop logic lives in AirdropContext, used via hooks only
import { ResponsiveProvider } from './contexts/ResponsiveContext';


// Navigation
import AppNavigator from './navigation/AppNavigator';

// Components
import SplashScreen from './screens/SplashScreen';
import ErrorBoundary from './components/ErrorBoundary';

import { validateNetworkConfig } from './utils/bitcoin';
import { NETWORK_DISPLAY_NAME } from './utils/constants';
import { logger } from './utils/logger';

// Initialize BIP32 and ECC for bitcoinjs-lib — wrapped to prevent app crash
try {
  BIP32Factory(ecc);
  bitcoin.initEccLib(ecc);
} catch (error: unknown) {
  logger.error('[App] Failed to initialize crypto libraries', {
    error: error instanceof Error ? error.message : String(error),
  });
}

// CRITICAL: Validate network configuration at startup
try {
  validateNetworkConfig();
  logger.info(`Network validation passed: App is correctly configured for ${NETWORK_DISPLAY_NAME}`);
} catch (error: unknown) {
  logger.error('CRITICAL NETWORK ERROR', { error: error instanceof Error ? error.message : String(error) });
  throw error; // Fail fast - do not allow app to start with wrong network
}

// Global unhandled error handler for production
if (!__DEV__) {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    logger.error('[App] Unhandled error', { error: error?.message, isFatal });
    defaultHandler(error, isFatal);
  });
}

// Inner component to access wallet and notification contexts
function AppProviders({ children }: { children: React.ReactNode }) {
  const { currentAccount } = useWallet();
  const startAutoRefresh = usePriceStore((state) => state.startAutoRefresh);
  const loadFromStorage = usePendingTransactionsStore((state) => state.loadFromStorage);

  // Start BTC price auto-refresh on mount
  useEffect(() => {
    const cleanup = startAutoRefresh();
    return cleanup;
  }, [startAutoRefresh]);

  // Load pending transactions from storage when account changes
  useEffect(() => {
    if (currentAccount !== undefined && currentAccount !== null) {
      loadFromStorage(currentAccount);
    }
  }, [currentAccount, loadFromStorage]);

  return (
    <CashuProvider>
      <WalletDataProvider>
        {children}
      </WalletDataProvider>
    </CashuProvider>
  );
}

// Font loading timeout (ms) — proceed without custom fonts rather than hang forever
const FONT_LOAD_TIMEOUT_MS = 5000;

// Main App - Provider setup only
export default function App() {
  // Load fonts
  const [fontsLoaded] = useFonts({
    'CabinetGrotesk-Regular': require('./assets/fonts/CabinetGrotesk-Regular.otf'),
    'CabinetGrotesk-Medium': require('./assets/fonts/CabinetGrotesk-Medium.otf'),
    'CabinetGrotesk-Bold': require('./assets/fonts/CabinetGrotesk-Bold.otf'),
  });

  // Timeout: if fonts don't load within 5s, proceed anyway
  const [fontTimedOut, setFontTimedOut] = useState(false);
  useEffect(() => {
    if (fontsLoaded) return;
    const timer = setTimeout(() => {
      logger.warn('[App] Font loading timed out, proceeding without custom fonts');
      setFontTimedOut(true);
    }, FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  if (!fontsLoaded && !fontTimedOut) {
    return <SplashScreen />;
  }

  return (
    <ErrorBoundary
      boundaryName="App"
      fallbackMessage="A critical error occurred. Please restart the app."
    >
      <AuthProvider>
        <ResponsiveProvider>
          <WalletProvider>
            <AppProviders>
              <AppNavigator />
            </AppProviders>
          </WalletProvider>
        </ResponsiveProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
