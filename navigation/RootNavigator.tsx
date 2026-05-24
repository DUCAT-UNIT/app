/**
 * RootNavigator - Top-level navigation structure
 * Switches between Auth flow and Main app based on authentication state
 */

import {
  DarkTheme,
  NavigationContainer,
  NavigationContainerRef,
  Route,
  Theme,
} from '@react-navigation/native';
import { createStackNavigator, StackNavigationOptions } from '@react-navigation/stack';
import React, { createRef, useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Keyboard,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BiometricSetupModal from '../components/BiometricSetupModal';
import MutinynetBanner from '../components/MutinynetBanner';
import PasskeyMigrationModal from '../components/PasskeyMigrationModal';
import { withErrorBoundary } from '../components/withErrorBoundary';
import LockScreen from '../screens/auth/LockScreen';
import VaultSuccessPreviewScreenComponent from '../screens/dev/VaultSuccessPreviewScreen';
import PinSetupScreenComponent from '../screens/auth/PinSetupScreen';
import LiquidationFlowScreenComponent from '../screens/liquidation/LiquidationFlowScreen';
import QuantaSeedPhraseGuideScreenComponent from '../screens/quanta/QuantaSeedPhraseGuideScreen';
import { authenticateWithBiometrics } from '../services/biometricService';
import {
  canUseBiometricUnlockForMnemonic,
  clearSessionMnemonic,
  hasAccessibleMnemonic,
} from '../services/secureStorageService';
import { COLORS } from '../theme';
import {
  AuthStack,
  BorrowNavigator,
  DepositNavigator,
  MainTabs,
  RepayNavigator,
  SendNavigator,
  VaultCreateNavigator,
  WalletStackNavigator,
  WithdrawNavigator,
} from './navigators';

import {
  useAirdrop,
  useAuthFlowHandlers,
  useAuthSession,
  useBalance,
  useCashuOperations,
  useOnboardingFlow,
  useSettingsHandlers,
  useWallet,
} from '../contexts';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { useNavigationState } from '../hooks/useNavigationState';
import { useNotifications } from '../stores/notificationStore';
import { useBorrowStore } from '../stores/borrowStore';
import { useDepositStore } from '../stores/depositStore';
import { useRepayStore } from '../stores/repayStore';
import { useVaultCreationStore } from '../stores/vaultCreationStore';
import { useWithdrawStore } from '../stores/withdrawStore';
import { useNotifications as useNotificationsPush } from '../hooks/useNotifications';
import type { NotificationDataType } from '../hooks/useNotifications';
import * as Notifications from 'expo-notifications';
import { isE2E } from '../utils/e2e';
import { performFullWalletReset } from '../services/walletResetService';

import { useTurboSnackbarQueue } from '../hooks/useTurboSnackbarQueue';
import { useTurboTokenProcessor } from '../hooks/useTurboTokenProcessor';
import { createLinkingConfig } from '../services/turbo/turboLinkingConfig';
import { useTurboProcessingStore } from '../stores/turboProcessingStore';
import { logger } from '../utils/logger';
import { analytics } from '../services/analyticsService';
import { decodeTokenMetadata } from '../services/cashu/cashuWalletService';
import { DEFAULT_CASHU_UNIT, normalizeCashuUnit } from '../services/cashu/cashuUnits';
import { ENABLE_QUANTA_REWARDS } from '../utils/releaseFlags';

import type { LogContext } from '../types';
import type { RootNavigatorParamList } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

const Stack = createStackNavigator<RootNavigatorParamList>();

const DUCAT_NAVIGATION_THEME: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: COLORS.PRIMARY_BLUE,
    background: COLORS.DARK_BG,
    card: COLORS.DARK_BG,
    text: COLORS.TEXT_PRIMARY,
    border: COLORS.BORDER_COLOR,
    notification: COLORS.PRIMARY_BLUE,
  },
};

// Bubble zoom animation for vault action flows (Repay, Borrow, Deposit, Withdraw)
const bubbleZoomOptions: StackNavigationOptions = {
  cardStyleInterpolator: ({ current: { progress } }) => ({
    cardStyle: {
      opacity: progress,
      transform: [
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.85, 1],
          }),
        },
      ],
    },
    overlayStyle: {
      opacity: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.5],
      }),
    },
  }),
  transitionSpec: {
    open: { animation: 'spring', config: { damping: 20, stiffness: 300, mass: 0.8 } },
    close: { animation: 'timing', config: { duration: 200 } },
  },
  cardOverlayEnabled: true,
};

