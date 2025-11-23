/**
 * WalletPage - Main wallet interface after authentication
 * Contains wallet screen, vault, settings, and transaction flows
 */

import React, { useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions, PanResponder, Alert } from 'react-native';
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
import EcashThresholdSheet from '../components/settings/EcashThresholdSheet';
import EcashConversionModal from '../components/settings/EcashConversionModal';
import LowEcashBalanceModal from '../components/ecash/LowEcashBalanceModal';
import QRScanner from '../components/scanner/QRScanner';

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
import { useEcashBalanceCheck } from '../hooks/useEcashBalanceCheck';

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
  const { balance: cashuBalance, receive: receiveCashuToken } = useCashu();
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

  // Calculate current UNIT balance for ecash balance check
  const currentUnitBalance = runesBalance && runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0;

  // Low ecash balance check on app start
  const {
    showLowBalanceModal,
    closeModal: closeLowBalanceModal,
    amountNeeded: lowBalanceAmountNeeded,
    currentBalance: lowBalanceCurrentBalance,
    defaultThreshold: lowBalanceDefaultThreshold,
  } = useEcashBalanceCheck(cashuBalance, settingsHandlers.ecashThreshold, currentUnitBalance);

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

  // Handle claim result from TurboClaimingScreen
  React.useEffect(() => {
    logger.debug('🎯 WalletPage claim effect triggered:', {
      claimSuccess: route?.params?.claimSuccess,
      claimError: route?.params?.claimError,
    });

    if (route?.params?.claimSuccess) {
      logger.debug('🎯 WalletPage showing success snackbar for claim');
      showSnackbar({
        type: 'success',
        action: 'claim',
      });
      // Clear the param so it doesn't trigger again
      navigation.setParams({ claimSuccess: undefined });
    } else if (route?.params?.claimError) {
      logger.debug('🎯 WalletPage showing error snackbar for claim');
      showSnackbar({
        type: 'error',
        action: 'claim',
        description: route.params.claimError,
      });
      // Clear the param so it doesn't trigger again
      navigation.setParams({ claimError: undefined });
    }
  }, [route?.params?.claimSuccess, route?.params?.claimError, showSnackbar, navigation]);

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

  // QR Scanner state
  const [showQRScanner, setShowQRScanner] = useState(false);

  // QR Scanner handlers
  const handleQRScan = async (data) => {
    console.log('[WalletPage] QR scanned:', data);
    console.log('[WalletPage] Data length:', data.length);
    console.log('[WalletPage] First 100 chars:', data.substring(0, 100));

    // Handle different types of QR code data
    if (data.startsWith('bitcoin:') || data.startsWith('tb1') || data.startsWith('bc1')) {
      // Bitcoin address - navigate to send flow, then close scanner after delay
      navigation.navigate('SendFlow', {
        screen: 'AddressInput',
        params: { scannedAddress: data },
      });
      requestAnimationFrame(() => setShowQRScanner(false));
    } else if (data.startsWith('cashu')) {
      // Direct Cashu token - check if it's P2PK (Turbo) token
      try {
        // Check if this is a P2PK locked token
        const { hasP2PKProofs } = await import('../services/cashu/cashuP2PK');
        const isP2PKToken = hasP2PKProofs(data);

        if (isP2PKToken) {
          // This is a Turbo token - check if already processed
          console.log('[WalletPage] P2PK token detected, checking if already processed');

          // Check if already processed
          const Crypto = await import('expo-crypto');
          const tokenHash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            data
          );

          if (global.processedCashuTokens && global.processedCashuTokens.has(tokenHash)) {
            console.log('[WalletPage] Token already processed, showing error');
            setShowQRScanner(false);
            showSnackbar({
              type: 'error',
              action: 'swap',
              description: 'Token already claimed',
            });
            return;
          }

          // Store token globally for processing
          console.log('[WalletPage] Processing new token');
          global.pendingCashuToken = data;

          // Close scanner immediately
          setShowQRScanner(false);

          // Trigger the claim process which shows the loading overlay
          if (typeof global.triggerPendingTokenCheck === 'function') {
            setTimeout(() => global.triggerPendingTokenCheck(), 50);
          }
          return;
        }

        // Regular token - check proofs first
        showToast('Checking token...', 'info');

        // Decode and analyze the token
        const { decodeToken } = await import('../services/cashu/cashuCrypto');
        const decoded = decodeToken(data);
        const { proofs, amount } = decoded;

        // Check which proofs are spent
        const { checkProofsSpent } = await import('../services/cashu/cashuMintClient');
        const stateResult = await checkProofsSpent(proofs);

        const spentProofs = stateResult.states.filter(s => s.state !== 'UNSPENT');
        const unspentProofs = proofs.filter((_, idx) =>
          stateResult.states[idx].state === 'UNSPENT'
        );

        const unspentAmount = unspentProofs.reduce((sum, p) => sum + p.amount, 0);

        if (spentProofs.length > 0 && unspentProofs.length === 0) {
          // All proofs spent
          showSnackbar({
            type: 'error',
            action: 'swap',
            description: 'All proofs in this token have been spent',
          });
        } else if (spentProofs.length > 0) {
          // Some proofs spent - ask user
          Alert.alert(
            'Partial Token',
            `This token has ${proofs.length} proofs totaling ${amount} UNIT.\n\n` +
            `${spentProofs.length} proofs (${amount - unspentAmount} UNIT) already spent.\n` +
            `${unspentProofs.length} proofs (${unspentAmount} UNIT) can be claimed.\n\n` +
            `Claim the ${unspentAmount} UNIT?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Claim',
                onPress: async () => {
                  try {
                    showToast('Claiming unspent proofs...', 'info');

                    // Create a new token with only unspent proofs
                    const { encodeToken } = await import('../services/cashu/cashuCrypto');
                    const filteredToken = {
                      token: [{
                        mint: decoded.mint,
                        proofs: unspentProofs
                      }]
                    };
                    const filteredTokenString = encodeToken(filteredToken.token[0].mint, filteredToken.token[0].proofs);

                    const result = await receiveCashuToken(filteredTokenString);
                    showSnackbar({
                      type: 'success',
                      action: 'claim',
                      description: `Successfully claimed ${result.amount} UNIT`,
                    });
                  } catch (error) {
                    console.error('[WalletPage] Claim failed:', error);
                    showSnackbar({
                      type: 'error',
                      action: 'claim',
                      description: `Failed to claim: ${error.message}`,
                    });
                  }
                }
              }
            ]
          );
        } else {
          // All proofs unspent - claim directly
          showToast('Claiming token...', 'info');
          const result = await receiveCashuToken(data);
          showSnackbar({
            type: 'success',
            action: 'claim',
            description: `Successfully claimed ${result.amount} UNIT`,
          });
        }
      } catch (error) {
        console.error('[WalletPage] Token check failed:', error);
        showSnackbar({
          type: 'error',
          action: 'claim',
          description: `Failed to process token: ${error.message}`,
        });
      }
    } else if (data.startsWith('{') || data.startsWith('[')) {
      // JSON proofs format (NUT-16 might provide raw JSON)
      try {
        const parsed = JSON.parse(data);
        console.log('[WalletPage] Parsed JSON:', parsed);

        // If it's already a proper token object with proofs, encode it
        if (parsed.token && Array.isArray(parsed.token)) {
          // This is the token wrapper format - encode it
          const { encodeToken } = await import('../services/cashu/cashuCrypto');
          const encoded = encodeToken(parsed);
          console.log('[WalletPage] Encoded token:', encoded.substring(0, 50));

          showToast('Claiming token...', 'info');
          const result = await receiveCashuToken(encoded);
          showSnackbar({
            type: 'success',
            action: 'claim',
            description: `Successfully claimed ${result.amount} UNIT`,
          });
        } else if (Array.isArray(parsed.proofs) || Array.isArray(parsed)) {
          // Raw proofs array - need to wrap it
          showSnackbar({
            type: 'error',
            action: 'claim',
            description: 'Invalid token format - raw proofs not supported',
          });
        } else {
          showSnackbar({
            type: 'error',
            action: 'claim',
            description: 'Invalid JSON token format',
          });
        }
      } catch (error) {
        console.error('[WalletPage] Failed to parse/claim JSON token:', error);
        showSnackbar({
          type: 'error',
          action: 'claim',
          description: `Failed to claim token: ${error.message}`,
        });
      }
    } else if (data.includes('ducat://turbo/') || data.includes('unit?')) {
      // Turbo URL format - extract and claim token
      try {
        let token = null;

        // Check if this is the ducat://turbo/ format
        const turboMatch = data.match(/ducat:\/\/turbo\/([^\/?#]+)/);
        if (turboMatch && turboMatch[1]) {
          token = turboMatch[1];
          console.log('[WalletPage] Extracted token from ducat:// URL');
        }
        // Check if this is an ID-based link
        else {
          const idMatch = data.match(/[?&]id=([^&]+)/);
          if (idMatch && idMatch[1]) {
            showToast('Fetching token...', 'info');
            const { fetchTokenFromRebrandly } = await import('../services/urlShortener');
            token = await fetchTokenFromRebrandly(idMatch[1]);
            console.log('[WalletPage] Fetched token from Rebrandly');
          }
          // Check if this is a direct token link
          else {
            const tokenMatch = data.match(/[?&]t=([^&]+)/);
            if (tokenMatch && tokenMatch[1]) {
              // Decode URL-safe base64
              let base64Token = tokenMatch[1]
                .replace(/-/g, '+')
                .replace(/_/g, '/');

              // Add padding
              while (base64Token.length % 4) {
                base64Token += '=';
              }

              token = atob(base64Token);
              console.log('[WalletPage] Decoded base64 token');
            }
          }
        }

        if (token) {
          // Navigate to claiming screen
          navigation.navigate('SendFlow', {
            screen: 'TurboClaiming',
            params: { tokenString: token },
          });
        } else {
          showToast('Failed to extract token from URL', 'error');
        }
      } catch (error) {
        console.error('[WalletPage] Failed to extract token:', error);
        showToast(`Failed to extract token: ${error.message}`, 'error');
      }
    } else {
      // Unknown format
      console.log('[WalletPage] Unknown QR format:', data);
      showToast('Unknown QR code format', 'error');
    }
  };

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

    // Navigate to mint flow (similar to Turbo mint flow)
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

  const handleLowBalanceTopUp = async () => {
    console.log('[WalletPage] handleLowBalanceTopUp called', {
      amountNeeded: lowBalanceAmountNeeded,
    });

    closeLowBalanceModal();

    // Navigate to mint flow
    try {
      const { requestMint } = await import('../services/cashu/cashuWalletService');

      // Request mint quote for the needed amount
      const mintQuote = await requestMint(lowBalanceAmountNeeded);
      console.log('[WalletPage] Received mint quote for top-up:', mintQuote);

      const amountStr = lowBalanceAmountNeeded?.toString() || '0';

      // Navigate to processing screen
      navigation.navigate('SendFlow', {
        screen: 'Processing',
        params: {
          fromScreen: 'Wallet',
          action: 'create_intent',
          cashuMint: true,
          quoteId: mintQuote.quoteId,
          assetType: 'unit',
          amount: amountStr,
          recipient: mintQuote.depositAddress,
        },
      });

      // Show snackbar for conversion
      showSnackbar({
        type: 'pending',
        action: 'conversion_turbo',
      });
    } catch (error) {
      console.error('[WalletPage] Failed to initiate top-up:', error);
      showToast('Failed to start top-up: ' + error.message, 'error');
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
              onQRScanPress={() => setShowQRScanner(true)}
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
        {/* <BottomNavigationBar
          activeTab={activeTab}
          onVaultPress={openVault}
          onWalletPress={() => setActiveTab('wallet')}
        /> */}

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

        {/* QR Scanner Modal */}
        <QRScanner
          visible={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScan}
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

      {/* Low Ecash Balance Modal */}
      <LowEcashBalanceModal
        visible={showLowBalanceModal}
        onClose={closeLowBalanceModal}
        onConfirm={handleLowBalanceTopUp}
        currentBalance={lowBalanceCurrentBalance}
        defaultThreshold={lowBalanceDefaultThreshold}
        amountNeeded={lowBalanceAmountNeeded}
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
