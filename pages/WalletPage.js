/**
 * WalletPage - Main wallet interface after authentication
 * Contains wallet screen, vault, settings, and transaction flows
 */

import React, { useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions, PanResponder } from 'react-native';
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

  // Keep positions in sync with activeTab
  React.useEffect(() => {
    if (!isSwiping) {
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
          // Complete animation to vault - wallet moves right off screen, vault moves to center
          Animated.parallel([
            Animated.spring(walletTranslateX, {
              toValue: SCREEN_WIDTH,
              useNativeDriver: true,
              tension: 65,
              friction: 11,
            }),
            Animated.spring(vaultTranslateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 65,
              friction: 11,
            }),
          ]).start(() => {
            openVault();
            // Don't reset - let useEffect handle positioning based on activeTab
          });
        } else {
          // Spring back to original position
          Animated.parallel([
            Animated.spring(walletTranslateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 65,
              friction: 11,
            }),
            Animated.spring(vaultTranslateX, {
              toValue: -SCREEN_WIDTH,
              useNativeDriver: true,
              tension: 65,
              friction: 11,
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
          // Complete animation to wallet - vault moves left off screen, wallet moves to center
          Animated.parallel([
            Animated.spring(vaultTranslateX, {
              toValue: -SCREEN_WIDTH,
              useNativeDriver: true,
              tension: 65,
              friction: 11,
            }),
            Animated.spring(walletTranslateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 65,
              friction: 11,
            }),
          ]).start(() => {
            setActiveTab('wallet');
            // Don't reset - let useEffect handle positioning based on activeTab
          });
        } else {
          // Spring back to original position
          Animated.parallel([
            Animated.spring(vaultTranslateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 65,
              friction: 11,
            }),
            Animated.spring(walletTranslateX, {
              toValue: SCREEN_WIDTH,
              useNativeDriver: true,
              tension: 65,
              friction: 11,
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
        {/* Animated Vault Screen - Rendered first (below wallet) */}
        <Animated.View
          style={[
            localStyles.vaultContainer,
            {
              transform: [{ translateX: vaultTranslateX }],
            },
          ]}
          pointerEvents={activeTab === 'vault' || isSwiping ? 'auto' : 'none'}
        >
          <View style={localStyles.screenContent}>
            <MutinynetBanner />
            <View style={localStyles.vaultContent}>
              <VaultScreen
                visible={activeTab === 'vault'}
                walletCredentials={vaultCredentials}
                autoCreateVaultTrigger={autoCreateVaultTrigger}
              />
              {/* Transparent swipe overlay for vault screen */}
              {activeTab === 'vault' && (
                <View style={localStyles.swipeOverlay} {...vaultPanResponder.panHandlers} />
              )}
            </View>
            <BottomNavigationBar
              activeTab={activeTab}
              onVaultPress={openVault}
              onWalletPress={() => setActiveTab('wallet')}
            />
          </View>
        </Animated.View>

        {/* Animated Wallet Screen - Rendered second (above vault) */}
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
          <View style={localStyles.screenContent}>
            <MutinynetBanner />
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
            <BottomNavigationBar
              activeTab={activeTab}
              onVaultPress={openVault}
              onWalletPress={() => setActiveTab('wallet')}
            />
          </View>
        </Animated.View>

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
  vaultContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1,
  },
  screenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 2,
  },
  screenContent: {
    flex: 1,
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
