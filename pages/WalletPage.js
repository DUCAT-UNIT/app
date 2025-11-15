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
import WalletScreen from '../screens/wallet/WalletScreen';
import ReceiveScreen from '../screens/wallet/ReceiveScreen';
import TransactionHistoryScreen from '../screens/wallet/TransactionHistoryScreen';
import VaultScreen from '../screens/wallet/VaultScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import BottomNavigationBar from '../components/BottomNavigationBar';
import ToastContainer from '../components/ToastContainer';
import SplashScreen from '../screens/SplashScreen';
import Snackbar from '../components/Snackbar';

// Contexts
import { useWallet } from '../contexts/WalletContext';
import { useBalance as _useBalance } from '../contexts/WalletDataContext';
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
import { COLORS } from '../theme';
import { logger } from '../utils/logger';

export default function WalletPage({ route }) {
  const navigation = useNavigation();

  // Consume contexts instead of props
  const { activeTab, setActiveTab, vaultCredentials, autoCreateVaultTrigger, openVault } =
    useVault();
  const { resetInactivityTimer } = useOnboardingFlow();
  const { settingsHandlers, biometricEnabled, setShowAccountPicker } = useNavigationHandlers();
  const styles = require('../styles').default;
  // Wallet context
  const { wallet } = useWallet();
  const { vaultData } = require('../contexts/WalletDataContext').useVaultData();

  // Transaction contexts
  const {
    intentStep,
    sendAssetType,
    sendAddressType,
  } = useSendFlow();

  const { broadcastedTxid } = useTransactionExecution();

  // Toast and Snackbar context
  const { toasts, showToast, snackbar, dismissSnackbar, showSnackbar } = useToastContext();

  // Debug: Log snackbar state changes
  React.useEffect(() => {
    logger.debug('🎯 WalletPage snackbar state:', snackbar);
  }, [snackbar]);

  // Show snackbar for transaction states
  React.useEffect(() => {
    if (!broadcastedTxid) return;

    const action = sendAssetType === 'unit' ? 'swap' : 'withdraw';
    const clickAction = async () => {
      const { getTxUrl, getOrdTxUrl } = require('../utils/constants');
      const { Linking } = require('react-native');
      const url = sendAssetType === 'unit' ? getOrdTxUrl(broadcastedTxid) : getTxUrl(broadcastedTxid);
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    };

    if (intentStep === 'pending') {
      // Step 1: Green check mark - "submitted" (transaction broadcast to network)
      showSnackbar({
        type: 'submitted',
        action,
        txid: broadcastedTxid,
        clickAction,
      });
    } else if (intentStep === 'confirmed') {
      // Step 2: Green check mark - "completed successfully!" (transaction confirmed)
      showSnackbar({
        type: 'success',
        action,
        txid: broadcastedTxid,
        clickAction,
      });
    }
  }, [intentStep, broadcastedTxid, sendAssetType, showSnackbar]);

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

  // Handle navigation param to open receive sheet
  React.useEffect(() => {
    if (route?.params?.openReceive) {
      setShowReceiveSheet(true);
      // Clear the param after opening
      navigation.setParams({ openReceive: false });
    }
  }, [route?.params?.openReceive, setShowReceiveSheet, navigation]);

  // Vault swipe animation state
  const vaultTranslateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current; // Start on left
  const walletTranslateX = useRef(new Animated.Value(0)).current;
  const [isSwiping, setIsSwiping] = useState(false);
  const isAnimatingRef = useRef(false);

  // Keep positions in sync with activeTab - runs on mount and whenever activeTab changes
  React.useEffect(() => {
    // Don't interfere with swipe animations
    if (isSwiping || isAnimatingRef.current) return;

    if (activeTab === 'vault') {
      // Vault is active - wallet should be off screen right, vault centered
      walletTranslateX.setValue(SCREEN_WIDTH);
      vaultTranslateX.setValue(0);
    } else {
      // Wallet is active - wallet centered, vault off screen left
      walletTranslateX.setValue(0);
      vaultTranslateX.setValue(-SCREEN_WIDTH);
    }
  }, [activeTab, isSwiping, walletTranslateX, vaultTranslateX]);

  // Pan responder for wallet screen - right swipe to reveal vault
  const walletPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only activate for horizontal swipes on wallet screen
        if (activeTab !== 'wallet') return false;
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const hasMinimumMovement = Math.abs(gestureState.dx) > 20; // Increased from 10 for less sensitivity
        return isHorizontal && hasMinimumMovement;
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

        // Determine if we should complete the transition based on:
        // 1. Distance (30% threshold instead of 50%)
        // 2. Velocity (fast swipes trigger easier)
        const swipeDistance = gestureState.dx;
        const swipeVelocity = gestureState.vx;
        const distanceThreshold = SCREEN_WIDTH * 0.3;
        const velocityThreshold = 0.5;

        const shouldComplete =
          swipeDistance > distanceThreshold || swipeVelocity > velocityThreshold;

        if (shouldComplete) {
          isAnimatingRef.current = true;
          // Complete animation to vault - wallet moves right off screen, vault moves to center
          Animated.parallel([
            Animated.spring(walletTranslateX, {
              toValue: SCREEN_WIDTH,
              velocity: swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
            Animated.spring(vaultTranslateX, {
              toValue: 0,
              velocity: swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
          ]).start(() => {
            openVault();
            isAnimatingRef.current = false;
          });
        } else {
          // Spring back to original position
          Animated.parallel([
            Animated.spring(walletTranslateX, {
              toValue: 0,
              velocity: -swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
            Animated.spring(vaultTranslateX, {
              toValue: -SCREEN_WIDTH,
              velocity: -swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // Pan responder for vault screen - left swipe to go back to wallet
  // Now only attached to the edge area, so simplified logic
  const vaultPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Since this is only on the edge, we can be more permissive
        const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const hasMovement = Math.abs(gestureState.dx) > 10;
        const isLeftSwipe = gestureState.dx < -10;
        return isHorizontal && isLeftSwipe && hasMovement;
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

        // Determine if we should complete the transition based on:
        // 1. Distance (30% threshold instead of 50%)
        // 2. Velocity (fast swipes trigger easier)
        const swipeDistance = Math.abs(gestureState.dx);
        const swipeVelocity = Math.abs(gestureState.vx);
        const distanceThreshold = SCREEN_WIDTH * 0.3;
        const velocityThreshold = 0.5;

        const shouldComplete =
          swipeDistance > distanceThreshold || swipeVelocity > velocityThreshold;

        if (shouldComplete) {
          isAnimatingRef.current = true;
          // Complete animation to wallet - vault moves left off screen, wallet moves to center
          Animated.parallel([
            Animated.spring(vaultTranslateX, {
              toValue: -SCREEN_WIDTH,
              velocity: -swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
            Animated.spring(walletTranslateX, {
              toValue: 0,
              velocity: -swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setActiveTab('wallet');
            isAnimatingRef.current = false;
          });
        } else {
          // Spring back to original position
          Animated.parallel([
            Animated.spring(vaultTranslateX, {
              toValue: 0,
              velocity: swipeVelocity,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            }),
            Animated.spring(walletTranslateX, {
              toValue: SCREEN_WIDTH,
              velocity: swipeVelocity,
              tension: 65,
              friction: 10,
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
            <VaultScreen
              visible={activeTab === 'vault'}
              walletCredentials={vaultCredentials}
              autoCreateVaultTrigger={autoCreateVaultTrigger}
              vaultData={vaultData}
              showSnackbar={showSnackbar}
            />
            {/* Edge swipe detection area - only on the right edge */}
            {activeTab === 'vault' && (
              <View
                style={localStyles.rightEdgeSwipeArea}
                {...vaultPanResponder.panHandlers}
              />
            )}
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
              onAssetPress={(assetType) => navigation.navigate('AssetDetail', { assetType })}
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

      {/* Snackbar - Rendered outside main container at the top */}
      {snackbar && (
        <Snackbar
          params={snackbar}
          onClose={dismissSnackbar}
        />
      )}
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
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.DARK_BG,
    zIndex: 1000,
  },
  rightEdgeSwipeArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 30, // 30px invisible strip on the right edge
    backgroundColor: 'transparent',
    zIndex: 10, // Above the WebView content
  },
});
