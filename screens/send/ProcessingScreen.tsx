/**
 * ProcessingScreen - Full screen for transaction processing
 * Handles: creating intent, signing, broadcasting
 * Features: cycling loading messages, automatic navigation on success/error
 */

import { NavigationProp, RouteProp, StackActions } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { useTransactionExecution } from '../../contexts/TransactionExecutionContext';
import { analytics } from '../../services/analyticsService';
import { TRANSACTION_EVENTS } from '../../constants/analyticsEvents';
import { useNotifications } from '../../stores/notificationStore';
import { useSendFlow, type AssetType } from '../../stores/sendFlowStore';
import { COLORS } from '../../theme';
import { isE2E } from '../../utils/e2e';
import { logger } from '../../utils/logger';
import {
  DEFAULT_CASHU_UNIT,
  normalizeCashuUnit,
  type CashuUnit,
} from '../../services/cashu/cashuUnits';

/**
 * Route parameters for ProcessingScreen
 */
interface ProcessingRouteParams {
  action?: 'create_intent' | 'sign_and_broadcast';
  fromScreen?: string;
  cashuMint?: boolean;
  quoteId?: string;
  isTurbo?: boolean;
  mintQuoteId?: string;
  mintAmount?: number;
  mintClaimAmount?: number;
  turboRecipient?: string;
  senderTaprootAddress?: string;
  cashuUnit?: CashuUnit;
  assetType?: AssetType;
  amount?: string;
  recipient?: string;
}

/**
 * Props for ProcessingScreen
 */
interface ProcessingScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: ProcessingRouteParams }, 'params'>;
}

