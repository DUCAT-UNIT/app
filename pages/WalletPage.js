/**
 * WalletPage - Main wallet interface after authentication
 * Contains wallet screen, vault, settings, and transaction flows
 */

import React, { useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions, PanResponder, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Components
import WalletScreen from '../components/WalletScreen';
import ReceiveScreen from '../components/ReceiveScreen';
import TransactionHistoryScreen from '../components/TransactionHistoryScreen';
import VaultScreen from '../components/VaultScreen';
import SettingsScreen from '../components/SettingsScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import BottomNavigationBar from '../components/BottomNavigationBar';
import ToastContainer from '../components/ToastContainer';
import TransactionToast from '../components/TransactionToast';
import SplashScreen from '../components/SplashScreen';

// Contexts
import { useWallet } from '../contexts/WalletContext';
import { useBalance } from '../contexts/WalletDataContext';
import { useSendFlow } from '../contexts/SendFlowContext';
import { useTransactionExecution } from '../contexts/TransactionExecutionContext';
import { useVault } from '../contexts/VaultContext';
import { useOnboardingFlow } from '../contexts/AuthContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useToastContext } from '../contexts/UIContext';

// Hooks
import { useSettingsNavigation } from '../hooks/useSettingsNavigation';
import { useSheetNavigation } from '../hooks/useSheetNavigation';

// Utils
import { COLORS } from '../utils/colors';

export default function WalletPage() {
  const navigation = useNavigation();

  // Consume contexts instead of props
  const { activeTab, setActiveTab, vaultCredentials, autoCreateVaultTrigger, openVault } =
    useVault();
  const { resetInactivityTimer } = useOnboardingFlow();
  const { settingsHandlers, biometricEnabled, setShowAccountPicker } = useNavigationHandlers();
  const styles = require('../styles').default;
  // Wallet context
  const { wallet } = useWallet();
  const { segwitBalance, runesBalance, btcPrice } = useBalance();
  const { vaultData } = require('../contexts/WalletDataContext').useVaultData();

  // Transaction contexts
  const {
    intentStep,
    sendAssetType,
    sendAmount,
    sendAddressType,
    setIntentStep,
  } = useSendFlow();

  const { broadcastedTxid, toastDismissed, setToastDismissed } = useTransactionExecution();

  // Toast context
  const { toasts, showToast } = useToastContext();

  // Navigation hooks
  const {
    showSettings,
    hasCheckedInitialFlags,
    settingsTranslateX,
    settingsOpacity,
    settingsPanResponderRef,
    openSettings,
    closeSettings,
  } = useSettingsNavigation();

  const { showReceiveSheet, setShowReceiveSheet, showTxHistory, setShowTxHistory } =
    useSheetNavigation();

  // Vault swipe animation state
  const vaultTranslateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current; // Start on left
  const walletTranslateX = useRef(new Animated.Value(0)).current;
  const [isSwiping, setIsSwiping] = useState(false);
  const isAnimatingRef = useRef(false);
  const lastActiveTabRef = useRef(activeTab);

  // Keep positions in sync with activeTab - but only when clicking nav buttons, not after swipe
  React.useEffect(() => {
    // Only update positions if tab changed via button press (not swipe) and not currently animating
    if (activeTab !== lastActiveTabRef.current && !isSwiping && !isAnimatingRef.current) {
      if (activeTab === 'vault') {
        // Vault is active - wallet should be off screen right, vault centered
        walletTranslateX.setValue(SCREEN_WIDTH);
        vaultTranslateX.setValue(0);
      } else {
        // Wallet is active - wallet centered, vault off screen left
        walletTranslateX.setValue(0);
        vaultTranslateX.setValue(-SCREEN_WIDTH);
      }
    }
    lastActiveTabRef.current = activeTab;
  }, [activeTab, isSwiping, walletTranslateX, vaultTranslateX]);

  // Pan responder for wallet screen - right swipe to reveal vault
  const walletPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only activate for horizontal swipes on wallet screen
        if (activeTab !== 'wallet') return false;
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        setIsSwiping(true);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow right swipe (positive dx) - wallet moves right, vault reveals from left
        if (gestureState.dx > 0) {
          walletTranslateX.setValue(gestureState.dx);
          vaultTranslateX.setValue(-SCREEN_WIDTH + gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsSwiping(false);

        // If swiped more than 50% of screen width, complete the transition
        if (gestureState.dx > SCREEN_WIDTH * 0.5) {
          isAnimatingRef.current = true;
          // Complete animation to vault - wallet moves right off screen, vault moves to center
          Animated.parallel([
            Animated.timing(walletTranslateX, {
              toValue: SCREEN_WIDTH,
              duration: 300,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(vaultTranslateX, {
              toValue: 0,
              duration: 300,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start(() => {
            openVault();
            isAnimatingRef.current = false;
          });
        } else {
          // Spring back to original position
          Animated.parallel([
            Animated.timing(walletTranslateX, {
              toValue: 0,
              duration: 250,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(vaultTranslateX, {
              toValue: -SCREEN_WIDTH,
              duration: 250,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // Pan responder for vault screen - left swipe to go back to wallet
  const vaultPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false, // Don't capture at start, let WebView handle taps
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only activate for clear horizontal left swipes on vault screen
        if (activeTab !== 'vault') return false;
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const isLeftSwipe = gestureState.dx < -10;
        return isHorizontal && isLeftSwipe;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        // Capture horizontal swipes, let vertical scrolls pass through
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const isLeftSwipe = gestureState.dx < -10;
        return isHorizontal && isLeftSwipe;
      },
      onPanResponderGrant: () => {
        setIsSwiping(true);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow left swipe (negative dx) - vault moves left, wallet reveals from right
        if (gestureState.dx < 0) {
          vaultTranslateX.setValue(gestureState.dx);
          walletTranslateX.setValue(SCREEN_WIDTH + gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsSwiping(false);

        // If swiped more than 50% of screen width, complete the transition
        if (gestureState.dx < -SCREEN_WIDTH * 0.5) {
          isAnimatingRef.current = true;
          // Complete animation to wallet - vault moves left off screen, wallet moves to center
          Animated.parallel([
            Animated.timing(vaultTranslateX, {
              toValue: -SCREEN_WIDTH,
              duration: 300,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(walletTranslateX, {
              toValue: 0,
              duration: 300,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start(() => {
            setActiveTab('wallet');
            isAnimatingRef.current = false;
          });
        } else {
          // Spring back to original position
          Animated.parallel([
            Animated.timing(vaultTranslateX, {
              toValue: 0,
              duration: 250,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(walletTranslateX, {
              toValue: SCREEN_WIDTH,
              duration: 250,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // Show splash screen until we've checked flags to prevent flicker
  if (!hasCheckedInitialFlags) {
    return <SplashScreen />;
  }

  return (
    <>
      <View style={localStyles.container} onTouchStart={resetInactivityTimer}>
        {/* Fixed Mutinynet Banner */}
        <MutinynetBanner />

        {/* Content area - slides without banner and navigation bar */}
        <View style={localStyles.contentArea}>
          {/* Animated Vault Content - Rendered first (below wallet) */}
          <Animated.View
            style={[
              localStyles.vaultContainer,
              {
                transform: [{ translateX: vaultTranslateX }],
              },
            ]}
            pointerEvents={activeTab === 'vault' || isSwiping ? 'auto' : 'none'}
          >
            <View style={localStyles.vaultContent}>
              <VaultScreen
                visible={activeTab === 'vault'}
                walletCredentials={vaultCredentials}
                autoCreateVaultTrigger={autoCreateVaultTrigger}
                vaultData={vaultData}
              />
              {/* Transparent swipe overlay for vault screen */}
              {activeTab === 'vault' && (
                <View style={localStyles.swipeOverlay} {...vaultPanResponder.panHandlers} />
              )}
            </View>
          </Animated.View>

          {/* Animated Wallet Content - Rendered second (above vault) */}
          <Animated.View
            style={[
              localStyles.screenContainer,
              {
                transform: [{ translateX: walletTranslateX }],
              },
            ]}
            pointerEvents={activeTab === 'wallet' && !isSwiping ? 'auto' : 'none'}
            {...walletPanResponder.panHandlers}
          >
            <WalletScreen
              styles={styles}
              onSendPress={() => navigation.navigate('SendFlow', { screen: 'AssetSelector' })}
              onReceivePress={() => setShowReceiveSheet(true)}
              onHistoryPress={() => setShowTxHistory(true)}
              onSettingsPress={openSettings}
              onCreateVaultPress={() => openVault(true)}
              onVaultPress={openVault}
              sendAddressType={sendAddressType}
              switchingAccount={false}
              showZeroAssets={settingsHandlers.showZeroAssets}
            />
          </Animated.View>
        </View>

        {/* Fixed Bottom Navigation */}
        <BottomNavigationBar
          activeTab={activeTab}
          onVaultPress={openVault}
          onWalletPress={() => setActiveTab('wallet')}
        />

        {/* Receive Bottom Sheet */}
        <ReceiveScreen
          styles={styles}
          showReceiveSheet={showReceiveSheet}
          onClose={() => setShowReceiveSheet(false)}
          segwitAddress={wallet?.segwitAddress || ''}
          taprootAddress={wallet?.taprootAddress || ''}
          showToast={showToast}
        />

        {/* Transaction History Bottom Sheet */}
        <TransactionHistoryScreen
          styles={styles}
          showHistorySheet={showTxHistory}
          onClose={() => setShowTxHistory(false)}
          segwitAddress={wallet?.segwitAddress || ''}
          taprootAddress={wallet?.taprootAddress || ''}
          vaultPubkey={wallet?.taprootPubkey || ''}
        />

        <StatusBar style="light" />

        {/* Toast Notification */}
        <ToastContainer toasts={toasts} />

        {/* Transaction Toast */}
        <TransactionToast
          visible={
            ['pending', 'confirmed'].includes(intentStep) &&
            (intentStep === 'confirmed' || !toastDismissed)
          }
          status={intentStep}
          message={
            intentStep === 'pending'
              ? 'Transaction pending...'
              : intentStep === 'confirmed'
                ? 'Transaction mined!'
                : ''
          }
          txid={broadcastedTxid}
          assetType={sendAssetType === 'unit' ? 'UNIT' : 'BTC'}
          onClose={() => setToastDismissed(true)}
        />
      </View>

      {/* Settings Screen Overlay */}
      <Animated.View
        style={[
          localStyles.settingsOverlay,
          {
            opacity: settingsOpacity,
            transform: [{ translateX: settingsTranslateX }],
          },
        ]}
        pointerEvents={!showSettings ? 'none' : 'auto'}
        {...settingsPanResponderRef.current.panHandlers}
      >
        <MutinynetBanner />
        <SettingsScreen
          onClose={closeSettings}
          onViewSeedPhrase={settingsHandlers.handleViewSeedPhrase}
          onChangePin={settingsHandlers.handleChangePin}
          onSwitchAccount={() => {
            // Don't close settings - modal should overlay settings
            setShowAccountPicker(true);
          }}
          onLockWallet={settingsHandlers.handleLogout}
          onDeleteWallet={settingsHandlers.handleDeleteWallet}
          onFaceIdToggle={settingsHandlers.handleFaceIdToggle}
          onNotificationsToggle={settingsHandlers.handleNotificationsToggle}
          onShowZeroAssetsToggle={settingsHandlers.handleShowZeroAssetsToggle}
          faceIdEnabled={biometricEnabled}
          notificationsEnabled={settingsHandlers.notificationsEnabled}
          showZeroAssets={settingsHandlers.showZeroAssets}
        />
      </Animated.View>
    </>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  contentArea: {
    flex: 1,
    overflow: 'hidden',
  },
  vaultContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1,
    flexDirection: 'column',
  },
  screenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 2,
    flexDirection: 'column',
  },
  vaultContent: {
    flex: 1,
  },
  swipeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1000,
  },
});
