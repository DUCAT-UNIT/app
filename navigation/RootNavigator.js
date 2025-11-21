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

const Stack = createStackNavigator();

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
    console.log('[Linking] 🔗 Custom subscribe called - setting up deeplink handlers');

    // Helper to extract and store token
    const extractAndStoreToken = (url) => {
      if (url && (url.includes('receive?token=') || url.includes('spectre?token='))) {
        console.log('[Linking] 🎯 Subscribe detected token URL:', url);

        // Extract token parameter from URL
        const tokenMatch = url.match(/[?&]token=([^&]+)/);
        if (tokenMatch && tokenMatch[1]) {
          let token = decodeURIComponent(tokenMatch[1]);

          // If this is a spectre link, the token is emoji-encoded
          if (url.includes('spectre?token=')) {
            console.log('[Linking] 👻 Detected Spectre emoji token, decoding...');
            try {
              token = decodeCashuToken(token);
              console.log('[Linking] ✅ Successfully decoded emoji token');
            } catch (error) {
              console.error('[Linking] ❌ Failed to decode emoji token:', error);
              return;
            }
          }

          if (typeof global !== 'undefined') {
            global.pendingCashuToken = token;
            console.log('[Linking] 💾 Subscribe stored token in global');

            // Immediately trigger check if function is available (app is open)
            if (typeof global.triggerPendingTokenCheck === 'function') {
              console.log('[Linking] ⚡ Immediately triggering token check');
              setTimeout(() => global.triggerPendingTokenCheck(), 100);
            }
          }
        }
      }
    };

    // Listen for URL events
    const onReceiveURL = (event) => {
      console.log('[Linking] 🎯 onReceiveURL called with event:', event);
      const url = event?.url;
      if (!url) {
        console.log('[Linking] ⚠️ No URL in event, ignoring');
        return;
      }

      console.log('[Linking] 📲 Custom subscribe received URL:', url);
      extractAndStoreToken(url);
      listener(url);
    };

    // Handle initial URL
    Linking.getInitialURL().then((url) => {
      console.log('[Linking] 🚀 getInitialURL result:', url || 'null');
      if (url) {
        console.log('[Linking] 📥 Custom subscribe initial URL:', url);
        extractAndStoreToken(url);
        listener(url);
      } else {
        console.log('[Linking] ℹ️ No initial URL (app opened normally)');
      }
    }).catch(error => {
      console.error('[Linking] ❌ Failed to get initial URL:', error);
    });

    // Add event listener
    const subscription = Linking.addEventListener('url', onReceiveURL);

    return () => {
      console.log('[Linking] Custom subscribe cleanup');
      subscription.remove();
    };
  },
  // Custom function to intercept and handle special URLs before navigation
  async getStateFromPath(path, options) {
    console.log('[Linking] ⚡ getStateFromPath called with path:', path);

    // Check if this is a token receive URL (supports both /receive and receive paths)
    if (path.includes('receive?token=')) {
      console.log('[Linking] ✅ Detected receive URL!');

      // Extract token from URL (handle both /receive and receive)
      const match = path.match(/\/?receive\?token=(.+)$/);
      if (match && match[1]) {
        const encodedToken = match[1];
        const token = decodeURIComponent(encodedToken);
        console.log('[Linking] 🎯 Extracted token (first 30 chars):', token.substring(0, 30));

        // Store token in a global to be processed when app is ready
        if (typeof global !== 'undefined') {
          global.pendingCashuToken = token;
          console.log('[Linking] 💾 Stored token in global.pendingCashuToken');
        }
      }

      // Return null to prevent navigation, we'll handle it in the app
      return null;
    }

    console.log('[Linking] ⏭️  Not a receive URL, using default behavior');
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
  const [isVerifyingToken, setIsVerifyingToken] = React.useState(false);
  const processingTokenRef = React.useRef(null); // Track currently processing token
  const processedTokensRef = React.useRef(new Set()); // Track all processed tokens to prevent re-processing

  // Create wallet exists ref for useAppLifecycle
  const walletExists = React.useRef(false);
  React.useEffect(() => {
    walletExists.current = !!wallet;
  }, [wallet]);

  // Check for pending token when authenticated - this runs after linking config stores token
  const checkPendingTokenRef = React.useRef(null); // Store function ref so it can be called externally

  React.useEffect(() => {
    console.log('[Deeplink] 🔄 Setting up pending token checker');

    // Check immediately
    const checkPendingToken = () => {
      if (isAuthenticated && global.pendingCashuToken && !isVerifyingToken) {
        const token = global.pendingCashuToken;

        // Check if we've already processed or are processing this exact token
        if (processingTokenRef.current === token || processedTokensRef.current.has(token)) {
          // Clear from global to prevent spam
          delete global.pendingCashuToken;
          return;
        }

        console.log('[Deeplink] 💎 Processing pending token from global');
        console.log('[Deeplink] 🆔 Token ID for tracking:', token.substring(0, 20) + '...');

        // Mark this token as being processed
        processingTokenRef.current = token;
        processedTokensRef.current.add(token);

        // Clear the pending token immediately to prevent double-processing
        delete global.pendingCashuToken;

        console.log('[Deeplink] 📝 Processed tokens count:', processedTokensRef.current.size);

        // Process the token
        (async () => {
          try {
            setIsVerifyingToken(true);
            console.log('[Deeplink] 📞 Calling receive function...');
            console.log('[Deeplink] 🔑 Token preview:', token.substring(0, 50) + '...');

            const result = await receive(token);
            console.log('[Deeplink] ✅ Token received successfully!', result);

            setIsVerifyingToken(false);
            processingTokenRef.current = null; // Clear currently processing token

            // Remove from processed set after a delay to allow new tokens
            setTimeout(() => {
              processedTokensRef.current.delete(token);
              console.log('[Deeplink] 🧹 Cleaned up processed token, ready for next');
            }, 2000);

            // Format amount: multiply by 100 and keep 2 decimals
            const amountDisplay = (result.amount * 100).toFixed(2);
            showToast(`Successfully received ${amountDisplay} UNIT`, 'success');
          } catch (error) {
            console.error('[Deeplink] ❌ Failed to receive token:', error);
            console.error('[Deeplink] ❌ Error stack:', error.stack);

            setIsVerifyingToken(false);
            processingTokenRef.current = null; // Clear currently processing token

            // Remove from processed set after error to allow retry with different token
            setTimeout(() => {
              processedTokensRef.current.delete(token);
              console.log('[Deeplink] 🧹 Cleaned up failed token, ready for next');
            }, 2000);

            // Check for specific error messages
            let errorMessage = error.message || 'Failed to receive token';
            if (errorMessage.includes('already spent') || errorMessage.includes('already been spent')) {
              errorMessage = 'Token already claimed';
            } else if (errorMessage.includes('P2PK verification failed')) {
              errorMessage = 'Failed to verify Spectre token signature';
            }

            console.log('[Deeplink] 🚨 Showing error toast:', errorMessage);
            showToast(errorMessage, 'error');
          }
        })();
      }
    };

    // Store in ref so it can be called from linking subscribe
    checkPendingTokenRef.current = checkPendingToken;

    // Check immediately
    checkPendingToken();

    // Also poll every 500ms to catch tokens that arrive while app is open
    const interval = setInterval(checkPendingToken, 500);

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, receive]);

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
