/**
 * RootNavigator - Top-level navigation structure
 * Switches between Auth flow and Main app based on authentication state
 */

import { NavigationContainer,NavigationContainerRef,Route } from '@react-navigation/native';
import { CardStyleInterpolators,createStackNavigator,StackNavigationOptions } from '@react-navigation/stack';
import React,{ createRef,useCallback,useEffect,useRef } from 'react';
import { ActivityIndicator,Alert,Keyboard,StyleSheet,Text,View } from 'react-native';
import AnnouncementModal from '../components/AnnouncementModal';
import BiometricSetupModal from '../components/BiometricSetupModal';
import MutinynetBanner from '../components/MutinynetBanner';
import PasskeyMigrationModal from '../components/PasskeyMigrationModal';
import { withErrorBoundary } from '../components/withErrorBoundary';
import LockScreen from '../screens/auth/LockScreen';
import PinSetupScreenComponent from '../screens/auth/PinSetupScreen';
import {
authenticateWithBiometrics,
setBiometricEnabled as persistBiometricEnabled,
} from '../services/biometricService';
import { COLORS } from '../theme';
import {
AuthStack,
BorrowNavigator,
DepositNavigator,
MainTabs,
RepayNavigator,
SendNavigator,
VaultCreateNavigator,
WithdrawNavigator,
} from './navigators';

import {
useAirdrop,
useAuth,
useAuthFlowHandlers,
useBalance,
useCashuOperations,
useOnboardingFlow,
useWallet,
} from '../contexts';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { useNavigationState } from '../hooks/useNavigationState';
import { useNotifications } from '../stores/notificationStore';

import { useTurboSnackbarQueue } from '../hooks/useTurboSnackbarQueue';
import { useTurboTokenProcessor } from '../hooks/useTurboTokenProcessor';
import { useRemoteConfigStore } from '../stores/remoteConfigStore';
import { createLinkingConfig } from '../services/turbo/turboLinkingConfig';
import { useTurboProcessingStore } from '../stores/turboProcessingStore';
import { logger } from '../utils/logger';

import type { LogContext } from '../types';
import type { RootNavigatorParamList } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

const Stack = createStackNavigator<RootNavigatorParamList>();

// No animation options for instant screen transitions
const noAnimationOptions: StackNavigationOptions = {
  cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
  transitionSpec: {
    open: { animation: 'timing', config: { duration: 0 } },
    close: { animation: 'timing', config: { duration: 0 } },
  },
};

// Wrap PIN setup screen with error boundary
const PinSetupScreen: AnyComponent = withErrorBoundary(PinSetupScreenComponent, {
  boundaryName: 'PinSetupScreen',
  fallbackMessage: 'Unable to load PIN setup. Please restart the app.',
});

// Create linking config once
const linking = createLinkingConfig();

// Navigation container ref (stable across renders)
const navigationRef = createRef<NavigationContainerRef<RootNavigatorParamList>>();

