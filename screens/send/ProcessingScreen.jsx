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
  const { sendAssetType, sendAmount, sendRecipient, intentStep, setSendAssetType, setSendAmount, setSendRecipient, setIntentStep } = useSendFlow();
  const { createSendIntent, sendIntent } = useTransactionBuild();
  const { signIntent, broadcastedTxid } = useTransactionExecution();
  const { showSnackbar, showToast } = useNotifications();
  const { wallet } = useWallet();
  const { refresh: refreshCashuBalance } = useCashu();
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [isConvertingToTurbo, setIsConvertingToTurbo] = useState(false);
  const [mintStep, setMintStep] = useState(''); // Track detailed mint steps
  const hasStarted = useRef(false);
  const isCompletingMint = useRef(false); // Track if we're completing mint to prevent premature navigation

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
    isCompletingMint.current = true; // Set flag to prevent premature navigation
    try {
      const { completeMint, sendP2PKToken } = await import('../../services/cashu/cashuWalletService');
      const { checkMintQuote } = await import('../../services/cashu/cashuMintClient');
      const { extractPubkeyFromTaprootAddress } = await import('../../utils/bitcoin');
      const { saveSentLockedToken, generateTurboDeeplink } = await import('../../services/cashu/cashuLockedTokensService');

      const quoteId = mintQuoteId || cashuQuoteId;
      logger.info('Starting mint completion in ProcessingScreen', { quoteId });

      // Step 4a: Poll for payment confirmation
      setMintStep('Waiting for payment confirmation...');
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

        // Step 4b: Complete mint to get e-cash tokens - RETRY ON FAILURE
        setMintStep('Minting e-cash tokens...');
        let proofs = null;
        let mintAttempts = 0;
        const maxMintAttempts = 10; // Try 10 times

        while (!proofs && mintAttempts < maxMintAttempts) {
          try {
            mintAttempts++;
            logger.info('Mint attempt', { attempt: mintAttempts, maxAttempts: maxMintAttempts });
            setMintStep(`Minting e-cash tokens (attempt ${mintAttempts}/${maxMintAttempts})...`);
            proofs = await completeMint(quoteId, paidQuote.amount);
            logger.info('Mint completed successfully', { proofCount: proofs.length });
          } catch (mintError) {
            logger.error('Mint attempt failed', { attempt: mintAttempts, error: mintError.message });
            if (mintAttempts < maxMintAttempts) {
              // Wait 2 seconds before retrying
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              // Final attempt failed
              throw new Error(`Failed to mint after ${maxMintAttempts} attempts: ${mintError.message}`);
            }
          }
        }

        let turboToken = null;
        let turboDeeplink = null;

        // If Turbo with recipient, create P2PK locked token
        if (isTurbo && turboRecipient) {
          logger.info('🔑 Creating P2PK token:', {
            turboRecipient,
            amount: paidQuote.amount,
            note: 'Token will be locked to this recipient pubkey'
          });

          // Step 4c: Create P2PK locked token
          setMintStep('Creating P2PK locked token...');
          const recipientPubkey = extractPubkeyFromTaprootAddress(turboRecipient);
          logger.info('Extracted pubkey from recipient address:', recipientPubkey.substring(0, 16) + '...');

          logger.info('🎯 About to call sendP2PKToken');
          const result = await sendP2PKToken(paidQuote.amount, recipientPubkey);
          logger.info('🎯 sendP2PKToken returned:', { hasToken: !!result?.token, tokenLength: result?.token?.length });

          turboToken = result.token;
          logger.info('✅ P2PK token created successfully', { tokenLength: turboToken?.length });

          // Step 4d: Generate short URL
          logger.info('🎯 About to generate deeplink');
          setMintStep('Generating shareable link...');
          const shortUrl = await generateTurboDeeplink(turboToken, turboRecipient, paidQuote.amount);
          turboDeeplink = shortUrl;
          logger.info('✅ Deeplink generated:', { url: shortUrl });

          // Step 4e: Save token to storage
          logger.info('🎯 About to save token');
          setMintStep('Saving token...');
          await saveSentLockedToken(turboToken, turboRecipient, paidQuote.amount, broadcastedTxid, shortUrl, wallet.taprootAddress);
          logger.info('✅ Turbo token saved to storage');
        }

        // Refresh balance
        logger.info('🎯 About to refresh cashu balance');
        await refreshCashuBalance();
        logger.info('✅ Cashu balance refreshed');

        // Show success and navigate to confirmation
        logger.info('🎯 About to show success snackbar');
        showSnackbar({ type: 'success', action: isTurbo ? 'send' : 'convert' });

        // Set intentStep to 'confirmed' since we skipped auto-confirm in polling
        logger.info('🎯 Setting intentStep to confirmed');
        setIntentStep('confirmed');

        // Navigate to confirmation with token (skipMint mode)
        logger.info('🎯 About to navigate to Confirmation', {
          isTurbo,
          hasToken: !!turboToken,
          hasDeeplink: !!turboDeeplink,
          tokenLength: turboToken?.length,
        });
        console.log('🚀🚀 [NAVIGATION] completeMintInProcessing calling navigation.replace with:', {
          isTurbo,
          skipMint: true,
          hasToken: !!turboToken,
          hasDeeplink: !!turboDeeplink,
        });
        navigation.replace('Confirmation', {
          isTurbo,
          skipMint: true,
          turboToken,
          turboDeeplink,
          turboRecipient,
          turboAmount: paidQuote.amount,
        });
        logger.info('✅ Navigation.replace called');
      } else {
        logger.warn('Payment not confirmed after 30 seconds');
        showToast('Payment sent. E-cash will be available once confirmed.', 'info');
        setIntentStep('confirmed'); // Set confirmed since we skipped auto-confirm
        navigation.replace('Confirmation', {
          isTurbo: false,
          skipMint: true, // Don't try to mint in ConfirmationScreen
        });
      }
    } catch (error) {
      logger.error('❌ Failed to complete mint in ProcessingScreen:', {
        message: error.message,
        stack: error.stack,
        error: error.toString(),
      });
      showToast(`Failed to complete conversion: ${error.message}`, 'error');
      logger.info('🎯 Navigating to Confirmation after error');
      setIntentStep('confirmed'); // Set confirmed since we skipped auto-confirm
      navigation.replace('Confirmation', {
        isTurbo: false,
        skipMint: true, // Don't try to mint in ConfirmationScreen
      });
    } finally {
      isCompletingMint.current = false; // Clear flag when done
    }
  };

  // NOTE: We no longer need to prevent intentStep changes here because we pass
  // skipAutoConfirm: true to signIntent for turbo flows, which prevents the polling
  // callback from auto-setting intentStep='confirmed' while mint is in progress

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
      } else if ((isTurbo || isCashuMint) && mintStep) {
        return mintStep;
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
    console.log('🎬🎬 [ProcessingScreen] useEffect fired', {
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
      console.log('🎬 [ProcessingScreen] Starting sign_and_broadcast flow');
      // Small delay before signing
      setTimeout(async () => {
        try {
          // Check if this is a Turbo or Cashu mint flow BEFORE signing
          const isMintFlow = !!((isTurbo || isCashuMint) && (mintQuoteId || cashuQuoteId));

          console.log('🎬 [ProcessingScreen] About to call signIntent with:', {
            skipAutoConfirm: isMintFlow,
            isTurbo,
            isCashuMint,
            mintQuoteId,
            cashuQuoteId,
          });

          // Pass skipAutoConfirm for mint flows so polling doesn't auto-set intentStep='confirmed'
          const success = await signIntent({ skipAutoConfirm: isMintFlow });

          console.log('🎬 [ProcessingScreen] signIntent returned:', success);

          if (success) {
            logger.debug('Broadcast successful, checking for mint flows:', {
              isTurbo,
              isCashuMint,
              mintQuoteId,
              isMintFlow,
            });

            // Check if this is a Turbo or Cashu mint flow
            if (isMintFlow) {
              console.log('🎬🔵 [ProcessingScreen] IS MINT FLOW - entering turbo mint branch');
              console.log('🔵 [ProcessingScreen] Setting converting state to true');
              console.log('🔵 [ProcessingScreen] isTurbo:', isTurbo, 'isCashuMint:', isCashuMint);

              // Set converting state to show "Converting to TurboUNIT..." message
              setIsConvertingToTurbo(true);
              setLoadingMessageIndex(2); // Move to "Converting to TurboUNIT..." message

              console.log('🔵 [ProcessingScreen] State updated, should show "Converting to TurboUNIT..."');
              console.log('🎬 [ProcessingScreen] About to call completeMintInProcessing');

              // Complete mint process
              await completeMintInProcessing(isTurbo, mintQuoteId, cashuQuoteId, mintAmount, turboRecipient);

              console.log('🎬 [ProcessingScreen] completeMintInProcessing finished');
            } else {
              console.log('🎬❌ [ProcessingScreen] NOT MINT FLOW - entering regular tx branch');
              console.log('🔵 [ProcessingScreen] Regular transaction, navigating to Confirmation');
              // Regular transaction - navigate directly to confirmation
              navigation.replace('Confirmation', {
                isTurbo: false,
                cashuMint: false,
              });
            }
          } else {
            console.log('🎬❌ [ProcessingScreen] signIntent returned false');
            handleNavigationError('Failed to sign and broadcast transaction');
          }
        } catch (error) {
          console.log('🎬❌ [ProcessingScreen] Error in sign_and_broadcast:', error);
          logger.error('Signing error:', error);
          const errorMessage = error.message || error.toString() || 'Transaction failed';
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