// Wrap PIN setup screen with error boundary
const PinSetupScreen: AnyComponent = withErrorBoundary(PinSetupScreenComponent, {
  boundaryName: 'PinSetupScreen',
  fallbackMessage: 'Unable to load PIN setup. Please restart the app.',
});

const VaultSuccessPreviewScreen: AnyComponent = withErrorBoundary(
  VaultSuccessPreviewScreenComponent,
  {
    boundaryName: 'VaultSuccessPreviewScreen',
    fallbackMessage: 'Unable to load success preview. Please try again.',
  }
);

const LiquidationFlowScreen: AnyComponent = withErrorBoundary(LiquidationFlowScreenComponent, {
  boundaryName: 'LiquidationFlowScreen',
  fallbackMessage: 'Unable to load liquidations. Please try again.',
});

const QuantaSeedPhraseGuideScreen: AnyComponent = withErrorBoundary(
  QuantaSeedPhraseGuideScreenComponent,
  {
    boundaryName: 'QuantaSeedPhraseGuideScreen',
    fallbackMessage: 'Unable to load Quanta guide. Please try again.',
  }
);

const rootFlowOptions: StackNavigationOptions = {
  animation: 'slide_from_right',
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  cardStyle: { backgroundColor: COLORS.DARK_BG },
};

// Create linking config once
const linking = createLinkingConfig();

// Navigation container ref (stable across renders)
const navigationRef = createRef<NavigationContainerRef<RootNavigatorParamList>>();

// ============================================================
// Extracted overlay components — reduces JSX nesting in RootNavigator
// ============================================================

interface PinChangeOverlayProps {
  isBiometricSupported: boolean;
  onPinSetupComplete: () => Promise<void>;
  onPinChangeComplete: () => Promise<void>;
  onCancel: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  showToast: (
    message: string,
    type?: 'success' | 'error' | 'warning' | 'info' | 'progress' | 'pending' | 'submitted'
  ) => void;
}

const PinChangeOverlay = React.memo(function PinChangeOverlay({
  isBiometricSupported,
  onPinSetupComplete,
  onPinChangeComplete,
  onCancel,
  fetchBalance,
  showToast,
}: PinChangeOverlayProps): React.JSX.Element {
  return (
    <View style={styles.pinOverlay}>
      <MutinynetBanner />
      <PinSetupScreen
        changingPin={true}
        isBiometricSupported={isBiometricSupported}
        onPinSetupComplete={onPinSetupComplete}
        onPinChangeComplete={onPinChangeComplete}
        onCancel={onCancel}
        fetchBalance={fetchBalance}
        showToast={showToast}
      />
    </View>
  );
});

interface LockScreenRouteProps {
  onAuthenticated: () => Promise<void>;
  showFaceIdButton: boolean;
  onFaceIdPress: () => Promise<void>;
  onResetWallet: () => void | Promise<void>;
}

const LockScreenRoute = React.memo(function LockScreenRoute({
  onAuthenticated,
  showFaceIdButton,
  onFaceIdPress,
  onResetWallet,
}: LockScreenRouteProps): React.JSX.Element {
  return (
    <View style={styles.lockScreenContainer}>
      <MutinynetBanner />
      <LockScreen
        onAuthenticated={onAuthenticated}
        showFaceIdButton={showFaceIdButton}
        onFaceIdPress={onFaceIdPress}
        onResetWallet={onResetWallet}
      />
    </View>
  );
});

const TokenVerificationOverlay = React.memo(function TokenVerificationOverlay(): React.JSX.Element {
  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} />
        <Text style={styles.loadingText}>Claiming Turbo transaction</Text>
      </View>
    </View>
  );
});

