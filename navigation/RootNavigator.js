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
import PinSetupScreenComponent from '../screens/auth/PinSetupScreen';
import PasskeyMigrationModal from '../components/PasskeyMigrationModal';
import MutinynetBanner from '../components/MutinynetBanner';
import { withErrorBoundary } from '../components/withErrorBoundary';
import { COLORS } from '../theme';

import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useBalance } from '../contexts/WalletDataContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigationState } from '../hooks/useNavigationState';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { useOnboardingFlow } from '../contexts/AuthContext';
import { useCashu } from '../contexts/CashuContext';

import { createLinkingConfig } from '../services/turbo/turboLinkingConfig';
import { useTurboTokenProcessor } from '../hooks/useTurboTokenProcessor';
import { useTurboSnackbarQueue } from '../hooks/useTurboSnackbarQueue';
import logger from '../utils/logger';

const Stack = createStackNavigator();

// Wrap PIN setup screen with error boundary
const PinSetupScreen = withErrorBoundary(PinSetupScreenComponent, {
  boundaryName: 'PinSetupScreen',
  fallbackMessage: 'Unable to load PIN setup. Please restart the app.',
});

// Create linking config once
const linking = createLinkingConfig();

// Track navigation state changes
const navigationRef = React.createRef();
let currentRouteName = '';

function onNavigationStateChange() {
  const previousRouteName = currentRouteName;
  const currentRoute = navigationRef.current?.getCurrentRoute();
  currentRouteName = currentRoute?.name || '';

  if (previousRouteName !== currentRouteName && currentRouteName) {
    logger.screen(currentRouteName, currentRoute?.params || {});
  }
}

export default function RootNavigator() {
  const { shouldShowAuth, shouldShowPinOverlay } = useNavigationState();

  const {
    isBiometricSupported,
    isAuthenticated,
    biometricEnabled,
    setIsAuthenticated,
    authenticateUser,
  } = useAuth();
  const { wallet, switchAccount } = useWallet();
  const { seedConfirmedRef } = useOnboardingFlow();
  const { fetchBalance } = useBalance();
  const { showToast, showSnackbar, dismissSnackbar } = useNotifications();
  const { receive, refresh: refreshCashu } = useCashu();

  // Turbo token processing
  const { isVerifyingToken } = useTurboTokenProcessor({
    isAuthenticated,
    shouldShowPinOverlay,
    receive,
    fetchBalance,
    refreshCashu,
    wallet,
    showSnackbar,
    dismissSnackbar,
    switchAccount,
  });

  // Turbo snackbar queue
  useTurboSnackbarQueue({
    isAuthenticated,
    shouldShowPinOverlay,
    showSnackbar,
    dismissSnackbar,
  });

  // Wallet exists ref for useAppLifecycle
  const walletExists = React.useRef(false);
  React.useEffect(() => {
    walletExists.current = !!wallet;
  }, [wallet]);

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
      style={styles.container}
      onStartShouldSetResponder={() => {
        if (isAuthenticated) {
          resetInactivityTimer();
        }
        return false;
      }}
    >
      <NavigationContainer linking={linking} ref={navigationRef} onStateChange={onNavigationStateChange}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: COLORS.DARK_BG },
            animationEnabled: false,
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

        {/* PIN Change Overlay */}
        {shouldShowPinOverlay && (
          <View style={styles.pinOverlay}>
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

        {/* Passkey Migration Modal */}
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
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
              <Text style={styles.loadingText}>Claiming Turbo transaction</Text>
            </View>
          </View>
        )}
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
