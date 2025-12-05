/**
 * RootNavigator - Top-level navigation structure
 * Switches between Auth flow and Main app based on authentication state
 */

import React, { createRef, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer, NavigationContainerRef, Route } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import SendNavigator from './SendNavigator';
import VaultCreateNavigator from './VaultCreateNavigator';
import BorrowNavigator from './BorrowNavigator';
import DepositNavigator from './DepositNavigator';
import RepayNavigator from './RepayNavigator';
import WithdrawNavigator from './WithdrawNavigator';
import PinSetupScreenComponent from '../screens/auth/PinSetupScreen';
import LockScreen from '../screens/auth/LockScreen';
import PasskeyMigrationModal from '../components/PasskeyMigrationModal';
import MutinynetBanner from '../components/MutinynetBanner';
import { withErrorBoundary } from '../components/withErrorBoundary';
import { COLORS } from '../theme';

import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useBalance } from '../contexts/WalletDataContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useNotifications } from '../stores/notificationStore';
import { useNavigationState } from '../hooks/useNavigationState';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { useOnboardingFlow } from '../contexts/AuthContext';
import { useCashu } from '../contexts/CashuContext';

import { createLinkingConfig } from '../services/turbo/turboLinkingConfig';
import { useTurboTokenProcessor } from '../hooks/useTurboTokenProcessor';
import { useTurboSnackbarQueue } from '../hooks/useTurboSnackbarQueue';
import { useTurboProcessingStore } from '../stores/turboProcessingStore';
import logger from '../utils/logger';

import type { RootNavigatorParamList } from './types';
import type { LogContext } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

const Stack = createStackNavigator<RootNavigatorParamList>();

// Wrap PIN setup screen with error boundary
const PinSetupScreen: AnyComponent = withErrorBoundary(PinSetupScreenComponent, {
  boundaryName: 'PinSetupScreen',
  fallbackMessage: 'Unable to load PIN setup. Please restart the app.',
});

// Create linking config once - cast to any to avoid strict type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const linking = createLinkingConfig() as any;

// Track navigation state changes
const navigationRef = createRef<NavigationContainerRef<RootNavigatorParamList>>();
let currentRouteName = '';

function onNavigationStateChange(): void {
  const previousRouteName = currentRouteName;
  const currentRoute = navigationRef.current?.getCurrentRoute() as Route<string> | undefined;
  currentRouteName = currentRoute?.name || '';

  if (previousRouteName !== currentRouteName && currentRouteName) {
    logger.screen(currentRouteName, (currentRoute?.params || {}) as LogContext);
  }
}

export default function RootNavigator(): React.JSX.Element {
  const { shouldShowAuth, shouldShowPinOverlay, shouldShowLockOverlay } = useNavigationState();

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { isVerifyingToken } = useTurboTokenProcessor({
    isAuthenticated,
    shouldShowPinOverlay,
    receive,
    fetchBalance,
    refreshCashu,
    wallet: wallet as any,
    showSnackbar: showSnackbar as any,
    dismissSnackbar,
    switchAccount: switchAccount as any,
  });

  // Turbo snackbar queue
  useTurboSnackbarQueue({
    isAuthenticated,
    shouldShowPinOverlay,
    showSnackbar: showSnackbar as any,
    dismissSnackbar,
  });

  // Wallet exists ref for useAppLifecycle
  const walletExists = useRef(false);
  useEffect(() => {
    walletExists.current = !!wallet;
  }, [wallet]);

  // Check for pending turbo transaction and navigate to resume
  const pendingTurboChecked = useRef(false);
  const turboIsProcessing = useTurboProcessingStore((state) => state.isProcessing);

  useEffect(() => {
    if (pendingTurboChecked.current) return;
    if (!isAuthenticated || shouldShowAuth || shouldShowPinOverlay || shouldShowLockOverlay) return;
    if (!turboIsProcessing) return;

    pendingTurboChecked.current = true;

    // Navigate to TurboProcessing after a short delay to ensure navigation is ready
    const timer = setTimeout(() => {
      logger.info('[RootNavigator] Resuming pending turbo transaction');
      navigationRef.current?.navigate('SendFlow', { screen: 'TurboProcessing' });
    }, 500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, shouldShowAuth, shouldShowPinOverlay, shouldShowLockOverlay, turboIsProcessing]);

  // Handle lock/unlock
  const handleLock = useCallback(() => {
    setIsAuthenticated(false);
  }, [setIsAuthenticated]);

  const handleAuthenticateUser = useCallback(async () => {
    await authenticateUser();
  }, [authenticateUser]);

  // Handle successful authentication from lock overlay
  const handleLockScreenAuthenticated = useCallback(() => {
    setIsAuthenticated(true);
  }, [setIsAuthenticated]);

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
            animation: 'none',
          }}
        >
          {shouldShowAuth ? (
            <Stack.Screen name="Auth" component={AuthStack} />
          ) : (
            <React.Fragment>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen
                name="SendFlow"
                component={SendNavigator}
                options={{
                  presentation: 'modal',
                }}
              />
              <Stack.Screen
                name="VaultCreateFlow"
                component={VaultCreateNavigator}
                options={{
                  presentation: 'modal',
                }}
              />
              <Stack.Screen name="BorrowFlow" component={BorrowNavigator} />
              <Stack.Screen name="DepositFlow" component={DepositNavigator} />
              <Stack.Screen name="RepayFlow" component={RepayNavigator} />
              <Stack.Screen name="WithdrawFlow" component={WithdrawNavigator} />
            </React.Fragment>
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

        {/* Lock Screen Overlay - keeps MainTabs mounted for instant unlock */}
        {shouldShowLockOverlay && (
          <View style={styles.lockOverlay}>
            <MutinynetBanner />
            <LockScreen
              onAuthenticated={handleLockScreenAuthenticated}
              showFaceIdButton={biometricEnabled && isBiometricSupported}
              onFaceIdPress={handleAuthenticateUser}
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
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 900,
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
