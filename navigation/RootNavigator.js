/**
 * RootNavigator - Top-level navigation structure
 * Switches between Auth flow and Main app based on authentication state
 */

import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import SendNavigator from './SendNavigator';
import PinSetupScreen from '../screens/auth/PinSetupScreen';
import PasskeyMigrationModal from '../components/PasskeyMigrationModal';
import MutinynetBanner from '../components/MutinynetBanner';
import { COLORS } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useBalance } from '../contexts/WalletDataContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useNotifications } from "../contexts/NotificationContext";
import { useNavigationState } from '../hooks/useNavigationState';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { useOnboardingFlow } from '../contexts/AuthContext';
import { useCashu } from '../contexts/CashuContext';
import { Alert, Linking, AppState } from 'react-native';
import { decodeCashuToken } from '../utils/emojiEncoder';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const Stack = createStackNavigator();

// Storage key for processed tokens
const PROCESSED_TOKENS_KEY = 'processed_cashu_tokens';
const MAX_STORED_TOKENS = 500; // Store up to 500 processed token hashes (hashes are small)

// Helper function to hash a token for storage
const hashToken = async (token) => {
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      token
    );
    return hash;
  } catch (error) {
    console.error('[TURBO] Failed to hash token:', error.message);
    // Fallback to storing first 64 chars if hashing fails
    return token.substring(0, 64);
  }
};

// Helper functions for persistent token tracking
const loadProcessedTokens = async () => {
  try {
    const stored = await SecureStore.getItemAsync(PROCESSED_TOKENS_KEY);
    if (stored) {
      const tokens = JSON.parse(stored);
      return new Set(tokens);
    }
  } catch (error) {
    console.error('[TURBO] Failed to load processed tokens:', error.message);
  }
  return new Set();
};

const saveProcessedTokens = async (tokensSet) => {
  try {
    // Convert Set to Array and limit size
    const tokensArray = Array.from(tokensSet).slice(-MAX_STORED_TOKENS);
    await SecureStore.setItemAsync(PROCESSED_TOKENS_KEY, JSON.stringify(tokensArray));
    console.log('[TURBO] Saved processed tokens to storage:', tokensArray.length);
  } catch (error) {
    console.error('[TURBO] Failed to save processed tokens:', error.message);
  }
};

