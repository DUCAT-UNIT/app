/**
 * ProcessingScreen - Full screen for transaction processing
 * Handles: creating intent, signing, broadcasting
 * Features: cycling loading messages, automatic navigation on success/error
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import { useSendFlow } from '../../contexts/SendFlowContext';
import { useTransactionBuild } from '../../contexts/TransactionBuildContext';
import { useTransactionExecution } from '../../contexts/TransactionExecutionContext';
import { useNotifications } from "../../contexts/NotificationContext";
import { useWallet } from '../../contexts/WalletContext';
import { useCashu } from '../../contexts/CashuContext';
import { logger } from '../../utils/logger';

export default function ProcessingScreen({ navigation, route }) {
  const { sendAssetType, sendAmount, sendRecipient, intentStep, setSendAssetType, setSendAmount, setSendRecipient } = useSendFlow();
  const { createSendIntent, sendIntent } = useTransactionBuild();
  const { signIntent, broadcastedTxid } = useTransactionExecution();
  const { showSnackbar, showToast } = useNotifications();
  const { wallet } = useWallet();
  const { refresh: refreshCashuBalance } = useCashu();
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [isConvertingToTurbo, setIsConvertingToTurbo] = useState(false);
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
  const handleNavigationError = (errorMessage) => {
    if (fromScreen === 'Settings') {
      // Dismiss the SendFlow modal and return to Main
      navigation.getParent()?.goBack();
    } else {
      // Normal flow - go back to previous screen
      navigation.goBack();
    }
    setTimeout(() => showSnackbar({
      type: 'error',
      action: sendAssetType === 'unit' ? 'swap' : 'withdraw',
      description: errorMessage,
    }), 300);
  };

  // Complete mint process in ProcessingScreen before navigating
  const completeMintInProcessing = async (isTurbo, mintQuoteId, cashuQuoteId, mintAmount, turboRecipient) => {
    try {
      const { completeMint, sendP2PKToken } = await import('../../services/cashu/cashuWalletService');
      const { checkMintQuote } = await import('../../services/cashu/cashuMintClient');
      const { extractPubkeyFromTaprootAddress } = await import('../../utils/bitcoin');
      const { saveSentLockedToken, generateTurboDeeplink } = await import('../../services/cashu/cashuLockedTokensService');

      const quoteId = mintQuoteId || cashuQuoteId;
      logger.info('Starting mint completion in ProcessingScreen', { quoteId });

      // Poll for payment confirmation
      let paidQuote = null;
      let attempts = 0;
      const maxAttempts = 30;

      while (!paidQuote && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const quote = await checkMintQuote(quoteId);
        if (quote.state === 'PAID' || quote.state === 'ISSUED') {
          paidQuote = quote;
          break;
        }
        attempts++;
      }

      if (paidQuote) {
        logger.info('Payment confirmed! Completing mint...');

        // Complete mint to get e-cash tokens
        const proofs = await completeMint(quoteId, paidQuote.amount);
        logger.info('Mint completed', { proofCount: proofs.length });

        let turboToken = null;
        let turboDeeplink = null;

        // If Turbo with recipient, create P2PK locked token
        if (isTurbo && turboRecipient) {
          logger.info('🔑 Creating P2PK token:', {
            turboRecipient,
            amount: paidQuote.amount,
            note: 'Token will be locked to this recipient pubkey'
          });
          const recipientPubkey = extractPubkeyFromTaprootAddress(turboRecipient);
          logger.info('Extracted pubkey from recipient address:', recipientPubkey.substring(0, 16) + '...');
          const { token } = await sendP2PKToken(paidQuote.amount, recipientPubkey);
          turboToken = token;
          logger.info('P2PK token created successfully');

          // Generate short URL
          const shortUrl = await generateTurboDeeplink(token, turboRecipient, paidQuote.amount);
          turboDeeplink = shortUrl;

          // Save token to storage
          await saveSentLockedToken(token, turboRecipient, paidQuote.amount, broadcastedTxid, shortUrl, wallet.taprootAddress);
          logger.info('Turbo token created and saved');
        }

        // Refresh balance
        await refreshCashuBalance();
        logger.info('Cashu balance refreshed');

        // Show success and navigate to confirmation
        showSnackbar({ type: 'success', action: 'convert' });

        // Navigate to confirmation with token (skipMint mode)
        navigation.replace('Confirmation', {
          isTurbo,
          skipMint: true,
          turboToken,
          turboDeeplink,
        });
      } else {
        logger.warn('Payment not confirmed after 30 seconds');
        showToast('Payment sent. E-cash will be available once confirmed.', 'info');
        navigation.replace('Confirmation', { isTurbo: false });
      }
    } catch (error) {
      logger.error('Failed to complete mint in ProcessingScreen:', error);
      showToast(`Failed to complete conversion: ${error.message}`, 'error');
      navigation.replace('Confirmation', { isTurbo: false });
    }
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
      } else if (loadingMessageIndex === 1) {
        return 'Broadcasting transaction...';
      } else if (isTurbo || isCashuMint) {
        return 'Converting to TurboUNIT...';
      }
      return 'Broadcasting transaction...';
    }
    return 'Processing...';
  };

  // Cycle through loading messages
  useEffect(() => {
    // For sign_and_broadcast: 0=Signing, 1=Broadcasting, 2=Converting (if Turbo/Cashu)
    const maxMessages = action === 'create_intent' ? creatingMessages.length : (isTurbo || isCashuMint ? 3 : 2);
    setLoadingMessageIndex(0);

    const timer = setInterval(() => {
      setLoadingMessageIndex((prev) => {
        // Don't auto-cycle to "Converting" - that's set manually
        const maxIndex = action === 'sign_and_broadcast' ? 1 : maxMessages - 1;
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
      // Small delay before signing
      setTimeout(async () => {
        try {
          const success = await signIntent();
          if (success) {
            logger.debug('Broadcast successful, checking for mint flows:', {
              isTurbo,
              isCashuMint,
              mintQuoteId,
            });

            // Check if this is a Turbo or Cashu mint flow
            if ((isTurbo || isCashuMint) && (mintQuoteId || cashuQuoteId)) {
              console.log('🔵 [ProcessingScreen] Setting converting state to true');
              console.log('🔵 [ProcessingScreen] isTurbo:', isTurbo, 'isCashuMint:', isCashuMint);

              // Set converting state to show "Converting to TurboUNIT..." message
              setIsConvertingToTurbo(true);
              setLoadingMessageIndex(2); // Move to "Converting to TurboUNIT..." message

              console.log('🔵 [ProcessingScreen] State updated, should show "Converting to TurboUNIT..."');

              // Complete mint process
              await completeMintInProcessing(isTurbo, mintQuoteId, cashuQuoteId, mintAmount, turboRecipient);
            } else {
              console.log('🔵 [ProcessingScreen] Regular transaction, navigating to Confirmation');
              // Regular transaction - navigate directly to confirmation
              navigation.replace('Confirmation', {
                isTurbo: false,
                cashuMint: false,
              });
            }
          } else {
            handleNavigationError('Failed to sign and broadcast transaction');
          }
        } catch (error) {
          logger.error('Signing error:', error);
          const errorMessage = error.message || error.toString() || 'Transaction failed';
          handleNavigationError(errorMessage);
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, sendAssetType, sendAmount, sendRecipient, isCashuMint]);

  // Watch for intentStep changes after creating intent
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (action === 'create_intent' && hasStarted.current && !hasNavigated.current) {
      logger.debug('Intent step changed to:', intentStep, 'sendIntent exists:', !!sendIntent);
      if (intentStep === 'reviewing' && sendIntent) {
        // Success - navigate to review screen
        logger.debug('Navigating to Review screen');
        hasNavigated.current = true;
        navigation.replace('Review', {
          isTurbo,
          mintQuoteId,
          mintAmount,
          turboRecipient,
          cashuMint: isCashuMint,
          quoteId: cashuQuoteId,
        });
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
  const getTitle = () => {
    if (action === 'create_intent') {
      return 'Creating Transaction';
    } else if (isConvertingToTurbo) {
      return 'Converting to TurboUNIT';
    } else {
      return 'Sending Transaction';
    }
  };

  const title = getTitle();
  const message = getLoadingMessage();

  console.log('🎨 [ProcessingScreen] Rendering:', {
    action,
    isConvertingToTurbo,
    loadingMessageIndex,
    title,
    message,
  });

  return (
    <View style={localStyles.container}>
      <View style={localStyles.content}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={localStyles.spinner} />
        <Text style={localStyles.title}>{title}</Text>
        <Text style={localStyles.message}>{message}</Text>
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