export default function RootNavigator(): React.JSX.Element {
  // Track current route name for navigation state change logging
  const currentRouteNameRef = useRef('');

  const onNavigationStateChange = useCallback((): void => {
    const previousRouteName = currentRouteNameRef.current;
    const currentRoute = navigationRef.current?.getCurrentRoute() as Route<string> | undefined;
    currentRouteNameRef.current = currentRoute?.name || '';

    if (previousRouteName !== currentRouteNameRef.current && currentRouteNameRef.current) {
      logger.screen(currentRouteNameRef.current, {} as LogContext);
    }
  }, []);
  const { shouldShowAuth, shouldShowPinOverlay, shouldShowLockOverlay } = useNavigationState();

  const {
    isBiometricSupported,
    isAuthenticated,
    biometricEnabled,
    setIsAuthenticated,
    setBiometricEnabled,
  } = useAuth();
  const { wallet, switchAccount } = useWallet();
  const { seedConfirmedRef } = useOnboardingFlow();
  const { fetchBalance } = useBalance();
  const { showToast, showSnackbar, dismissSnackbar } = useNotifications();
  const { receive, refresh: refreshCashu } = useCashuOperations();
  const { setShowAirdropModal } = useAirdrop();

  // Remote config store — announcement + network change
  const shouldShowAnnouncement = useRemoteConfigStore((s) => s.shouldShowAnnouncement);
  const dismissAnnouncement = useRemoteConfigStore((s) => s.dismissAnnouncement);
  const announcement = useRemoteConfigStore((s) => s.config.announcement);
  const pendingNetworkChange = useRemoteConfigStore((s) => s.pendingNetworkChange);

  // Show alert when server pushes a network change
  const networkAlertShown = useRef(false);
  useEffect(() => {
    if (pendingNetworkChange && !networkAlertShown.current) {
      networkAlertShown.current = true;
      Alert.alert('Network Changed', 'Please restart the app to apply changes.');
    }
  }, [pendingNetworkChange]);

  // Turbo snackbar queue (must be before token processor — provides checkQueuedSnackbars)
  const { checkQueuedSnackbars } = useTurboSnackbarQueue({
    isAuthenticated,
    shouldShowPinOverlay,
    showSnackbar,
  });

  // Turbo token processing (single 500ms polling loop handles both tokens and snackbars)
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
    checkQueuedSnackbars,
  });

  // Wallet exists ref for useAppLifecycle
  const walletExists = useRef(false);
  useEffect(() => {
    walletExists.current = !!wallet;
  }, [wallet]);

  // Check for pending turbo transaction and navigate to resume
  const pendingTurboChecked = useRef(false);
  const turboIsProcessing = useTurboProcessingStore((state) => state.isProcessing);
  const loadPersistedState = useTurboProcessingStore((state) => state.loadPersistedState);

  useEffect(() => {
    if (pendingTurboChecked.current) return;
    if (!isAuthenticated || shouldShowAuth || shouldShowPinOverlay || shouldShowLockOverlay) return;

    let timeoutId: NodeJS.Timeout | null = null;

    // Load persisted state first, then check if we need to resume
    const checkAndResume = async () => {
      // Load persisted state from AsyncStorage if not already loaded
      const persistedState = await loadPersistedState();

      if (persistedState && persistedState.isProcessing) {
        pendingTurboChecked.current = true;

        // Also restore the send flow state
        const { useSendFlowStore: sendStore } = await import('../stores/sendFlowStore');
        sendStore.getState().setSendAmount(persistedState.sendAmount);
        sendStore.getState().setSendRecipient(persistedState.sendRecipient);
        sendStore.getState().setSendAssetType('unit');
        sendStore.getState().setTurboEnabled(true);

        // Navigate to TurboProcessing after a short delay to ensure navigation is ready
        timeoutId = setTimeout(() => {
          logger.info('[RootNavigator] Resuming pending turbo transaction', {
            amount: persistedState.sendAmount,
            recipient: persistedState.sendRecipient,
          });
          navigationRef.current?.navigate('SendFlow', { screen: 'TurboProcessing' });
        }, 500);
      } else {
        // No pending transaction, mark as checked
        pendingTurboChecked.current = true;
      }
    };

    checkAndResume();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAuthenticated, shouldShowAuth, shouldShowPinOverlay, shouldShowLockOverlay, loadPersistedState]);

  // Get handlers from context (needed for handleLock)
  const {
    handlePinSetupCompleteWrapper,
    handlePinChangeCompleteWrapper,
    handleCancelPinChange,
    handleLockScreenAuthenticatedWrapper,
    showPasskeyMigrationModal,
    passkeyMigrationData,
    hidePasskeyMigrationPrompt,
    handlePasskeyUpgradeComplete,
    showBiometricSetupModal,
    showBiometricSetupPrompt,
    hideBiometricSetupPrompt,
    handleBiometricSetupEnable,
    handleBiometricSetupSkip,
  } = useAuthFlowHandlers();

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

  const enableBiometricFromPrompt = useCallback(async (): Promise<void> => {
    try {
      const result = await authenticateWithBiometrics(
        'Authenticate to enable Face ID',
        'Cancel'
      );

      if (!result.success) {
        return;
      }

      if (!await persistBiometricEnabled(true)) {
        throw new Error('Failed to persist biometric preference');
      }

      setBiometricEnabled(true);
      setIsAuthenticated(true);
      handleLockScreenAuthenticatedWrapper();
    } catch (error: unknown) {
      logger.error('[RootNavigator] Failed to enable biometrics from lock screen', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [setBiometricEnabled, setIsAuthenticated, handleLockScreenAuthenticatedWrapper]);

  // Handle biometric authentication with proper post-auth flow
  const handleBiometricAuth = useCallback(async () => {
    logger.debug('[RootNavigator] handleBiometricAuth called', { biometricEnabled, isBiometricSupported });
    try {
      if (biometricEnabled) {
        const result = await authenticateWithBiometrics(
          'Authenticate to unlock wallet',
          'Use PIN'
        );

        if (result.success) {
          setIsAuthenticated(true);
          handleLockScreenAuthenticatedWrapper();
        }
      } else {
        // Biometrics not enabled - ask user if they want to enable
        Alert.alert(
          'Enable Face ID',
          'Would you like to enable Face ID for faster login?',
          [
            {
              text: 'Not Now',
              style: 'cancel',
            },
            {
              text: 'Enable',
              onPress: () => {
                enableBiometricFromPrompt();
              },
            },
          ]
        );
      }
    } catch (error) {
      logger.error('[RootNavigator] Biometric auth error:', { error: error instanceof Error ? error.message : String(error) });
    }
  }, [biometricEnabled, isBiometricSupported, setIsAuthenticated, enableBiometricFromPrompt, handleLockScreenAuthenticatedWrapper]);

  // Set up app lifecycle (inactivity timer, app state changes)
  const { resetInactivityTimer } = useAppLifecycle({
    isAuthenticated,
    walletExists,
    seedConfirmedRef,
    isBiometricSupported,
    biometricEnabled,
    isProcessing: turboIsProcessing,
    onLock: handleLock,
    onAuthenticateUser: handleBiometricAuth,
  });


  // Handle passkey enabled - show biometric setup prompt only if not already enabled
  const handlePasskeyEnabled = useCallback(async () => {
    if (biometricEnabled) return; // Already set up, don't ask again
    const localAuthenticationModule = await import('expo-local-authentication');
    const hasHardware = await localAuthenticationModule.hasHardwareAsync();
    const isEnrolled = await localAuthenticationModule.isEnrolledAsync();
    if (hasHardware && isEnrolled) {
      showBiometricSetupPrompt();
    }
  }, [showBiometricSetupPrompt, biometricEnabled]);

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
              {/* SECURITY: Only register financial flow screens when authenticated.
                  Prevents deep-link access to transaction flows while lock overlay is shown. */}
              {isAuthenticated && (
                <React.Fragment>
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
                  <Stack.Screen
                    name="BorrowFlow"
                    component={BorrowNavigator}
                    options={{ presentation: 'modal' }}
                  />
                  <Stack.Screen
                    name="DepositFlow"
                    component={DepositNavigator}
                    options={{ presentation: 'modal' }}
                  />
                  <Stack.Screen
                    name="RepayFlow"
                    component={RepayNavigator}
                    options={{ presentation: 'modal' }}
                  />
                  <Stack.Screen
                    name="WithdrawFlow"
                    component={WithdrawNavigator}
                    options={{ presentation: 'modal' }}
                  />
                </React.Fragment>
              )}
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
              showFaceIdButton={isBiometricSupported}
              onFaceIdPress={handleBiometricAuth}
            />
          </View>
        )}

        {/* Passkey Migration Modal */}
        {showPasskeyMigrationModal && passkeyMigrationData && (
          <PasskeyMigrationModal
            visible={showPasskeyMigrationModal}
            onClose={hidePasskeyMigrationPrompt}
            onPasskeyEnabled={
              passkeyMigrationData.mode === 'import'
                ? handlePasskeyEnabled
                : handlePasskeyUpgradeComplete
            }
            mode={passkeyMigrationData.mode}
            currentPin={passkeyMigrationData.currentPin}
            showToast={showToast}
          />
        )}

        {/* Biometric Setup Modal (after passkey wallet creation or migration) */}
        {showBiometricSetupModal && (
          <BiometricSetupModal
            visible={showBiometricSetupModal}
            onEnable={handleBiometricSetupEnable}
            onSkip={handleBiometricSetupSkip}
          />
        )}

        {/* Announcement Modal (server-driven popup) */}
        {shouldShowAnnouncement() &&
          isAuthenticated &&
          !shouldShowPinOverlay &&
          !shouldShowLockOverlay && (
            <AnnouncementModal
              visible
              announcement={announcement}
              onDismiss={() => dismissAnnouncement(announcement.id)}
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
