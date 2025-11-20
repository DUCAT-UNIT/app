/**
 * RootNavigator - Top-level navigation structure
 * Switches between Auth flow and Main app based on authentication state
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
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

const Stack = createStackNavigator();

// Linking configuration for deep links
const linking = {
  prefixes: ['ducat://', 'https://ducatprotocol.com'],
  config: {
    screens: {
      Main: {
        screens: {
          Wallet: 'wallet',
        },
      },
    },
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

  // Create wallet exists ref for useAppLifecycle
  const walletExists = React.useRef(false);
  React.useEffect(() => {
    walletExists.current = !!wallet;
  }, [wallet]);

  // Handle deeplink for receiving Cashu tokens
  React.useEffect(() => {
    // Handle initial URL (app opened from deeplink)
    const handleInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleDeepLink(url);
      }
    };

    // Handle URL events (app already open, deeplink clicked)
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, [receive, isAuthenticated]);

  // Extract token from URL and call receive
  const handleDeepLink = React.useCallback(async (url) => {
    // Only handle deeplinks when authenticated
    if (!isAuthenticated) {
      return;
    }

    try {
      console.log('[Deeplink] Processing URL:', url);

      // Handle both custom scheme (ducat://) and universal links (https://ducatprotocol.com/)
      // Match patterns:
      // - ducat://receive?token=cashuA...
      // - https://ducatprotocol.com/receive?token=cashuA...
      const match = url.match(/^(?:ducat:\/\/|https:\/\/ducatprotocol\.com\/)receive\?token=(.+)$/);

      if (match && match[1]) {
        const token = decodeURIComponent(match[1]);

        console.log('[Deeplink] Receiving token from link');

        try {
          const result = await receive(token);
          Alert.alert(
            'Token Received!',
            `Successfully received ${result.amount} UNIT`,
            [{ text: 'OK' }]
          );
        } catch (error) {
          console.error('[Deeplink] Failed to receive token:', error);
          Alert.alert(
            'Error',
            error.message || 'Failed to receive token',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('[Deeplink] Failed to process URL:', error);
    }
  }, [receive, isAuthenticated]);

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
});
