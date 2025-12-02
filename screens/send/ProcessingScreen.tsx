/**
 * ProcessingScreen - Full screen for transaction processing
 * Handles: creating intent, signing, broadcasting
 * Features: cycling loading messages, automatic navigation on success/error
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationProp, RouteProp, StackActions } from '@react-navigation/native';
import { COLORS } from '../../theme';
import { useSendFlow, type AssetType } from '../../stores/sendFlowStore';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { useTransactionExecution } from '../../contexts/TransactionExecutionContext';
import { useNotifications } from "../../stores/notificationStore";
import { logger } from '../../utils/logger';

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
  turboRecipient?: string;
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

export default function ProcessingScreen({ navigation, route }: ProcessingScreenProps): React.JSX.Element {
  const { sendAssetType, sendAmount, sendRecipient, intentStep, setSendAssetType, setSendAmount, setSendRecipient, setIntentStep } = useSendFlow();
  const { createSendIntent, sendIntent } = useTransactionBuild();
  const { signIntent } = useTransactionExecution();
  const { showSnackbar } = useNotifications();
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const hasStarted = useRef(false);

  // Get action from route params
  const action = route.params?.action; // 'create_intent', 'sign_and_broadcast'
  const fromScreen = route.params?.fromScreen;
  const isCashuMint = route.params?.cashuMint === true;
  const cashuQuoteId = route.params?.quoteId;
  const isTurbo = route.params?.isTurbo === true;
  const mintQuoteId = route.params?.mintQuoteId;
  const mintAmount = route.params?.mintAmount;
  const turboRecipient = route.params?.turboRecipient; // Original recipient for P2PK locking

  // Helper to handle navigation errors - dismiss modal if coming from Settings
  const handleNavigationError = (errorMessage: string): void => {
    if (fromScreen === 'Settings') {
      // Dismiss the SendFlow modal and return to Main
      navigation.getParent()?.goBack();
    } else {
      // Normal flow - go back to previous screen
      navigation.goBack();
    }
    setTimeout(() => showSnackbar({
      type: 'error',
      message: errorMessage,
      action: sendAssetType === 'unit' ? 'swap' : 'withdraw',
    }), 300);
  };

  // Get Cashu mint params if provided
  const paramAssetType = route.params?.assetType;
  const paramAmount = route.params?.amount;
  const paramRecipient = route.params?.recipient;

  // Set send flow params from route if provided (for Cashu mint)
  useEffect(() => {
    if (paramAssetType && paramAmount && paramRecipient) {
      logger.debug('🔵 ProcessingScreen: Setting send flow from route params', {
        assetType: paramAssetType,
        amount: paramAmount,
        recipient: paramRecipient,
      });
      setSendAssetType(paramAssetType);
      setSendAmount(paramAmount);
      setSendRecipient(paramRecipient);
    }
  }, [paramAssetType, paramAmount, paramRecipient, setSendAssetType, setSendAmount, setSendRecipient]);

  // Messages for different asset types during PSBT creation
  const btcCreatingMessages = [
    'Collecting UTXOs...',
    'Building PSBT...',
  ];

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

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, sendAssetType]);

  // Start the action when screen mounts
  useEffect(() => {
    logger.debug('🎬🎬 [ProcessingScreen] useEffect fired', {
      hasStarted: hasStarted.current,
      action,
      isTurbo,
      isCashuMint,
      mintQuoteId,
      cashuQuoteId,
    });

    if (!hasStarted.current && action === 'create_intent') {
      // For Cashu mint flow, wait for send flow state to be set from route params
      if (isCashuMint && (!sendAssetType || !sendAmount || !sendRecipient)) {
        // State not ready yet, wait for next render
        return;
      }

      hasStarted.current = true;
      // Small delay to allow screen to render before starting heavy operations
      setTimeout(() => {
        logger.debug('Creating send intent for asset type:', sendAssetType);
        createSendIntent();
      }, 100);
    } else if (!hasStarted.current && action === 'sign_and_broadcast') {
      hasStarted.current = true;
      logger.debug('🎬 [ProcessingScreen] Starting sign_and_broadcast flow');
      // Small delay before signing
      setTimeout(async () => {
        try {
          // Sign and broadcast transaction
          const success = await signIntent();

          if (success) {
            // Navigate to Confirmation immediately after broadcast
            // Confirmation screen will handle the mint process for turbo/cashu flows
            navigation.dispatch(
              StackActions.replace('Confirmation', {
                isTurbo,
                mintQuoteId,
                mintAmount,
                turboRecipient,
                cashuMint: isCashuMint,
                quoteId: cashuQuoteId,
                skipMint: false, // Let ConfirmationScreen handle the mint
              })
            );
          } else {
            handleNavigationError('Failed to sign and broadcast transaction');
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error) || 'Transaction failed';
          logger.error('Signing error:', { error: errorMessage });
          handleNavigationError(errorMessage);
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, sendAssetType, sendAmount, sendRecipient, isCashuMint, isTurbo, mintQuoteId, cashuQuoteId]);

  // Watch for intentStep changes after creating intent
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (action === 'create_intent' && hasStarted.current && !hasNavigated.current) {
      logger.debug('Intent step changed to:', intentStep, 'sendIntent exists:', !!sendIntent);
      if (intentStep === 'reviewing' && sendIntent) {
        // Success - navigate to review screen
        logger.debug('Navigating to Review screen');
        hasNavigated.current = true;
        navigation.dispatch(
          StackActions.replace('Review', {
            isTurbo,
            mintQuoteId,
            mintAmount,
            turboRecipient,
            cashuMint: isCashuMint,
            quoteId: cashuQuoteId,
          })
        );
      } else if (intentStep === 'entering_amount') {
        // Error - go back to amount input
        logger.debug('Error creating intent, going back to amount');
        hasNavigated.current = true;
        handleNavigationError('Failed to create transaction. Please check your balance and try again.');
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
        <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={localStyles.spinner} testID="processing-spinner" />
        <Text style={localStyles.title} testID="processing-title">{title}</Text>
        <Text style={localStyles.message} testID="processing-message">{message}</Text>
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