// Linking configuration for deep links
const linking = {
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
      // These paths are handled by custom subscribe, not actual screens
      // Just defining them so React Navigation doesn't throw errors
      // Add a NotFound screen to catch unmatched paths
      NotFound: '*',
    },
  },
  // Subscribe to URL changes
  subscribe(listener) {
    // Initialize processed tokens set from persistent storage
    if (typeof global !== 'undefined' && !global.processedCashuTokens) {
      global.processedCashuTokensLoading = true;

      // Load from storage asynchronously
      loadProcessedTokens().then(tokensSet => {
        global.processedCashuTokens = tokensSet;
        global.processedCashuTokensLoading = false;
        console.log('[TURBO] Loaded processed tokens from storage:', tokensSet.size);
      }).catch(error => {
        console.error('[TURBO] Failed to load processed tokens, starting fresh:', error.message);
        global.processedCashuTokens = new Set();
        global.processedCashuTokensLoading = false;
      });
    }

    // NOTE: extractAndStoreToken is NO LONGER USED in subscribe()
    // All token extraction is now handled in getStateFromPath()
    // Keeping the function definition here would be dead code
    const extractAndStoreToken = async (url) => {
      if (url && (url.includes('receive?token=') || url.includes('turbo?token='))) {
        console.log('[TURBO] Received deeplink:', url.substring(0, 50) + '...');

        // Extract token parameter from URL
        const tokenMatch = url.match(/[?&]token=([^&]+)/);
        if (tokenMatch && tokenMatch[1]) {
          let token = decodeURIComponent(tokenMatch[1]);

          // If this is a turbo link, the token is emoji-encoded
          if (url.includes('turbo?token=')) {
            try {
              token = decodeCashuToken(token);
              console.log('[TURBO] Decoded emoji token');
            } catch (error) {
              console.error('[TURBO] Failed to decode:', error.message);
              return;
            }
          }

          if (typeof global !== 'undefined') {
            // Wait for processed tokens to load from storage if still loading
            if (global.processedCashuTokensLoading) {
              console.log('[TURBO] Waiting for processed tokens to load from storage...');
              // Retry after storage loads
              setTimeout(() => extractAndStoreToken(url), 100);
              return;
            }

            // Hash the token for duplicate checking
            const tokenHash = await hashToken(token);

            // Check if this token has already been processed or is currently pending
            const isAlreadyProcessed = global.processedCashuTokens && global.processedCashuTokens.has(tokenHash);
            const isCurrentlyPending = global.pendingCashuToken === token;

            if (isAlreadyProcessed) {
              console.log('[TURBO] Ignoring duplicate deeplink - token already processed (hash:', tokenHash.substring(0, 16) + '...)');
              return;
            }

            if (isCurrentlyPending) {
              console.log('[TURBO] Ignoring duplicate deeplink - same token already pending');
              return;
            }

            // Store new token
            global.pendingCashuToken = token;
            console.log('[TURBO] Stored NEW token, hash:', tokenHash.substring(0, 16) + '...');

            // Immediately trigger check if function is available (app is open)
            if (typeof global.triggerPendingTokenCheck === 'function') {
              setTimeout(() => global.triggerPendingTokenCheck(), 100);
            }
          }
        }
      }
    };

    // Listen for URL events - IMPORTANT: This WILL fire on iOS when coming from background!
    const onReceiveURL = async (event) => {
      const url = event?.url;
      console.log('[TURBO] ========================================');
      console.log('[TURBO] *** URL EVENT FIRED ***');
      console.log('[TURBO] Full URL:', url);
      console.log('[TURBO] URL length:', url?.length);
      console.log('[TURBO] URL first 100 chars:', url ? url.substring(0, 100) : 'null');
      console.log('[TURBO] ========================================');

      // Process Turbo URLs: ducat://turbo/{base64} OR ducat://spectre/{base64} (legacy) OR https://ducatprotocol.com/unit?id=xyz123 OR https://ducatprotocol.com/unit?t=base64...
      if (url && (url.includes('ducat://turbo/') || url.includes('ducat://spectre/') || url.includes('unit?'))) {
        console.log('[TURBO] URL event contains Turbo URL - processing NOW');

        let token = null;

        // Check if this is the ducat://turbo/ or ducat://spectre/ (legacy) format
        const turboMatch = url.match(/ducat:\/\/(?:turbo|spectre)\/([^\/?#]+)/);
        if (turboMatch && turboMatch[1]) {
          // The token is already in the correct format (cashuA...)
          // No need to decode - just use it directly
          token = turboMatch[1];
          console.log('[TURBO] Extracted Cashu token from ducat:// URL, length:', token.length);
          console.log('[TURBO] Token starts with:', token.substring(0, 20));
        }
        // Check if this is an ID-based link (token stored in Rebrandly)
        else {
          const idMatch = url.match(/[?&]id=([^&]+)/);
          if (idMatch && idMatch[1]) {
            const tokenId = idMatch[1];
            console.log('[TURBO] URL contains Rebrandly token ID:', tokenId);

            try {
              const { fetchTokenFromRebrandly } = await import('../services/urlShortener');
              token = await fetchTokenFromRebrandly(tokenId);

              if (!token) {
                console.error('[TURBO] Failed to fetch token from Rebrandly');
                return;
              }

              console.log('[TURBO] URL event: Fetched token from Rebrandly');
              console.log('[TURBO] Token starts with:', token.substring(0, 20));
            } catch (error) {
              console.error('[TURBO] URL event: Failed to fetch token from Rebrandly:', error.message);
              return;
            }
          }
          // Check if this is a direct token link (fallback)
          else {
            const tokenMatch = url.match(/[?&]t=([^&]+)/);
            if (!tokenMatch || !tokenMatch[1]) {
              console.error('[TURBO] URL event: No token or ID parameter found in URL');
              return;
            }

            let base64Token = tokenMatch[1];
            console.log('[TURBO] Extracted URL-safe base64 token, length:', base64Token.length);

            try {
              // Convert URL-safe base64 back to standard base64
              base64Token = base64Token
                .replace(/-/g, '+')
                .replace(/_/g, '/');

              // Add padding if needed
              while (base64Token.length % 4) {
                base64Token += '=';
              }

              // Decode base64 to get cashu token
              token = atob(base64Token);
              console.log('[TURBO] URL event: Decoded base64 to cashu token');
              console.log('[TURBO] Decoded token starts with:', token.substring(0, 20));
            } catch (error) {
              console.error('[TURBO] URL event: Failed to decode base64 token:', error.message);
              return;
            }
          }
        }

        if (!token) {
          console.error('[TURBO] URL event: No token extracted');
          return;
        }

        try {

          // Hash and check for duplicates
          const tokenHash = await hashToken(token);
          const isAlreadyProcessed = global.processedCashuTokens && global.processedCashuTokens.has(tokenHash);

          // CRITICAL FIX: If we just resumed from background, SKIP duplicate check
          // This allows NEW deeplinks to be processed when app comes from background
          const skipDuplicateCheck = global.turboJustResumed === true;

          if (skipDuplicateCheck) {
            console.log('[TURBO] URL event: App just resumed - BYPASSING duplicate check for this token');
            console.log('[TURBO] URL event: Token hash:', tokenHash.substring(0, 16) + '...');
          } else if (isAlreadyProcessed) {
            console.log('[TURBO] URL event: SKIPPING - token already processed (hash:', tokenHash.substring(0, 16) + '...)');
            // Replace queue with only this snackbar (don't stack multiple)
            global.pendingTurboSnackbars = [{
              type: 'error',
              action: 'claim',
              description: 'Token already claimed',
            }];
            return;
          }

          // Store token for processing (if NOT already processed OR we just resumed)
          console.log('[TURBO] URL event: Storing token, hash:', tokenHash.substring(0, 16) + '...');
          console.log('[TURBO] URL event: skipDuplicateCheck:', skipDuplicateCheck, 'isAlreadyProcessed:', isAlreadyProcessed);
          if (typeof global !== 'undefined') {
            global.pendingCashuToken = token;

            // Trigger check immediately
            if (typeof global.triggerPendingTokenCheck === 'function') {
              setTimeout(() => global.triggerPendingTokenCheck(), 100);
            }
          }
        } catch (error) {
          console.error('[TURBO] URL event: Failed to decode base64 token:', error.message);
          return;
        }
      }
    };

    // REMOVED: getInitialURL() processing - it's now handled by getStateFromPath
    // getInitialURL() always returns the same URL (the one that launched the app)
    // and it was interfering with new deeplinks being processed by getStateFromPath
    console.log('[TURBO] Skipping getInitialURL - all URL handling is done via getStateFromPath');

    // Add event listener for URL changes (app is already open and deeplink is tapped)
    console.log('[TURBO] About to register Linking.addEventListener...');
    const subscription = Linking.addEventListener('url', onReceiveURL);
    console.log('[TURBO] Linking.addEventListener registered, subscription:', !!subscription);

    // WORKAROUND for iOS issue where url event doesn't fire when app is in background
    // Listen to AppState changes and check for pending URLs
    let appState = AppState.currentState;
    console.log('[TURBO] Initial AppState:', appState);

    // Track if we're coming from background - this is CRITICAL for iOS deeplink handling
    let lastUrl = null;

    const handleAppStateChange = async (nextAppState) => {
      console.log('[TURBO] AppState change:', appState, '->', nextAppState);

      // When app comes to foreground, force a fresh URL check
      // iOS caches the path in React Navigation, so we need to bypass that cache
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[TURBO] App became active from background - forcing fresh URL check');

        // Set a flag that tells getStateFromPath to NOT skip processing
        // This ensures NEW deeplinks are processed even if they look like duplicates
        if (typeof global !== 'undefined') {
          global.turboJustResumed = true;
          console.log('[TURBO] Set turboJustResumed flag to force fresh processing');

          // Clear the flag after a short delay
          setTimeout(() => {
            global.turboJustResumed = false;
            console.log('[TURBO] Cleared turboJustResumed flag');
          }, 2000);
        }
      }

      appState = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    console.log('[TURBO] Registered AppState listener for URL handling');

    return () => {
      console.log('[TURBO] Linking subscribe cleanup called');
      // DO NOT remove subscription - we need it to persist across app state changes
      // Only remove the AppState listener
      appStateSubscription.remove();
      console.log('[TURBO] Removed AppState listener, but kept URL listener active');
    };
  },
  // Custom function to intercept and handle special URLs before navigation
  async getStateFromPath(path, options) {
    console.log('[TURBO] getStateFromPath called');
    console.log('[TURBO] Full path:', path);
    console.log('[TURBO] Path length:', path?.length);
    console.log('[TURBO] Path first 100 chars:', path ? path.substring(0, 100) : 'null');

    // Check if this is a Turbo token URL: ducat://turbo/{base64} OR ducat://spectre/{base64} (legacy) OR https://ducatprotocol.com/unit?t=base64...
    if (path && (path.includes('ducat://turbo/') || path.includes('ducat://spectre/') || (path.includes('unit?') && path.includes('t=')))) {
      console.log('[TURBO] getStateFromPath detected token URL, processing...');

      let token = null;

      // Check if this is the ducat://turbo/ or ducat://spectre/ (legacy) format
      const turboMatch = path.match(/ducat:\/\/(?:turbo|spectre)\/([^\/?#]+)/);
      if (turboMatch && turboMatch[1]) {
        let base64Token = turboMatch[1];
        console.log('[TURBO] Extracted base64 token from ducat:// URL, length:', base64Token.length);

        try {
          // Convert URL-safe base64 back to standard base64
          base64Token = base64Token
            .replace(/-/g, '+')
            .replace(/_/g, '/');

          // Add padding if needed
          while (base64Token.length % 4) {
            base64Token += '=';
          }

          // Decode base64 to get cashu token
          token = atob(base64Token);
          console.log('[TURBO] getStateFromPath: Decoded base64 to cashu token');
          console.log('[TURBO] Decoded token starts with:', token.substring(0, 20));
        } catch (error) {
          console.error('[TURBO] getStateFromPath: Failed to decode base64 token:', error.message);
          return null;
        }
      }
      // Fallback to old format: https://ducatprotocol.com/unit?t=base64...
      else {
        const tokenMatch = path.match(/[?&]t=([^&]+)/);
        if (!tokenMatch || !tokenMatch[1]) {
          console.error('[TURBO] getStateFromPath: No token parameter found in URL');
          return null;
        }

        let base64Token = tokenMatch[1];
        console.log('[TURBO] Extracted URL-safe base64 token, length:', base64Token.length);

        try {
          // Convert URL-safe base64 back to standard base64
          base64Token = base64Token
            .replace(/-/g, '+')
            .replace(/_/g, '/');

          // Add padding if needed
          while (base64Token.length % 4) {
            base64Token += '=';
          }

          // Decode base64 to get cashu token
          token = atob(base64Token);
          console.log('[TURBO] getStateFromPath: Decoded base64 to cashu token');
          console.log('[TURBO] Decoded token starts with:', token.substring(0, 20));
        } catch (error) {
          console.error('[TURBO] getStateFromPath: Failed to decode base64 token:', error.message);
          return null;
        }
      }

      if (token) {

        // CRITICAL: Check if this token has already been processed
        // Wait for storage to load if needed
        if (typeof global !== 'undefined' && global.processedCashuTokensLoading) {
          console.log('[TURBO] getStateFromPath: Waiting for processed tokens to load...');
          // Wait up to 1 second for storage to load
          let attempts = 0;
          while (global.processedCashuTokensLoading && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
        }

        // Hash and check if already processed
        const tokenHash = await hashToken(token);
        const isAlreadyProcessed = global.processedCashuTokens && global.processedCashuTokens.has(tokenHash);

        // CRITICAL FIX: If we just resumed from background, SKIP duplicate check
        // This allows NEW deeplinks to be processed when app comes from background
        const skipDuplicateCheck = global.turboJustResumed === true;

        if (skipDuplicateCheck) {
          console.log('[TURBO] getStateFromPath: App just resumed - BYPASSING duplicate check for this token');
          console.log('[TURBO] getStateFromPath: Token hash:', tokenHash.substring(0, 16) + '...');
        } else if (isAlreadyProcessed) {
          console.log('[TURBO] getStateFromPath: SKIPPING - token already processed (hash:', tokenHash.substring(0, 16) + '...)');
          return null;
        }

        // Store in global for processing (if NOT already processed OR we just resumed)
        if (typeof global !== 'undefined') {
          console.log('[TURBO] getStateFromPath: Storing token in global.pendingCashuToken, hash:', tokenHash.substring(0, 16) + '...');
          console.log('[TURBO] getStateFromPath: skipDuplicateCheck:', skipDuplicateCheck, 'isAlreadyProcessed:', isAlreadyProcessed);
          global.pendingCashuToken = token;

          // Trigger check immediately if function is available
          if (typeof global.triggerPendingTokenCheck === 'function') {
            setTimeout(() => global.triggerPendingTokenCheck(), 100);
          }
        }
      }

      // Return null to prevent navigation
      return null;
    }

    // For other paths, use default behavior
    return undefined;
  },
};

export default function RootNavigator() {
  // Determine navigation state
  const { shouldShowAuth, shouldShowPinOverlay } = useNavigationState();

  // Get auth-specific data needed for PIN overlay
  const {
    isBiometricSupported,
    isAuthenticated,
    biometricEnabled,
    setIsAuthenticated,
    authenticateUser,
  } = useAuth();
  const { wallet } = useWallet();
  const { seedConfirmedRef } = useOnboardingFlow();
  const { fetchBalance } = useBalance();
  const { showToast, showSnackbar } = useNotifications();
  const { receive } = useCashu();

  // Token verification loading state
  const [isVerifyingToken, setIsVerifyingToken] = React.useState(false);
  const [pendingSuccessMessage, setPendingSuccessMessage] = React.useState(null);

  // Create wallet exists ref for useAppLifecycle
  const walletExists = React.useRef(false);
  React.useEffect(() => {
    walletExists.current = !!wallet;
  }, [wallet]);

  // Make showSnackbar available globally for URL event handlers
  // Poll for queued snackbars to ensure they get shown
  const lastShownSnackbarRef = React.useRef(null);
  const checkQueuedSnackbarsRef = React.useRef(null);

  React.useEffect(() => {
    const checkQueuedSnackbars = () => {
      // Show any queued snackbars
      if (global.pendingTurboSnackbars && global.pendingTurboSnackbars.length > 0) {
        // Show only the last one to avoid spamming
        const lastSnackbar = global.pendingTurboSnackbars[global.pendingTurboSnackbars.length - 1];

        // Check if this is the exact same snackbar we just showed
        const lastShown = lastShownSnackbarRef.current;
        const isDuplicate = lastShown &&
          lastShown.type === lastSnackbar.type &&
          lastShown.action === lastSnackbar.action &&
          lastShown.description === lastSnackbar.description;

        if (isDuplicate) {
          console.log('[TURBO] Skipping duplicate snackbar:', lastSnackbar.description);
        } else {
          console.log('[TURBO] Showing queued snackbar:', lastSnackbar.description);
          showSnackbar(lastSnackbar);
          lastShownSnackbarRef.current = lastSnackbar;
        }

        // Clear the queue either way
        global.pendingTurboSnackbars = [];
      }
    };

    // Store in ref for external access
    checkQueuedSnackbarsRef.current = checkQueuedSnackbars;

    // Check immediately
    checkQueuedSnackbars();

    // Poll every 500ms to catch newly queued snackbars
    const interval = setInterval(checkQueuedSnackbars, 500);

    global.showTurboSnackbar = showSnackbar;

    return () => {
      clearInterval(interval);
      delete global.showTurboSnackbar;
    };
  }, [showSnackbar]);

  // Show success snackbar when loading finishes
  React.useEffect(() => {
    if (!isVerifyingToken && pendingSuccessMessage) {
      console.log('[TURBO] Loading cleared, showing success snackbar');
      showSnackbar({
        type: 'success',
        action: 'claim',
        description: pendingSuccessMessage,
      });
      setPendingSuccessMessage(null);
    }
  }, [isVerifyingToken, pendingSuccessMessage, showSnackbar]);

  // Check for pending token when authenticated - this runs after linking config stores token
  const checkPendingTokenRef = React.useRef(null); // Store function ref so it can be called externally

  React.useEffect(() => {
    const checkPendingToken = () => {
      // Debug logging
      if (global.pendingCashuToken) {
        console.log('[TURBO] checkPendingToken: hasPendingToken=true, isAuthenticated=', isAuthenticated, 'isVerifyingToken=', isVerifyingToken);
      }

      // Only process if authenticated, there's a pending token, and we're not already verifying
      if (isAuthenticated && global.pendingCashuToken && !isVerifyingToken) {
        const token = global.pendingCashuToken;

        console.log('[TURBO] Processing token:', token.substring(0, 30) + '...');

        // Clear immediately to prevent re-processing
        delete global.pendingCashuToken;

        // Process the token
        (async () => {
          // Hash the token and mark as processed (whether it succeeds or fails, we don't want to retry)
          if (global.processedCashuTokens) {
            const tokenHash = await hashToken(token);
            global.processedCashuTokens.add(tokenHash);
            console.log('[TURBO] Marked token as processed. Total processed:', global.processedCashuTokens.size);

            // Save to persistent storage asynchronously
            saveProcessedTokens(global.processedCashuTokens).catch(error => {
              console.error('[TURBO] Failed to persist processed tokens:', error.message);
            });
          }

          // Process the token with the mint
          try {
            setIsVerifyingToken(true);
            const result = await receive(token);

            // Format amount: keep 2 decimals
            const amountDisplay = (result.amount).toFixed(2);
            console.log('[TURBO] Success! Received:', amountDisplay, 'UNIT');

            // Set pending message - will show when loading clears
            setPendingSuccessMessage(`Successfully received ${amountDisplay} UNIT`);

            // Clear loading state - this will trigger the success snackbar
            setIsVerifyingToken(false);
          } catch (error) {
            console.error('[TURBO] Failed:', error.message);

            setIsVerifyingToken(false);

            // Check for specific error messages
            let errorMessage = error.message || 'Failed to receive token';
            if (errorMessage.includes('already spent') || errorMessage.includes('already been spent')) {
              errorMessage = 'Token already claimed';
            } else if (errorMessage.includes('P2PK verification failed')) {
              errorMessage = 'Failed to verify Turbo token signature';
            }

            // Replace queue with only this snackbar (don't stack multiple)
            global.pendingTurboSnackbars = [{
              type: 'error',
              action: 'claim',
              description: errorMessage,
            }];
          }
        })();
      }
    };

    // Store in ref so it can be called from linking subscribe
    checkPendingTokenRef.current = checkPendingToken;

    // Check immediately
    checkPendingToken();

    // Poll every 500ms to catch tokens that arrive while app is open
    const interval = setInterval(checkPendingToken, 500);

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, receive, isVerifyingToken]);

  // Expose checkPendingToken globally so linking config can trigger it
  React.useEffect(() => {
    if (checkPendingTokenRef.current) {
      global.triggerPendingTokenCheck = checkPendingTokenRef.current;
    }
    return () => {
      delete global.triggerPendingTokenCheck;
    };
  }, []);

  // Handle lock/unlock
  const handleLock = React.useCallback(() => {
    setIsAuthenticated(false);
  }, [setIsAuthenticated]);

  const handleAuthenticateUser = React.useCallback(async () => {
    await authenticateUser();
  }, [authenticateUser]);

  // Set up app lifecycle (inactivity timer, app state changes)
  const { resetInactivityTimer } = useAppLifecycle({
    isAuthenticated,
    walletExists,
    seedConfirmedRef,
    isBiometricSupported,
    biometricEnabled,
    onLock: handleLock,
    onAuthenticateUser: handleAuthenticateUser,
  });

  // Get handlers from context
  const {
    handlePinSetupCompleteWrapper,
    handlePinChangeCompleteWrapper,
    handleCancelPinChange,
    showPasskeyMigrationModal,
    passkeyMigrationData,
    hidePasskeyMigrationPrompt,
  } = useNavigationHandlers();

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponder={() => {
        // Reset inactivity timer on any touch
        if (isAuthenticated) {
          resetInactivityTimer();
        }
        return false; // Don't capture the touch, let it propagate
      }}
    >
      <NavigationContainer linking={linking}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: COLORS.DARK_BG },
            animationEnabled: false, // Disable animation for root-level switches
          }}
        >
          {shouldShowAuth ? (
            <Stack.Screen name="Auth" component={AuthStack} />
          ) : (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen
                name="SendFlow"
                component={SendNavigator}
                options={{
                  presentation: 'modal',
                  animationEnabled: true,
                }}
              />
            </>
          )}
        </Stack.Navigator>

      {/* PIN Change Overlay - shown on top of main app */}
      {shouldShowPinOverlay && (
        <View style={localStyles.pinOverlay}>
          <MutinynetBanner />
          <PinSetupScreen
            changingPin={true}
            isBiometricSupported={isBiometricSupported}
            onPinSetupComplete={handlePinSetupCompleteWrapper}
            onPinChangeComplete={handlePinChangeCompleteWrapper}
            onCancel={handleCancelPinChange}
            fetchBalance={fetchBalance}
            showToast={showToast}
          />
        </View>
      )}

      {/* Passkey Migration Modal - shown after wallet import */}
      {showPasskeyMigrationModal && passkeyMigrationData && (
        <PasskeyMigrationModal
          visible={showPasskeyMigrationModal}
          onClose={hidePasskeyMigrationPrompt}
          mnemonic={passkeyMigrationData.mnemonic}
          currentPin={passkeyMigrationData.pin}
          showToast={showToast}
        />
      )}

      {/* Token Verification Loading Overlay */}
      {isVerifyingToken && (
        <View style={localStyles.loadingOverlay}>
          <View style={localStyles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
            <Text style={localStyles.loadingText}>Claiming Turbo transaction</Text>
          </View>
        </View>
      )}
    </NavigationContainer>
    </View>
  );
}

const localStyles = StyleSheet.create({
  pinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1000,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 1.0)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#DDDDDD',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
  },
});
