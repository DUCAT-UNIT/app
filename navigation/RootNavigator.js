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
import { Alert, Linking } from 'react-native';
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
    console.error('[SPECTRE] Failed to hash token:', error.message);
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
    console.error('[SPECTRE] Failed to load processed tokens:', error.message);
  }
  return new Set();
};

const saveProcessedTokens = async (tokensSet) => {
  try {
    // Convert Set to Array and limit size
    const tokensArray = Array.from(tokensSet).slice(-MAX_STORED_TOKENS);
    await SecureStore.setItemAsync(PROCESSED_TOKENS_KEY, JSON.stringify(tokensArray));
    console.log('[SPECTRE] Saved processed tokens to storage:', tokensArray.length);
  } catch (error) {
    console.error('[SPECTRE] Failed to save processed tokens:', error.message);
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
        console.log('[SPECTRE] Loaded processed tokens from storage:', tokensSet.size);
      }).catch(error => {
        console.error('[SPECTRE] Failed to load processed tokens, starting fresh:', error.message);
        global.processedCashuTokens = new Set();
        global.processedCashuTokensLoading = false;
      });
    }

    // Helper to extract and store token
    const extractAndStoreToken = async (url) => {
      if (url && (url.includes('receive?token=') || url.includes('spectre?token='))) {
        console.log('[SPECTRE] Received deeplink:', url.substring(0, 50) + '...');

        // Extract token parameter from URL
        const tokenMatch = url.match(/[?&]token=([^&]+)/);
        if (tokenMatch && tokenMatch[1]) {
          let token = decodeURIComponent(tokenMatch[1]);

          // If this is a spectre link, the token is emoji-encoded
          if (url.includes('spectre?token=')) {
            try {
              token = decodeCashuToken(token);
              console.log('[SPECTRE] Decoded emoji token');
            } catch (error) {
              console.error('[SPECTRE] Failed to decode:', error.message);
              return;
            }
          }

          if (typeof global !== 'undefined') {
            // Wait for processed tokens to load from storage if still loading
            if (global.processedCashuTokensLoading) {
              console.log('[SPECTRE] Waiting for processed tokens to load from storage...');
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
              console.log('[SPECTRE] Ignoring duplicate deeplink - token already processed (hash:', tokenHash.substring(0, 16) + '...)');
              return;
            }

            if (isCurrentlyPending) {
              console.log('[SPECTRE] Ignoring duplicate deeplink - same token already pending');
              return;
            }

            // Store new token
            global.pendingCashuToken = token;
            console.log('[SPECTRE] Stored NEW token, hash:', tokenHash.substring(0, 16) + '...');

            // Immediately trigger check if function is available (app is open)
            if (typeof global.triggerPendingTokenCheck === 'function') {
              setTimeout(() => global.triggerPendingTokenCheck(), 100);
            }
          }
        }
      }
    };

    // Listen for URL events
    const onReceiveURL = (event) => {
      const url = event?.url;
      console.log('[SPECTRE] onReceiveURL fired, url:', url ? url.substring(0, 50) + '...' : 'null');
      if (!url) return;

      extractAndStoreToken(url);
      listener(url);
    };

    // Handle initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        extractAndStoreToken(url);
        listener(url);
      }
    }).catch(error => {
      console.error('[SPECTRE] Failed to get initial URL:', error);
    });

    // Add event listener
    const subscription = Linking.addEventListener('url', onReceiveURL);
    console.log('[SPECTRE] Linking.addEventListener registered for URL events');

    return () => {
      console.log('[SPECTRE] Linking subscribe cleanup - removing event listener');
      subscription.remove();
    };
  },
  // Custom function to intercept and handle special URLs before navigation
  async getStateFromPath(path, options) {
    // Check if this is a token receive URL (supports both /receive and /spectre)
    // Note: Token storage is handled by subscribe() to avoid duplicate processing
    if (path.includes('receive?token=') || path.includes('spectre?token=')) {
      // Return null to prevent navigation, subscribe() will handle the token
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
  const { showToast } = useNotifications();
  const { receive } = useCashu();

  // Token verification loading state
  const [isVerifyingToken, setIsVerifyingToken] = React.useState(false)

  // Create wallet exists ref for useAppLifecycle
  const walletExists = React.useRef(false);
  React.useEffect(() => {
    walletExists.current = !!wallet;
  }, [wallet]);

  // Check for pending token when authenticated - this runs after linking config stores token
  const checkPendingTokenRef = React.useRef(null); // Store function ref so it can be called externally

  React.useEffect(() => {
    const checkPendingToken = () => {
      // Only process if authenticated, there's a pending token, and we're not already verifying
      if (isAuthenticated && global.pendingCashuToken && !isVerifyingToken) {
        const token = global.pendingCashuToken;

        console.log('[SPECTRE] Processing token:', token.substring(0, 30) + '...');

        // Clear immediately to prevent re-processing
        delete global.pendingCashuToken;

        // Process the token
        (async () => {
          // Hash the token and mark as processed (whether it succeeds or fails, we don't want to retry)
          if (global.processedCashuTokens) {
            const tokenHash = await hashToken(token);
            global.processedCashuTokens.add(tokenHash);
            console.log('[SPECTRE] Marked token as processed. Total processed:', global.processedCashuTokens.size);

            // Save to persistent storage asynchronously
            saveProcessedTokens(global.processedCashuTokens).catch(error => {
              console.error('[SPECTRE] Failed to persist processed tokens:', error.message);
            });
          }

          // Process the token with the mint
          try {
            setIsVerifyingToken(true);
            const result = await receive(token);

            setIsVerifyingToken(false);

            // Format amount: keep 2 decimals
            const amountDisplay = (result.amount).toFixed(2);
            console.log('[SPECTRE] Success! Received:', amountDisplay, 'UNIT');
            showToast(`Successfully received ${amountDisplay} UNIT`, 'success');
          } catch (error) {
            console.error('[SPECTRE] Failed:', error.message);

            setIsVerifyingToken(false);

            // Check for specific error messages
            let errorMessage = error.message || 'Failed to receive token';
            if (errorMessage.includes('already spent') || errorMessage.includes('already been spent')) {
              errorMessage = 'Token already claimed';
            } else if (errorMessage.includes('P2PK verification failed')) {
              errorMessage = 'Failed to verify Spectre token signature';
            }

            showToast(errorMessage, 'error');
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
            <Text style={localStyles.loadingText}>Claiming Spectre transaction</Text>
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