export default function RootNavigator(): React.JSX.Element {
  // Track current route name for navigation state change logging
  const currentRouteNameRef = useRef('');
  const pendingScreenLogTaskRef = useRef<ReturnType<
    typeof InteractionManager.runAfterInteractions
  > | null>(null);
  const pendingInactivityResetRef = useRef(false);

  const onNavigationStateChange = useCallback((): void => {
    const previousRouteName = currentRouteNameRef.current;
    const currentRoute = navigationRef.current?.getCurrentRoute() as Route<string> | undefined;
    currentRouteNameRef.current = currentRoute?.name || '';

    if (previousRouteName !== currentRouteNameRef.current && currentRouteNameRef.current) {
      pendingScreenLogTaskRef.current?.cancel();
      const nextRouteName = currentRouteNameRef.current;
      pendingScreenLogTaskRef.current = InteractionManager.runAfterInteractions(() => {
        logger.screen(nextRouteName, {} as LogContext);
        analytics.screen(nextRouteName);
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      pendingScreenLogTaskRef.current?.cancel();
    };
  }, []);
  const { shouldShowAuth, shouldShowPinOverlay, shouldShowLockOverlay } = useNavigationState();

  const {
    isBiometricSupported,
    isAuthenticated,
    biometricEnabled,
    setIsAuthenticated,
    showFaceIdButton,
    setShowFaceIdButton,
    resetAuth,
  } = useAuthSession();
  const { wallet, switchAccount, resetWallet } = useWallet();
  const { seedConfirmedRef, setSeedConfirmed } = useOnboardingFlow();
  const { fetchBalance } = useBalance();
  const { showToast, showSnackbar, dismissSnackbar } = useNotifications();
  const { receive, receiveBtc, refresh: refreshCashu } = useCashuOperations();
  const { setShowAirdropModal } = useAirdrop();
  const { settingsHandlers } = useSettingsHandlers();

  useEffect(() => {
    if (!shouldShowLockOverlay || !isBiometricSupported) {
      return;
    }

    let cancelled = false;
    canUseBiometricUnlockForMnemonic()
      .then((canUseBiometricUnlock) => {
        if (!cancelled) {
          setShowFaceIdButton(canUseBiometricUnlock);
        }
      })
      .catch((error: unknown) => {
        logger.warn('[RootNavigator] Failed to resolve Face ID unlock availability', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) {
          setShowFaceIdButton(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isBiometricSupported, setShowFaceIdButton, shouldShowLockOverlay, wallet?.taprootAddress]);

  // Notification tap response handler — routes to appropriate screen
  const handleNotificationResponse = useCallback(
    (dataType: NotificationDataType) => {
      if (!navigationRef.current?.isReady() || !isAuthenticated) return;

      logger.info('[RootNavigator] Routing notification tap', { dataType });

      switch (dataType) {
        case 'tx_confirmed':
        case 'swap_complete':
          // Stay on wallet — already the default screen
          break;
        case 'vault_health':
          navigationRef.current.navigate('WalletFlow', { screen: 'VaultDetail' });
          break;
        case 'liquidation_opportunity':
          navigationRef.current.navigate('Main', { screen: 'LiquidationsTab' });
          break;
        default:
          break;
      }
    },
    [isAuthenticated]
  );

  // Initialize push notification hooks (foreground handler + response listener)
  useNotificationsPush(
    handleNotificationResponse,
    wallet?.segwitAddress,
    settingsHandlers.notificationsEnabled,
    wallet?.taprootPubkey
  );

  // Deep notification response listener — handles taps when app was killed/backgrounded
  useEffect(() => {
    if (isE2E()) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { type?: NotificationDataType }
        | undefined;
      if (data?.type) {
        handleNotificationResponse(data.type);
      }
    });

    return () => subscription.remove();
  }, [handleNotificationResponse]);

  // Turbo snackbar queue (must be before token processor — provides checkQueuedSnackbars)
  const { checkQueuedSnackbars } = useTurboSnackbarQueue({
    isAuthenticated,
    shouldShowPinOverlay,
    showSnackbar,
  });

  const receiveCashuTokenByUnit = useCallback(
    async (token: string) => {
      const metadata = decodeTokenMetadata(token);
      const unit = normalizeCashuUnit(metadata.unit ?? DEFAULT_CASHU_UNIT);
      return unit === 'sat' ? receiveBtc(token) : receive(token);
    },
    [receive, receiveBtc]
  );

  // Turbo token processing (single 500ms polling loop handles both tokens and snackbars)
  const { isVerifyingToken } = useTurboTokenProcessor({
    isAuthenticated,
    shouldShowPinOverlay,
    receive: receiveCashuTokenByUnit,
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
  const borrowIsProcessing = useBorrowStore(
    (state) => state.loading || state.currentStep === 'processing'
  );
  const depositIsProcessing = useDepositStore(
    (state) => state.loading || state.currentStep === 'processing'
  );
  const repayIsProcessing = useRepayStore(
    (state) => state.loading || state.currentStep === 'processing'
  );
  const vaultCreationIsProcessing = useVaultCreationStore(
    (state) => state.loading || state.currentStep === 'processing'
  );
  const withdrawIsProcessing = useWithdrawStore(
    (state) => state.loading || state.currentStep === 'processing'
  );
  const walletOperationIsProcessing =
    turboIsProcessing ||
    borrowIsProcessing ||
    depositIsProcessing ||
    repayIsProcessing ||
    vaultCreationIsProcessing ||
    withdrawIsProcessing;
  const loadPersistedState = useTurboProcessingStore((state) => state.loadPersistedState);

  useEffect(() => {
    pendingTurboChecked.current = false;
  }, [wallet?.taprootAddress]);

  useEffect(() => {
    if (pendingTurboChecked.current) return;
    if (!isAuthenticated || shouldShowAuth || shouldShowPinOverlay || shouldShowLockOverlay) return;

    let timeoutId: NodeJS.Timeout | null = null;

    // Load persisted state first, then check if we need to resume
    const checkAndResume = async () => {
      // Load persisted state from AsyncStorage if not already loaded
      const persistedState = await loadPersistedState();

      if (persistedState && persistedState.isProcessing) {
        if (
          persistedState.senderTaprootAddress &&
          persistedState.senderTaprootAddress !== wallet?.taprootAddress
        ) {
          pendingTurboChecked.current = true;
          logger.info(
            '[RootNavigator] Pending turbo transaction belongs to another account; leaving it paused',
            {
              senderTaprootAddress: persistedState.senderTaprootAddress.substring(0, 12) + '...',
              activeTaprootAddress: wallet?.taprootAddress
                ? wallet.taprootAddress.substring(0, 12) + '...'
                : null,
              cashuUnit: persistedState.cashuUnit,
            }
          );
          return;
        }

        pendingTurboChecked.current = true;

        // Also restore the send flow state
        const { useSendFlowStore: sendStore } = await import('../stores/sendFlowStore');
        sendStore.getState().setSendAmount(persistedState.sendAmount);
        sendStore.getState().setSendRecipient(persistedState.sendRecipient);
        if (persistedState.cashuUnit === 'sat') {
          sendStore.getState().setSendAssetType('btc');
          sendStore.getState().setBtcTurboEnabled(true);
        } else {
          sendStore.getState().setSendAssetType('unit');
          sendStore.getState().setTurboEnabled(true);
        }

        // Navigate to TurboProcessing after a short delay to ensure navigation is ready
        timeoutId = setTimeout(() => {
          logger.info('[RootNavigator] Resuming pending turbo transaction', {
            amount: persistedState.sendAmount,
            recipient: persistedState.sendRecipient,
            cashuUnit: persistedState.cashuUnit,
          });
          navigationRef.current?.navigate('SendFlow', {
            screen: 'TurboProcessing',
            params: { cashuUnit: persistedState.cashuUnit },
          });
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
  }, [
    isAuthenticated,
    shouldShowAuth,
    shouldShowPinOverlay,
    shouldShowLockOverlay,
    loadPersistedState,
    wallet?.taprootAddress,
  ]);

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
      const rootRouteNames = navigationRef.current.getRootState()?.routeNames ?? [];
      if (rootRouteNames.includes('Main')) {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }
    }

    // Lock the app
    clearSessionMnemonic();
    setShowFaceIdButton(false);
    setIsAuthenticated(false);
  }, [
    setIsAuthenticated,
    setShowFaceIdButton,
    dismissSnackbar,
    hidePasskeyMigrationPrompt,
    hideBiometricSetupPrompt,
    setShowAirdropModal,
  ]);

  // Handle biometric authentication with proper post-auth flow
  const handleBiometricAuth = useCallback(async () => {
    logger.debug('[RootNavigator] handleBiometricAuth called', {
      biometricEnabled,
      isBiometricSupported,
    });
    try {
      if (biometricEnabled) {
        const result = await authenticateWithBiometrics('Authenticate to unlock wallet', 'Use PIN');

        if (result.success) {
          if (!(await hasAccessibleMnemonic())) {
            logger.warn(
              '[RootNavigator] Face ID succeeded but wallet secret is unavailable; requiring PIN'
            );
            setShowFaceIdButton(false);
            return;
          }

          setIsAuthenticated(true);
          handleLockScreenAuthenticatedWrapper();
        }
      } else {
        Alert.alert('Use PIN', 'Unlock with your PIN first, then enable Face ID in settings.');
      }
    } catch (error) {
      logger.error('[RootNavigator] Biometric auth error:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    biometricEnabled,
    isBiometricSupported,
    setIsAuthenticated,
    setShowFaceIdButton,
    handleLockScreenAuthenticatedWrapper,
  ]);

  // Reset wallet from lock screen — escape hatch when user cannot authenticate
  const handleResetWalletFromLockScreen = useCallback(async () => {
    logger.warn('[RootNavigator] Wallet reset from lock screen initiated');
    try {
      await performFullWalletReset({
        resetWallet,
        resetAuth,
        setSeedConfirmed,
      });
      analytics.track('wallet_reset_from_lock_screen');
      analytics.reset();
    } catch (error) {
      logger.error('[RootNavigator] Failed to reset wallet from lock screen', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [resetWallet, resetAuth, setSeedConfirmed]);

  // Set up app lifecycle (inactivity timer, app state changes)
  const { resetInactivityTimer } = useAppLifecycle({
    isAuthenticated,
    walletExists,
    seedConfirmedRef,
    isBiometricSupported,
    biometricEnabled,
    isProcessing: walletOperationIsProcessing,
    inactivityTimeoutMs: settingsHandlers.autoLockTimeoutMs,
    onLock: handleLock,
    onAuthenticateUser: handleBiometricAuth,
  });

  const handleRootTouchStart = useCallback(() => {
    if (
      !isAuthenticated ||
      shouldShowAuth ||
      shouldShowLockOverlay ||
      pendingInactivityResetRef.current
    ) {
      return;
    }

    pendingInactivityResetRef.current = true;
    requestAnimationFrame(() => {
      pendingInactivityResetRef.current = false;
      resetInactivityTimer();
    });
  }, [isAuthenticated, resetInactivityTimer, shouldShowAuth, shouldShowLockOverlay]);

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

  useEffect(() => {
    if (
      !isAuthenticated ||
      !wallet ||
      shouldShowAuth ||
      shouldShowPinOverlay ||
      shouldShowLockOverlay ||
      showPasskeyMigrationModal ||
      showBiometricSetupModal
    ) {
      return;
    }

    settingsHandlers.handleOnboardingNotificationsPrompt().catch((error: unknown) => {
      logger.warn('[RootNavigator] Failed to show onboarding notification prompt', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, [
    isAuthenticated,
    settingsHandlers,
    shouldShowAuth,
    shouldShowLockOverlay,
    shouldShowPinOverlay,
    showBiometricSetupModal,
    showPasskeyMigrationModal,
    wallet,
  ]);

  return (
    <View
      style={styles.container}
      onTouchStart={shouldShowLockOverlay || shouldShowAuth ? undefined : handleRootTouchStart}
    >
      <NavigationContainer
        linking={linking}
        ref={navigationRef}
        onStateChange={onNavigationStateChange}
        theme={DUCAT_NAVIGATION_THEME}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: COLORS.DARK_BG },
            animation: 'none',
          }}
        >
          {shouldShowAuth ? (
            <Stack.Screen name="Auth" component={AuthStack} />
          ) : shouldShowLockOverlay ? (
            <Stack.Screen name="LockScreen">
              {() => (
                <LockScreenRoute
                  onAuthenticated={handleLockScreenAuthenticatedWrapper}
                  showFaceIdButton={isBiometricSupported && showFaceIdButton}
                  onFaceIdPress={handleBiometricAuth}
                  onResetWallet={handleResetWalletFromLockScreen}
                />
              )}
            </Stack.Screen>
          ) : (
            <React.Fragment>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="WalletFlow" options={rootFlowOptions}>
                {() => <WalletStackNavigator redirectHomeToMain />}
              </Stack.Screen>
              <Stack.Screen
                name="LiquidationFlow"
                component={LiquidationFlowScreen}
                options={rootFlowOptions}
              />
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
                options={bubbleZoomOptions}
              />
              <Stack.Screen
                name="DepositFlow"
                component={DepositNavigator}
                options={bubbleZoomOptions}
              />
              <Stack.Screen
                name="RepayFlow"
                component={RepayNavigator}
                options={bubbleZoomOptions}
              />
              <Stack.Screen
                name="WithdrawFlow"
                component={WithdrawNavigator}
                options={bubbleZoomOptions}
              />
              {ENABLE_QUANTA_REWARDS && (
                <Stack.Screen
                  name="QuantaSeedPhraseGuide"
                  component={QuantaSeedPhraseGuideScreen}
                  options={rootFlowOptions}
                />
              )}
              {__DEV__ && (
                <Stack.Screen
                  name="VaultSuccessPreview"
                  component={VaultSuccessPreviewScreen}
                  options={{ presentation: 'modal' }}
                />
              )}
            </React.Fragment>
          )}
        </Stack.Navigator>

        {/* PIN Change Overlay */}
        {shouldShowPinOverlay && (
          <PinChangeOverlay
            isBiometricSupported={isBiometricSupported}
            onPinSetupComplete={handlePinSetupCompleteWrapper}
            onPinChangeComplete={handlePinChangeCompleteWrapper}
            onCancel={handleCancelPinChange}
            fetchBalance={fetchBalance}
            showToast={showToast}
          />
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

        {/* Token Verification Loading Overlay */}
        {isVerifyingToken && <TokenVerificationOverlay />}
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
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
  lockScreenContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
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
