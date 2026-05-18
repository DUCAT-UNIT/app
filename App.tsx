/**
 * App.js - Main application entry point
 * Minimal orchestrator that wires up providers and navigation
 */

// Polyfills - MUST BE FIRST
import './crypto-polyfill';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import React, { useEffect, useRef, useState } from 'react';
import {
  InteractionManager,
  Linking,
  LogBox,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import BIP32Factory from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';

import { analytics } from './services/analyticsService';
import { ONBOARDING_EVENTS } from './constants/analyticsEvents';
import { startupDiagnostics } from './services/startupDiagnostics';
import {
  E2E_RESET_SETTINGS_URL_PREFIX,
  resetNonSecretE2ESettings,
} from './services/e2eSettingsResetService';

// Startup timing — capture t0 as early as possible
const startupT0 = Date.now();
startupDiagnostics.beginAttempt().catch(() => undefined);

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { useAuthSession, useOnboardingFlow } from './contexts/AuthContext';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { usePendingTransactionsStore } from './stores/pendingTransactionsStore';
import { usePendingVaultTransactionStore } from './stores/pendingVaultTransactionStore';
import { WalletDataProvider } from './contexts/WalletDataContext';
import { usePriceStore } from './stores/priceStore';
import { useVaultCreationStore } from './stores/vaultCreationStore';
import { CashuProvider } from './contexts/CashuContext';
import { recoverPendingLiquidationSwapBroadcasts } from './services/liquidation/liquidationSwapBroadcastRecovery';
// UIProvider removed — fully migrated to Zustand (displayPreferencesStore, notificationStore)
// AirdropProvider removed — airdrop logic lives in AirdropContext, used via hooks only
import { ResponsiveProvider } from './contexts/ResponsiveContext';

// Navigation
import AppNavigator from './navigation/AppNavigator';

// Components
import ErrorBoundary from './components/ErrorBoundary';
import SplashScreen from './screens/SplashScreen';

import { validateNetworkConfig } from './utils/bitcoin';
import { NETWORK_DISPLAY_NAME } from './utils/constants';
import { logger } from './utils/logger';
import { useWalletInitialization } from './hooks/useWalletInitialization';
import { COLORS } from './theme';

if (__DEV__) {
  LogBox.ignoreAllLogs();
}

// Keep the native splash screen visible until we explicitly hide it.
// If this races with Expo internals, log and continue rather than crashing startup.
ExpoSplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  logger.warn('[App] Failed to prevent native splash auto-hide', {
    error: error instanceof Error ? error.message : String(error),
  });
  startupDiagnostics.recordWarning('prevent_auto_hide_failed', {
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
  startupDiagnostics.recordFailure('crypto_library_init_failed', {
    error: error instanceof Error ? error.message : String(error),
  });
}

// CRITICAL: Validate network configuration at startup
try {
  validateNetworkConfig();
  logger.info(`Network validation passed: App is correctly configured for ${NETWORK_DISPLAY_NAME}`);
} catch (error: unknown) {
  logger.error('CRITICAL NETWORK ERROR', {
    error: error instanceof Error ? error.message : String(error),
  });
  startupDiagnostics.recordFailure('network_config_validation_failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  throw error; // Fail fast - do not allow app to start with wrong network
}

// Global unhandled error handler for production
if (!__DEV__) {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    logger.error('[App] Unhandled error', { error: error?.message, isFatal });
    startupDiagnostics.recordFailure('unhandled_js_error', {
      error: error?.message ?? 'unknown',
      is_fatal: isFatal,
    });
    defaultHandler(error, isFatal);
  });
}

// Inner component to access wallet and notification contexts
function AppProviders({ children }: { children: React.ReactNode }) {
  const { wallet, currentAccount } = useWallet();
  const startAutoRefresh = usePriceStore((state) => state.startAutoRefresh);
  const loadFromStorage = usePendingTransactionsStore((state) => state.loadFromStorage);
  const loadPendingVaultFromStorage = usePendingVaultTransactionStore(
    (state) => state.loadFromStorage
  );

  // Start BTC price auto-refresh on mount
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      cleanup = startAutoRefresh();
    });

    return () => {
      task.cancel();
      cleanup?.();
    };
  }, [startAutoRefresh]);

  // Load pending transactions from storage when account changes
  useEffect(() => {
    if (wallet && currentAccount !== undefined && currentAccount !== null) {
      const task = InteractionManager.runAfterInteractions(() => {
        void Promise.all([
          loadFromStorage(currentAccount),
          loadPendingVaultFromStorage(currentAccount),
        ]);
      });

      return () => task.cancel();
    }

    return undefined;
  }, [wallet, currentAccount, loadFromStorage, loadPendingVaultFromStorage]);

  useEffect(() => {
    if (!wallet) {
      return undefined;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      void recoverPendingLiquidationSwapBroadcasts().catch((error: unknown) => {
        logger.warn('[App] Liquidation swap broadcast recovery failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

    return () => task.cancel();
  }, [wallet]);

  return (
    <CashuProvider>
      <WalletDataProvider>{children}</WalletDataProvider>
    </CashuProvider>
  );
}

function InitializationErrorScreen({
  initializationError,
  retryInitialization,
}: {
  initializationError: string;
  retryInitialization: () => Promise<void>;
}) {
  return (
    <View style={localStyles.errorContainer}>
      <Text style={localStyles.errorTitle}>Unable To Access Wallet</Text>
      <Text style={localStyles.errorMessage}>
        The app could not read wallet data securely. Retry before creating or importing a new
        wallet.
      </Text>
      <Text style={localStyles.errorDetails}>{initializationError}</Text>
      <TouchableOpacity
        style={localStyles.retryButton}
        onPress={() => {
          retryInitialization();
        }}
      >
        <Text style={localStyles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function AppInitializationGate({ children }: { children: React.ReactNode }) {
  const { wallet, loadWallet } = useWallet();
  const { loadBiometricPreference, setIsAuthenticated } = useAuthSession();
  const { setSeedConfirmed } = useOnboardingFlow();
  const walletExistsRef = useRef(!!wallet);

  useEffect(() => {
    walletExistsRef.current = !!wallet;
  }, [wallet]);

  const { isLoading, initializationError, retryInitialization } = useWalletInitialization({
    loadWallet,
    loadBiometricPreference,
    setSeedConfirmed,
    setIsAuthenticated,
    walletExistsRef,
  });

  if (isLoading) {
    return <SplashScreen mode="launch" />;
  }

  if (initializationError) {
    return (
      <InitializationErrorScreen
        initializationError={initializationError}
        retryInitialization={retryInitialization}
      />
    );
  }

  return <AppProviders>{children}</AppProviders>;
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
    if (!__DEV__) return undefined;

    if (typeof Linking.addEventListener !== 'function') return undefined;

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url?.startsWith(E2E_RESET_SETTINGS_URL_PREFIX)) {
        void resetNonSecretE2ESettings();
      }
    });

    return () => subscription?.remove?.();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      startupDiagnostics.recordCheckpoint('fonts_loaded', {
        elapsed_ms: Date.now() - startupT0,
        timed_out: false,
      });
      return;
    }
    const timer = setTimeout(() => {
      logger.warn('[App] Font loading timed out, proceeding without custom fonts');
      startupDiagnostics.recordWarning('font_load_timed_out', {
        elapsed_ms: Date.now() - startupT0,
        timeout_ms: FONT_LOAD_TIMEOUT_MS,
      });
      startupDiagnostics.recordCheckpoint('fonts_loaded', {
        elapsed_ms: Date.now() - startupT0,
        timed_out: true,
      });
      setFontTimedOut(true);
    }, FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  // Analytics: set super properties and track app open on mount
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
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
    });

    return () => task.cancel();
  }, []);

  const appReady = fontsLoaded || fontTimedOut;

  // Hide native splash once app is ready — useEffect ensures it fires after render
  useEffect(() => {
    if (appReady) {
      startupDiagnostics.recordCheckpoint(
        'app_ready',
        {
          elapsed_ms: Date.now() - startupT0,
        },
        { flush: true }
      );
      ExpoSplashScreen.hideAsync();
    }
  }, [appReady]);

  // Safety watchdog: if appReady never fires (e.g. font loading stalls),
  // force-hide the native splash after 8s so the app never gets stuck.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!appReady) {
        logger.warn('[App] Safety watchdog: forcing native splash hide after 8s');
        startupDiagnostics.recordWarning('splash_watchdog_fired', {
          elapsed_ms: Date.now() - startupT0,
        });
        ExpoSplashScreen.hideAsync();
      }
    }, 8000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#111015' }}>
      <ErrorBoundary
        boundaryName="App"
        fallbackMessage="A critical error occurred. Please restart the app."
      >
        <AuthProvider>
          <ResponsiveProvider>
            <WalletProvider>
              <AppInitializationGate>
                <AppNavigator />
              </AppInitializationGate>
            </WalletProvider>
          </ResponsiveProvider>
        </AuthProvider>
      </ErrorBoundary>
    </View>
  );
}

const localStyles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 28,
    fontFamily: 'CabinetGrotesk-Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    color: COLORS.LIGHT_GRAY,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorDetails: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
});
