/**
 * RootNavigator - Top-level navigation structure
 * Switches between Auth flow and Main app based on authentication state
 */

import React, { createRef, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Keyboard } from 'react-native';
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
import BiometricSetupModal from '../components/BiometricSetupModal';
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
import { useAirdrop } from '../contexts/AirdropContext';

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

// Create linking config once
const linking = createLinkingConfig();

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
  const { setShowAirdropModal } = useAirdrop();

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

  // Get handlers from context (needed for handleLock)
  const {
    handlePinSetupCompleteWrapper,
    handlePinChangeCompleteWrapper,
    handleCancelPinChange,
    handleLockScreenAuthenticatedWrapper,
    showPasskeyMigrationModal,
    passkeyMigrationData,
    hidePasskeyMigrationPrompt,
    showBiometricSetupModal,
    showBiometricSetupPrompt,
    hideBiometricSetupPrompt,
    handleBiometricSetupEnable,
    handleBiometricSetupSkip,
  } = useNavigationHandlers();

  // Handle lock/unlock - dismiss all modals and reset navigation
  const handleLock = useCallback(() => {
    logger.info('[RootNavigator] handleLock called - dismissing modals and locking');

    // Dismiss keyboard
    Keyboard.dismiss();

    // Dismiss snackbar
    dismissSnackbar();

    // Dismiss all open modals
    hidePasskeyMigrationPrompt();
    hideBiometricSetupPrompt();
    setShowAirdropModal(false);

    // Reset navigation to main screen
    if (navigationRef.current?.isReady()) {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    }

    // Lock the app
    setIsAuthenticated(false);
  }, [setIsAuthenticated, dismissSnackbar, hidePasskeyMigrationPrompt, hideBiometricSetupPrompt, setShowAirdropModal]);

  const handleAuthenticateUser = useCallback(async () => {
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


  // Handle passkey enabled - show biometric setup prompt if supported
  const handlePasskeyEnabled = useCallback(async () => {
    // Check if biometrics are supported and enrolled
    const LocalAuthentication = await import('expo-local-authentication');
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && isEnrolled) {
      showBiometricSetupPrompt();
    }
  }, [showBiometricSetupPrompt]);

  return (
    <View
      style={styles.container}
      onTouchStart={() => {
        if (isAuthenticated) {
          resetInactivityTimer();
        }
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
              onAuthenticated={handleLockScreenAuthenticatedWrapper}
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
            onPasskeyEnabled={handlePasskeyEnabled}
            mnemonic={passkeyMigrationData.mnemonic}
            currentPin={passkeyMigrationData.pin}
            showToast={showToast}
          />
        )}

        {/* Biometric Setup Modal (after passkey wallet creation or migration) */}
        <BiometricSetupModal
          visible={showBiometricSetupModal}
          onEnable={handleBiometricSetupEnable}
          onSkip={handleBiometricSetupSkip}
        />

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
