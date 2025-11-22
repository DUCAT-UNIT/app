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
import EcashThresholdSheet from '../components/settings/EcashThresholdSheet';
import EcashConversionModal from '../components/settings/EcashConversionModal';

// Contexts
import { useWallet } from '../contexts/WalletContext';
import { useSendFlow } from '../contexts/SendFlowContext';
import { useTransactionExecution } from '../contexts/TransactionExecutionContext';
import { useVault } from '../contexts/VaultContext';
import { useOnboardingFlow } from '../contexts/AuthContext';
import { useNavigationHandlers } from '../contexts/NavigationHandlersContext';
import { useNotifications } from "../contexts/NotificationContext";
import { useBalance } from '../contexts/WalletDataContext';
import { useCashu } from '../contexts/CashuContext';

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
  const { runesBalance } = useBalance();
  const { balance: cashuBalance } = useCashu();
  const styles = require('../styles').default;

  // Ecash threshold management state
  const [showThresholdSheet, setShowThresholdSheet] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [pendingThreshold, setPendingThreshold] = useState(null);
  const [conversionAmount, setConversionAmount] = useState(0);
  const [savedUnitBalance, setSavedUnitBalance] = useState(0);
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
  const { toasts, showToast, snackbar, dismissSnackbar, showSnackbar } = useNotifications();

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

  // Ecash threshold handlers
  const handleEcashThresholdPress = () => {
    setShowThresholdSheet(true);
  };

  const handleThresholdSelect = async (newThreshold) => {
    setShowThresholdSheet(false);

    // If selecting same threshold or 100, just update
    if (newThreshold === settingsHandlers.ecashThreshold || newThreshold === 100) {
      await settingsHandlers.handleEcashThresholdChange(newThreshold);
      return;
    }

    // Check if we need to convert more ecash
    const currentEcashBalance = cashuBalance || 0;
    // runesBalance is an array: [[runeId, amount], ...]
    const currentUnitBalance = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;
    const requiredAmount = newThreshold === Infinity ? 0 : newThreshold;

    if (requiredAmount > currentEcashBalance && requiredAmount > 0) {
      // Need to convert more
      const amountNeeded = requiredAmount - currentEcashBalance;

      // Check if we have enough UNIT balance
      const actualConversionAmount = Math.min(amountNeeded, currentUnitBalance);

      console.log('[WalletPage] Setting conversion modal state:', {
        currentUnitBalance,
        amountNeeded,
        actualConversionAmount,
        runesBalance,
      });

      setPendingThreshold(newThreshold);
      setConversionAmount(actualConversionAmount);
      setSavedUnitBalance(currentUnitBalance);
      setShowConversionModal(true);
    } else {
      // No conversion needed, just update threshold
      await settingsHandlers.handleEcashThresholdChange(newThreshold);
    }
  };

  const handleConfirmConversion = async () => {
    console.log('[WalletPage] handleConfirmConversion called', {
      conversionAmount,
      pendingThreshold,
    });

    setShowConversionModal(false);

    // Update threshold first
    await settingsHandlers.handleEcashThresholdChange(pendingThreshold);

    // Navigate to mint flow (similar to Spectre mint flow)
    try {
      console.log('[WalletPage] Importing requestMint...');
      const { requestMint } = await import('../services/cashu/cashuWalletService');

      console.log('[WalletPage] Requesting mint quote for amount:', conversionAmount);
      // Request mint quote for the needed amount
      const mintQuote = await requestMint(conversionAmount);
      console.log('[WalletPage] Received mint quote:', mintQuote);

      console.log('[WalletPage] Navigating to Processing screen');
      console.log('[WalletPage] Navigation object available:', !!navigation);
      console.log('[WalletPage] showSettings:', showSettings);

      // Close modals first
      setShowConversionModal(false);
      setShowThresholdSheet(false);

      // Close settings panel
      if (showSettings) {
        console.log('[WalletPage] Closing settings before navigation');
        closeSettings();
      }

      // Use setTimeout to ensure settings close animation completes
      setTimeout(() => {
        console.log('[WalletPage] Attempting navigation now...');
        console.log('[WalletPage] conversionAmount:', conversionAmount, 'type:', typeof conversionAmount);
        const amountStr = conversionAmount?.toString() || '0';
        console.log('[WalletPage] amountStr:', amountStr);

        try {
          navigation.navigate('SendFlow', {
            screen: 'Processing',
            params: {
              fromScreen: 'Settings',
              action: 'create_intent',
              cashuMint: true,
              quoteId: mintQuote.quoteId,
              assetType: 'unit',
              amount: amountStr,
              recipient: mintQuote.depositAddress,
            },
          });
          console.log('[WalletPage] Navigation call completed');
        } catch (navError) {
          console.error('[WalletPage] Navigation error:', navError);
          showToast('Navigation failed: ' + navError.message, 'error');
        }
      }, 500);
    } catch (error) {
      console.error('[WalletPage] Failed to initiate mint:', error);
      showToast('Failed to start conversion: ' + error.message, 'error');
    }
  };

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
              onAssetPress={(assetType) => navigation.navigate('AssetDetail', { assetType, advancedMode: settingsHandlers.advancedMode })}
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
          advancedMode={settingsHandlers.advancedMode}
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
          onLockWallet={settingsHandlers.handleLogout}
          onViewPreferences={() => {
            navigation.navigate('Preferences', {
              onClose: () => navigation.goBack(),
              onShowZeroAssetsToggle: settingsHandlers.handleShowZeroAssetsToggle,
              onNotificationsToggle: settingsHandlers.handleNotificationsToggle,
              showZeroAssets: settingsHandlers.showZeroAssets,
              notificationsEnabled: settingsHandlers.notificationsEnabled,
            });
          }}
          onViewSecurity={() => {
            navigation.navigate('Security', {
              onClose: () => navigation.goBack(),
              onFaceIdToggle: settingsHandlers.handleFaceIdToggle,
              onChangePin: settingsHandlers.handleChangePin,
              onAutoLockToggle: () => {
                // TODO: Implement auto lock toggle
                console.log('Auto lock toggle pressed');
              },
              onViewSeedPhrase: settingsHandlers.handleViewSeedPhrase,
              onDeleteWallet: settingsHandlers.handleDeleteWallet,
              faceIdEnabled: biometricEnabled,
              autoLockEnabled: false,
            });
          }}
          onViewAdvanced={() => {
            navigation.navigate('Advanced', {
              onClose: () => navigation.goBack(),
              onSwitchAccount: () => {
                navigation.goBack();
                setShowAccountPicker(true);
              },
              onAdvancedModeToggle: settingsHandlers.handleAdvancedModeToggle,
              onEcashThresholdPress: handleEcashThresholdPress,
              advancedMode: settingsHandlers.advancedMode,
            });
          }}
          onViewCashuSettings={() => {
            navigation.navigate('CashuSettings', {
              onClose: () => navigation.goBack(),
              onClearCashuCache: settingsHandlers.handleClearCashuCache,
              onRecoverLockedChange: settingsHandlers.handleRecoverLockedChange,
              onClearLockedTokens: settingsHandlers.handleClearLockedTokens,
              onRecoverMint: () => {
                navigation.goBack();
                navigation.navigate('RecoverMint');
              },
              onRedeemToken: () => {
                navigation.goBack();
                navigation.navigate('CashuReceive');
              },
              onRemoveSpentProofs: async () => {
                try {
                  const { removeSpentProofs } = await import('../services/cashu/cashuWalletService');
                  const result = await removeSpentProofs();
                  Alert.alert(
                    'Spent Proofs Removed',
                    `Removed ${result.removed} spent proofs. Kept ${result.kept} valid proofs.`
                  );
                } catch (error) {
                  Alert.alert('Error', `Failed to remove spent proofs: ${error.message}`);
                }
              },
            });
          }}
          onViewAbout={() => {
            navigation.navigate('About', {
              onClose: () => navigation.goBack(),
            });
          }}
        />
      </Animated.View>

      {/* Snackbar - Rendered outside main container at the top */}
      {snackbar && (
        <Snackbar
          params={snackbar}
          onClose={dismissSnackbar}
        />
      )}

      {/* Ecash Threshold Selection Sheet */}
      <EcashThresholdSheet
        visible={showThresholdSheet}
        onClose={() => setShowThresholdSheet(false)}
        onSelectThreshold={handleThresholdSelect}
        currentThreshold={settingsHandlers.ecashThreshold || 100}
      />

      {/* Ecash Conversion Confirmation Modal */}
      <EcashConversionModal
        visible={showConversionModal}
        onClose={() => setShowConversionModal(false)}
        onConfirm={handleConfirmConversion}
        amountToConvert={conversionAmount}
        unitBalance={savedUnitBalance}
        newThreshold={pendingThreshold || 100}
      />
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