export default function ProcessingScreen({
  navigation,
  route,
}: ProcessingScreenProps): React.JSX.Element {
  const {
    sendAssetType,
    sendAmount,
    sendRecipient,
    intentStep,
    setSendAssetType,
    setSendAmount,
    setSendRecipient,
  } = useSendFlow();
  const { createSendIntent, sendIntent } = useTransactionBuild();
  const { signIntent } = useTransactionExecution();
  const { showSnackbar } = useNotifications();
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const hasStarted = useRef(false);
  const navigationErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get action from route params
  const action = route.params?.action; // 'create_intent', 'sign_and_broadcast'
  const fromScreen = route.params?.fromScreen;
  const isCashuMint = route.params?.cashuMint === true;
  const cashuQuoteId = route.params?.quoteId;
  const isTurbo = route.params?.isTurbo === true;
  const mintQuoteId = route.params?.mintQuoteId;
  const mintAmount = route.params?.mintAmount;
  const mintClaimAmount = route.params?.mintClaimAmount;
  const turboRecipient = route.params?.turboRecipient; // Original recipient for P2PK locking
  const senderTaprootAddress = route.params?.senderTaprootAddress;
  const cashuUnit = normalizeCashuUnit(route.params?.cashuUnit, DEFAULT_CASHU_UNIT);
  const snackbarAction =
    sendAssetType === 'unit'
      ? isTurbo
        ? 'swap'
        : 'unit_send'
      : isTurbo && cashuUnit === 'sat'
        ? 'btc_swap'
        : 'btc_send';

  // Helper to handle navigation errors - dismiss modal if coming from Settings
  const handleNavigationError = (errorMessage: string): void => {
    if (fromScreen === 'Settings') {
      // Dismiss the SendFlow modal and return to Main
      navigation.getParent()?.goBack();
    } else {
      // Normal flow - go back to previous screen
      navigation.goBack();
    }
    if (navigationErrorTimerRef.current) {
      clearTimeout(navigationErrorTimerRef.current);
    }
    navigationErrorTimerRef.current = setTimeout(() => {
      navigationErrorTimerRef.current = null;
      showSnackbar({
        type: 'error',
        message: errorMessage,
        action: snackbarAction,
      });
    }, 300);
    (navigationErrorTimerRef.current as { unref?: () => void }).unref?.();
  };

  useEffect(
    () => () => {
      if (navigationErrorTimerRef.current) {
        clearTimeout(navigationErrorTimerRef.current);
        navigationErrorTimerRef.current = null;
      }
    },
    []
  );

  // Get Cashu mint params if provided
  const paramAssetType = route.params?.assetType;
  const paramAmount = route.params?.amount;
  const paramRecipient = route.params?.recipient;
  const hasRouteSendParams = Boolean(paramAssetType && paramAmount && paramRecipient);
  const routeSendParamsReady =
    !hasRouteSendParams ||
    (sendAssetType === paramAssetType &&
      sendAmount === paramAmount &&
      sendRecipient === paramRecipient);

  // Set send flow params from route if provided (for Cashu mint)
  useEffect(() => {
    if (paramAssetType && paramAmount && paramRecipient) {
      logger.debug('ProcessingScreen: setting send flow from route params', {
        assetType: paramAssetType,
        amount: paramAmount,
        recipient: paramRecipient,
      });
      setSendAssetType(paramAssetType);
      setSendAmount(paramAmount);
      setSendRecipient(paramRecipient);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramAssetType, paramAmount, paramRecipient]);

  // Messages for different asset types during PSBT creation
  const btcCreatingMessages = ['Collecting UTXOs...', 'Building PSBT...'];

  const unitCreatingMessages = [
    'Collecting rune UTXOs...',
    'Constructing runestone...',
    'Building PSBT...',
  ];

  const creatingMessages = sendAssetType === 'btc' ? btcCreatingMessages : unitCreatingMessages;

  // Current message to display
  const getLoadingMessage = () => {
    if (action === 'create_intent') {
      return creatingMessages[Math.min(loadingMessageIndex, creatingMessages.length - 1)];
    } else if (action === 'sign_and_broadcast') {
      if (loadingMessageIndex === 0) {
        return 'Signing transaction...';
      } else {
        return 'Broadcasting transaction...';
      }
    }
    return 'Processing...';
  };

  // Cycle through loading messages
  useEffect(() => {
    const maxMessages = action === 'create_intent' ? creatingMessages.length : 2;
    setLoadingMessageIndex(0);

    const timer = setInterval(() => {
      setLoadingMessageIndex((prev) => {
        const maxIndex = maxMessages - 1;
        if (prev < maxIndex) {
          return prev + 1;
        }
        return prev; // Stay on last message
      });
    }, 500); // 500ms between messages
    (timer as { unref?: () => void }).unref?.();

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, sendAssetType]);

  // Start the action when screen mounts
  useEffect(() => {
    if (!hasStarted.current && action === 'create_intent') {
      // Mint/top-up routes provide the actual funding recipient and amount via
      // route params. Wait until those values are reflected in the send store so
      // we never build a PSBT from stale pre-navigation send state.
      if (hasRouteSendParams && !routeSendParamsReady) {
        return;
      }

      hasStarted.current = true;
      analytics.track(TRANSACTION_EVENTS.SEND_PROCESSING, { asset_type: sendAssetType });
      // Small delay to allow screen to render before starting heavy operations
      const timer = setTimeout(() => {
        logger.info(`[SendProcessing] Creating transaction intent asset=${sendAssetType}`);
        createSendIntent();
      }, 100);
      (timer as { unref?: () => void }).unref?.();
      return () => clearTimeout(timer);
    } else if (!hasStarted.current && action === 'sign_and_broadcast') {
      hasStarted.current = true;
      // Small delay before signing
      let cancelled = false;
      const timer = setTimeout(async () => {
        try {
          if (isE2E() && sendIntent?.psbt === 'e2e-mock-psbt') {
            const txid = `e2e-send-${Date.now().toString(16)}`;
            navigation.dispatch(
              StackActions.replace('Confirmation', {
                isTurbo,
                mintQuoteId,
                mintAmount,
                mintClaimAmount,
                turboRecipient,
                senderTaprootAddress,
                cashuUnit,
                cashuMint: isCashuMint,
                quoteId: cashuQuoteId,
                skipMint: false,
                broadcastedTxid: txid,
              })
            );
            return;
          }

          // Sign and broadcast transaction
          logger.info(
            `[SendProcessing] Signing and broadcasting transaction asset=${sendAssetType}`
          );
          const txid = await signIntent();

          if (cancelled) return;
          if (txid) {
            logger.info(
              `[SendProcessing] Transaction broadcast ready asset=${sendAssetType} txid=${txid}`
            );
            navigation.dispatch(
              StackActions.replace('Confirmation', {
                isTurbo,
                mintQuoteId,
                mintAmount,
                mintClaimAmount,
                turboRecipient,
                senderTaprootAddress,
                cashuUnit,
                cashuMint: isCashuMint,
                quoteId: cashuQuoteId,
                skipMint: false, // Let ConfirmationScreen handle the mint
                broadcastedTxid: txid,
              })
            );
          } else {
            handleNavigationError('Failed to sign and broadcast transaction');
          }
        } catch (error: unknown) {
          if (cancelled) return;
          const errorMessage =
            error instanceof Error ? error.message : String(error) || 'Transaction failed';
          analytics.track(TRANSACTION_EVENTS.SEND_FAILED, {
            asset_type: sendAssetType,
            error: errorMessage,
          });
          logger.error('Signing error:', { error: errorMessage });
          handleNavigationError(errorMessage);
        }
      }, 100);
      (timer as { unref?: () => void }).unref?.();
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    action,
    sendAssetType,
    sendAmount,
    sendRecipient,
    hasRouteSendParams,
    routeSendParamsReady,
    isTurbo,
    mintQuoteId,
    cashuQuoteId,
    senderTaprootAddress,
  ]);

  // Watch for intentStep changes after creating intent
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (action === 'create_intent' && hasStarted.current && !hasNavigated.current) {
      logger.debug('Intent step changed to:', intentStep, 'sendIntent exists:', !!sendIntent);
      if (intentStep === 'reviewing' && sendIntent) {
        // Success - navigate to review screen
        logger.info(`[SendProcessing] Transaction intent ready asset=${sendAssetType}`);
        hasNavigated.current = true;
        navigation.dispatch(
          StackActions.replace('Review', {
            isTurbo,
            mintQuoteId,
            mintAmount,
            mintClaimAmount,
            turboRecipient,
            senderTaprootAddress,
            cashuUnit,
            cashuMint: isCashuMint,
            quoteId: cashuQuoteId,
          })
        );
      } else if (
        intentStep === 'entering_amount' ||
        intentStep === 'entering_address' ||
        intentStep === 'selecting_asset'
      ) {
        // Error - go back to the previous input screen
        logger.debug('Error creating intent, going back to input screen', { intentStep });
        hasNavigated.current = true;
        analytics.track(TRANSACTION_EVENTS.SEND_FAILED, {
          asset_type: sendAssetType,
          error: 'Failed to create transaction',
        });
        handleNavigationError(
          'Failed to create transaction. Please check your balance and try again.'
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentStep, sendIntent, action]);

  // Determine title based on state
  const title = action === 'create_intent' ? 'Creating Transaction' : 'Sending Transaction';
  const message = getLoadingMessage();

  return (
    <View style={localStyles.container} testID="processing-screen">
      <View style={localStyles.content}>
        <ActivityIndicator
          size="large"
          color={COLORS.PRIMARY_BLUE}
          style={localStyles.spinner}
          testID="processing-spinner"
        />
        <Text style={localStyles.title} testID="processing-title">
          {title}
        </Text>
        <Text style={localStyles.message} testID="processing-message">
          {message}
        </Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  spinner: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
  },
});
