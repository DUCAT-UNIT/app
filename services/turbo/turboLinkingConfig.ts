/**
 * Turbo Linking Configuration
 * Deep link handling for Cashu token URLs
 */

import { Linking, AppState, NativeEventSubscription, AppStateStatus } from 'react-native';
import { getStateFromPath as getDefaultStateFromPath } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { logger } from '../../utils/logger';
import {
  E2E_ENABLE_USDC_URL_PREFIX,
  E2E_RESET_SETTINGS_URL_PREFIX,
  enableUsdcFeaturesForE2E,
  resetNonSecretE2ESettings,
} from '../e2eSettingsResetService';
import { hashToken, initializeTokenStorage, turboGlobal } from './turboTokenStorage';
import type { RootNavigatorParamList } from '../../navigation/types';

interface URLEvent {
  url: string;
}

/**
 * Extract token from ducat://turbo/{base64} URL format
 */
const extractTokenFromDucatUrl = (url: string): string | null => {
  const turboMatch = url.match(/ducat:\/\/turbo\/([^/?#]+)/);
  if (turboMatch && turboMatch[1]) {
    return turboMatch[1];
  }
  return null;
};

const isSupportedCashuToken = (token: string): boolean => /^cashuB/i.test(token);

/**
 * Extract and decode token from URL parameter
 * Handles: ?t=base64urlsafe format
 */
const extractTokenFromParam = (url: string): string | null => {
  const tokenMatch = url.match(/[?&]t=([^&]+)/);
  if (!tokenMatch || !tokenMatch[1]) {
    return null;
  }

  let base64Token = tokenMatch[1];

  try {
    // Convert URL-safe base64 back to standard base64
    base64Token = base64Token.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    while (base64Token.length % 4) {
      base64Token += '=';
    }

    // Decode base64 to get cashu token
    return atob(base64Token);
  } catch (error: unknown) {
    logger.error('[TURBO] Failed to decode base64 token:', { message: (error as Error).message });
    return null;
  }
};

const isE2EControlUrl = (url: string): boolean => {
  return url.startsWith('ducat://e2e/');
};

const processE2EControlUrl = async (url: string): Promise<void> => {
  if (!isE2EControlUrl(url)) return;

  if (url.startsWith(E2E_RESET_SETTINGS_URL_PREFIX)) {
    await resetNonSecretE2ESettings();
    return;
  }

  if (url.startsWith(E2E_ENABLE_USDC_URL_PREFIX)) {
    await enableUsdcFeaturesForE2E(url);
  }
};

/**
 * Process URL and store token if valid and not duplicate
 */
const processUrlAndStoreToken = async (url: string): Promise<void> => {
  if (!url) return;

  logger.cashu('p2pk_url_received', {
    step: 'ENTRY_POINT',
    urlLength: url?.length,
    urlPreview: url?.substring(0, 50) + '...',
  });

  let token: string | null = null;

  // Check for ducat://turbo/ format
  token = extractTokenFromDucatUrl(url);

  // Check for direct token format: ?t=base64...
  if (!token) {
    token = extractTokenFromParam(url);
  }

  if (!token) {
    logger.cashu('p2pk_url_no_token', { step: 'ENTRY_POINT', reason: 'No token found in URL' });
    return;
  }

  if (!isSupportedCashuToken(token)) {
    logger.cashu('p2pk_url_unsupported_token', {
      step: 'ENTRY_POINT',
      tokenPrefix: token?.substring(0, 8),
      reason: 'Only cashuB tokens are supported',
    });
    return;
  }

  logger.cashu('p2pk_token_extracted', {
    step: 'ENTRY_POINT',
    tokenLength: token?.length,
    tokenPrefix: token?.substring(0, 20) + '...',
    isCashuToken: token?.startsWith('cashu'),
  });

  // Check for duplicates
  if (typeof global !== 'undefined') {
    // Wait for processed tokens to load from storage if still loading
    if (turboGlobal.processedCashuTokensLoading) {
      logger.cashu('p2pk_waiting_storage', { step: 'ENTRY_POINT', reason: 'Waiting for processed tokens to load' });
      let attempts = 0;
      while (turboGlobal.processedCashuTokensLoading && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      logger.cashu('p2pk_storage_ready', { step: 'ENTRY_POINT', attempts });
    }

    const tokenHash = await hashToken(token);
    const isAlreadyProcessed = turboGlobal.processedCashuTokens?.has(tokenHash) ?? false;
    const skipDuplicateCheck = turboGlobal.turboJustResumed === true;

    logger.cashu('p2pk_duplicate_check', {
      step: 'ENTRY_POINT',
      tokenHashPrefix: tokenHash?.substring(0, 16),
      isAlreadyProcessed,
      skipDuplicateCheck,
      processedTokensCount: turboGlobal.processedCashuTokens?.size ?? 0,
    });

    if (skipDuplicateCheck) {
      logger.cashu('p2pk_bypass_duplicate', { step: 'ENTRY_POINT', reason: 'App just resumed' });
    } else if (isAlreadyProcessed) {
      logger.cashu('p2pk_duplicate_rejected', { step: 'ENTRY_POINT', reason: 'Token already processed' });
      turboGlobal.pendingTurboSnackbars = [{
        type: 'error',
        message: 'Token already claimed',
      }];
      return;
    }

    logger.cashu('p2pk_token_queued', {
      step: 'ENTRY_POINT',
      tokenLength: token?.length,
      message: 'Token stored in global.pendingCashuToken for processing',
    });
    turboGlobal.pendingCashuToken = token;
  }
};

/**
 * Handle URL event (app is open, deeplink tapped)
 */
const onReceiveURL = async (
  event: URLEvent,
  listener?: (url: string) => void,
): Promise<void> => {
  const url = event?.url;
  logger.debug('[TURBO] URL event received:', { urlPreview: url?.substring(0, 100) });

  // Process Turbo URLs
  if (url && (url.includes('ducat://turbo/') || url.includes('unit?'))) {
    await processUrlAndStoreToken(url);
    return;
  }

  if (url && isE2EControlUrl(url)) {
    await processE2EControlUrl(url);
    return;
  }

  if (url && listener) {
    listener(url);
  }
};

/**
 * Handle app state changes for background->foreground URL processing
 */
const createAppStateHandler = () => {
  let appState = AppState.currentState;

  return (nextAppState: AppStateStatus) => {
    logger.debug('[TURBO] AppState change:', { from: appState, to: nextAppState });

    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      logger.debug('[TURBO] App became active - setting resume flag');

      if (typeof global !== 'undefined') {
        turboGlobal.turboJustResumed = true;

        setTimeout(() => {
          turboGlobal.turboJustResumed = false;
          logger.debug('[TURBO] Cleared resume flag');
        }, 2000);
      }
    }

    appState = nextAppState;
  };
};

/**
 * Linking configuration for React Navigation
 */
const linkingConfig: LinkingOptions<RootNavigatorParamList>['config'] = {
  screens: {
    VaultSuccessPreview: 'preview/vault-success',
    Main: {
      screens: {
        WalletTab: {
          screens: {
            WalletHome: 'wallet',
          },
        },
      },
    },
  },
};

export const createLinkingConfig = (): LinkingOptions<RootNavigatorParamList> => ({
  prefixes: ['ducat://', 'https://ducatprotocol.com', 'https://www.ducatprotocol.com'],
  config: linkingConfig,

  subscribe(listener) {
    // Initialize processed tokens storage
    initializeTokenStorage();

    // Check for initial URL (cold start from deep link)
    logger.debug('[TURBO] Checking for initial URL');
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        logger.debug('[TURBO] Initial URL found:', { urlPreview: initialUrl?.substring(0, 100) });
        if (initialUrl.includes('ducat://turbo/') || initialUrl.includes('unit?')) {
          processUrlAndStoreToken(initialUrl).catch((error) => {
            logger.error('[TURBO] Failed to process initial URL:', { error: error instanceof Error ? error.message : String(error) });
          });
        } else if (isE2EControlUrl(initialUrl)) {
          processE2EControlUrl(initialUrl).catch((error) => {
            logger.error('[TURBO] Failed to process E2E control URL:', { error: error instanceof Error ? error.message : String(error) });
          });
          return;
        } else {
          listener(initialUrl);
        }
      } else {
        logger.debug('[TURBO] No initial URL');
      }
    }).catch((error) => {
      logger.error('[TURBO] Failed to get initial URL:', { error: error instanceof Error ? error.message : String(error) });
    });

    // Listen for URL events (app already open)
    logger.debug('[TURBO] Registering URL listener');
    const urlSubscription = Linking.addEventListener('url', (event) => {
      void onReceiveURL(event, listener);
    });

    // Handle app state changes
    const handleAppStateChange = createAppStateHandler();
    const appStateSubscription: NativeEventSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      urlSubscription.remove();
      appStateSubscription.remove();
      logger.debug('[TURBO] Removed URL and AppState listeners');
    };
  },

  getStateFromPath(path: string, _options: unknown) {
    logger.debug('[TURBO] getStateFromPath:', { pathPreview: path?.substring(0, 100) });

    if (!path) {
      return undefined;
    }

    // Check for Turbo token URLs
    const isTurboUrl = (
      path.includes('ducat://turbo/') ||
      (path.includes('unit?') && path.includes('t='))
    );

    if (isTurboUrl) {
      logger.debug('[TURBO] Processing token URL');
      // Fire-and-forget async processing with error logging
      processUrlAndStoreToken(path).catch((error) => {
        logger.error('[TURBO] Failed to process URL token:', { error: error instanceof Error ? error.message : String(error) });
      });
      return undefined; // Return undefined to prevent navigation, let async processing handle token
    }

    if (isE2EControlUrl(path)) {
      processE2EControlUrl(path).catch((error) => {
        logger.error('[TURBO] Failed to process E2E control path:', { error: error instanceof Error ? error.message : String(error) });
      });
      return undefined;
    }

    return getDefaultStateFromPath(path, linkingConfig);
  },
});
