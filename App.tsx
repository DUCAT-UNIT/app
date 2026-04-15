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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import BIP32Factory from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';

import { analytics } from './services/analyticsService';
import { ONBOARDING_EVENTS, STARTUP_EVENTS } from './constants/analyticsEvents';

// Startup timing — capture t0 as early as possible
const startupT0 = Date.now();

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { usePendingTransactionsStore } from './stores/pendingTransactionsStore';
import { WalletDataProvider } from './contexts/WalletDataContext';
import { usePriceStore } from './stores/priceStore';
import { useVaultCreationStore } from './stores/vaultCreationStore';
import { CashuProvider } from './contexts/CashuContext';
// UIProvider removed — fully migrated to Zustand (displayPreferencesStore, notificationStore)
// AirdropProvider removed — airdrop logic lives in AirdropContext, used via hooks only
import { ResponsiveProvider } from './contexts/ResponsiveContext';


// Navigation
import AppNavigator from './navigation/AppNavigator';

// Components
import ErrorBoundary from './components/ErrorBoundary';

import { useRemoteConfigStore } from './stores/remoteConfigStore';
import { validateNetworkConfig } from './utils/bitcoin';
import { NETWORK_DISPLAY_NAME } from './utils/constants';
import { logger } from './utils/logger';

// Keep the native splash screen visible until we explicitly hide it.
// If this races with Expo internals, log and continue rather than crashing startup.
void ExpoSplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  logger.warn('[App] Failed to prevent native splash auto-hide', {
    error: error instanceof Error ? error.message : String(error),
  });
});

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
const NATIVE_SPLASH_WATCHDOG_MS = 1500;

// Main App - Provider setup only
export default function App() {
  const nativeSplashStateRef = useRef<'visible' | 'hiding' | 'hidden'>('visible');

  const hideNativeSplash = useCallback(async (reason: 'layout' | 'watchdog' | 'app_ready') => {
    if (nativeSplashStateRef.current !== 'visible') {
      return;
    }

    nativeSplashStateRef.current = 'hiding';

    analytics.track(STARTUP_EVENTS.STARTUP_CHECKPOINT, {
      gate: 'native_splash_hide',
      elapsed_ms: Date.now() - startupT0,
      reason,
    });

    try {
      await ExpoSplashScreen.hideAsync();
      nativeSplashStateRef.current = 'hidden';
    } catch (error: unknown) {
      logger.warn('[App] Failed to hide native splash', {
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      nativeSplashStateRef.current = 'visible';
    }
  }, []);

  // Load fonts
  const [fontsLoaded] = useFonts({
    'CabinetGrotesk-Regular': require('./assets/fonts/CabinetGrotesk-Regular.otf'),
    'CabinetGrotesk-Medium': require('./assets/fonts/CabinetGrotesk-Medium.otf'),
    'CabinetGrotesk-Bold': require('./assets/fonts/CabinetGrotesk-Bold.otf'),
  });

  // Timeout: if fonts don't load within 5s, proceed anyway
  const [fontTimedOut, setFontTimedOut] = useState(false);
  useEffect(() => {
    if (fontsLoaded) {
      analytics.track(STARTUP_EVENTS.STARTUP_CHECKPOINT, {
        gate: 'fonts_loaded', elapsed_ms: Date.now() - startupT0, timed_out: false,
      });
      return;
    }
    const timer = setTimeout(() => {
      logger.warn('[App] Font loading timed out, proceeding without custom fonts');
      analytics.track(STARTUP_EVENTS.STARTUP_CHECKPOINT, {
        gate: 'fonts_loaded', elapsed_ms: Date.now() - startupT0, timed_out: true,
      });
      setFontTimedOut(true);
    }, FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  // Remote config initialization (has its own 3s timeout built in)
  const [configReady, setConfigReady] = useState(false);
  useEffect(() => {
    let timedOut = false;
    const markReady = () => {
      if (!configReady) {
        analytics.track(STARTUP_EVENTS.STARTUP_CHECKPOINT, {
          gate: 'config_ready', elapsed_ms: Date.now() - startupT0, timed_out: timedOut,
        });
      }
      setConfigReady(true);
    };
    // Safety timeout — never block app load for more than 5s
    const safetyTimer = setTimeout(() => { timedOut = true; markReady(); }, 5000);
    useRemoteConfigStore
      .getState()
      .initialize()
      .then(markReady)
      .catch(markReady)
      .finally(() => clearTimeout(safetyTimer));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Analytics: set super properties and track app open on mount
  useEffect(() => {
    analytics.setSuperProperties({
      app_version: Constants.expoConfig?.version ?? 'unknown',
      build_number: Application.nativeBuildVersion ?? 'unknown',
      bundle_id: Application.applicationId ?? 'unknown',
      network: NETWORK_DISPLAY_NAME,
      platform: Platform.OS,
      os_version: Platform.Version?.toString() ?? 'unknown',
      device_brand: Device.brand ?? 'unknown',
      device_model: Device.modelName ?? 'unknown',
      device_name: Device.deviceName ?? 'unknown',
      device_type: Device.deviceType?.toString() ?? 'unknown',
      is_device: Device.isDevice ?? false,
    });
    analytics.track(ONBOARDING_EVENTS.APP_OPENED);
    // Reset stale vault creation form data on app launch
    // (persisted amounts/fee rates may be outdated after restart)
    useVaultCreationStore.getState().reset();
  }, []);

  const appReady = (fontsLoaded || fontTimedOut) && configReady;

  // Hide the native splash as soon as the first React layout exists.
  // The in-app splash/loading screen continues covering initialization afterwards,
  // which avoids deadlocks if a later native capability probe stalls on iPad.
  useEffect(() => {
    const timer = setTimeout(() => {
      void hideNativeSplash('watchdog');
    }, NATIVE_SPLASH_WATCHDOG_MS);

    return () => clearTimeout(timer);
  }, [hideNativeSplash]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    analytics.track(STARTUP_EVENTS.STARTUP_CHECKPOINT, {
      gate: 'app_ready',
      elapsed_ms: Date.now() - startupT0,
    });

    void hideNativeSplash('app_ready');
  }, [appReady, hideNativeSplash]);

  const handleRootLayout = useCallback(() => {
    void hideNativeSplash('layout');
  }, [hideNativeSplash]);

  // Always render the full tree so the root view exists immediately.
  // If initialization is still running, the React launch splash covers the app
  // after the native splash is dismissed.
  return (
    <View style={{ flex: 1 }} onLayout={handleRootLayout}>
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
    </View>
  );
}
