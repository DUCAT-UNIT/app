/**
 * Turbo Linking Configuration
 * Deep link handling for Cashu token URLs
 */

import { Linking, AppState } from 'react-native';
import { logger } from '../../utils/logger';
import { hashToken, initializeTokenStorage } from './turboTokenStorage';

/**
 * Extract token from ducat://turbo/{base64} URL format
 */
const extractTokenFromDucatUrl = (url) => {
  const turboMatch = url.match(/ducat:\/\/turbo\/([^/?#]+)/);
  if (turboMatch && turboMatch[1]) {
    return turboMatch[1]; // Already in cashuA... format
  }
  return null;
};

/**
 * Extract and decode token from URL parameter
 * Handles: ?t=base64urlsafe format
 */
const extractTokenFromParam = (url) => {
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
  } catch (error) {
    logger.error('[TURBO] Failed to decode base64 token:', { message: error.message });
    return null;
  }
};

/**
 * Process URL and store token if valid and not duplicate
 */
const processUrlAndStoreToken = async (url) => {
  if (!url) return;

  logger.cashu('p2pk_url_received', {
    step: 'ENTRY_POINT',
    urlLength: url?.length,
    urlPreview: url?.substring(0, 50) + '...',
  });

  let token = null;

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

  logger.cashu('p2pk_token_extracted', {
    step: 'ENTRY_POINT',
    tokenLength: token?.length,
    tokenPrefix: token?.substring(0, 20) + '...',
    isCashuToken: token?.startsWith('cashu'),
  });

  // Check for duplicates
  if (typeof global !== 'undefined') {
    // Wait for processed tokens to load from storage if still loading
    if (global.processedCashuTokensLoading) {
      logger.cashu('p2pk_waiting_storage', { step: 'ENTRY_POINT', reason: 'Waiting for processed tokens to load' });
      let attempts = 0;
      while (global.processedCashuTokensLoading && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      logger.cashu('p2pk_storage_ready', { step: 'ENTRY_POINT', attempts });
    }

    const tokenHash = await hashToken(token);
    const isAlreadyProcessed = global.processedCashuTokens && global.processedCashuTokens.has(tokenHash);
    const skipDuplicateCheck = global.turboJustResumed === true;

    logger.cashu('p2pk_duplicate_check', {
      step: 'ENTRY_POINT',
      tokenHashPrefix: tokenHash?.substring(0, 16),
      isAlreadyProcessed,
      skipDuplicateCheck,
      processedTokensCount: global.processedCashuTokens?.size || 0,
    });

    if (skipDuplicateCheck) {
      logger.cashu('p2pk_bypass_duplicate', { step: 'ENTRY_POINT', reason: 'App just resumed' });
    } else if (isAlreadyProcessed) {
      logger.cashu('p2pk_duplicate_rejected', { step: 'ENTRY_POINT', reason: 'Token already processed' });
      global.pendingTurboSnackbars = [{
        type: 'error',
        action: 'claim',
        description: 'Token already claimed',
      }];
      return;
    }

    logger.cashu('p2pk_token_queued', {
      step: 'ENTRY_POINT',
      tokenLength: token?.length,
      message: 'Token stored in global.pendingCashuToken for processing',
    });
    global.pendingCashuToken = token;
  }
};

/**
 * Handle URL event (app is open, deeplink tapped)
 */
const onReceiveURL = async (event) => {
  const url = event?.url;
  logger.debug('[TURBO] URL event received:', url?.substring(0, 100));

  // Process Turbo URLs
  if (url && (url.includes('ducat://turbo/') || url.includes('unit?'))) {
    await processUrlAndStoreToken(url);
  }
};

/**
 * Handle app state changes for background->foreground URL processing
 */
const createAppStateHandler = () => {
  let appState = AppState.currentState;

  return (nextAppState) => {
    logger.debug('[TURBO] AppState change:', appState, '->', nextAppState);

    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      logger.debug('[TURBO] App became active - setting resume flag');

      if (typeof global !== 'undefined') {
        global.turboJustResumed = true;

        setTimeout(() => {
          global.turboJustResumed = false;
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
export const createLinkingConfig = () => ({
  prefixes: ['ducat://', 'https://ducatprotocol.com', 'https://www.ducatprotocol.com'],
  config: {
    screens: {
      Main: {
        screens: {
          Wallet: {
            path: 'wallet',
          },
        },
      },
      NotFound: '*',
    },
  },

  subscribe(_listener) {
    // Initialize processed tokens storage
    initializeTokenStorage();

    // Listen for URL events
    logger.debug('[TURBO] Registering URL listener');
    Linking.addEventListener('url', onReceiveURL);

    // Handle app state changes
    const handleAppStateChange = createAppStateHandler();
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateSubscription.remove();
      logger.debug('[TURBO] Removed AppState listener');
    };
  },

  async getStateFromPath(path, _options) {
    logger.debug('[TURBO] getStateFromPath:', path?.substring(0, 100));

    // Check for Turbo token URLs
    const isTurboUrl = path && (
      path.includes('ducat://turbo/') ||
      (path.includes('unit?') && path.includes('t='))
    );

    if (isTurboUrl) {
      logger.debug('[TURBO] Processing token URL');
      await processUrlAndStoreToken(path);
      return null; // Prevent navigation
    }

    return undefined; // Use default behavior
  },
});
