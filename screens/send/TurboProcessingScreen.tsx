/**
 * TurboProcessingScreen - Processing screen for Turbo token creation
 * Shows progress during: selecting proofs, creating secrets, swapping, shortening URL
 * Persists state to survive app restarts
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, ActivityIndicator, StyleSheet, Alert, BackHandler } from 'react-native';
import { NavigationProp, StackActions } from '@react-navigation/native';
import { COLORS } from '../../theme';
import { useSendFlow } from '../../stores/sendFlowStore';
import { useWallet } from '../../contexts/WalletContext';
import { useTurboProcessingStore } from '../../stores/turboProcessingStore';
import { logger } from '../../utils/logger';

/**
 * Props for TurboProcessingScreen
 */
interface TurboProcessingScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
}

export default function TurboProcessingScreen({ navigation }: TurboProcessingScreenProps): React.JSX.Element {
  const { sendAmount, sendRecipient } = useSendFlow();
  const { wallet } = useWallet();
  const [currentMessage, setCurrentMessage] = useState('Starting...');
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 5;
  const hasStarted = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStepRef = useRef(currentStep);
  const currentMessageRef = useRef(currentMessage);

  // Get store actions
  const { startProcessing, updateProgress, completeProcessing, failProcessing } = useTurboProcessingStore();

  useEffect(() => {
    currentStepRef.current = currentStep;
    currentMessageRef.current = currentMessage;
  }, [currentStep, currentMessage]);

  const clearProcessingTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Prevent back navigation while processing
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Prevent back button - transaction must complete
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Start token creation when screen mounts
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Persist state immediately
    startProcessing({ sendAmount, sendRecipient });

    // Set a timeout to detect if we get stuck
    timeoutRef.current = setTimeout(async () => {
      logger.error('Token creation timeout - stuck on step:', {
        step: currentStepRef.current,
        message: currentMessageRef.current,
      });
      await failProcessing();
      Alert.alert(
        'Error',
        `Token creation timed out at: ${currentMessageRef.current}. Please check your balance and try again.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    }, 60000); // 60 second timeout
    (timeoutRef.current as { unref?: () => void }).unref?.();

    const createToken = async () => {
      try {
        logger.info('TurboProcessing: Starting token creation', { amount: sendAmount, recipient: sendRecipient });

        const amountInSmallestUnits = Math.round(parseFloat(sendAmount) * 100);

        // Early balance check before attempting to create token
        const { getBalance } = await import('../../services/cashu/cashuBalanceService');
        const availableBalance = await getBalance();

        if (availableBalance < amountInSmallestUnits) {
          // Not enough ecash - go back and show the insufficient sheet
          logger.warn('TurboProcessing: Insufficient ecash balance detected early', {
            available: availableBalance,
            required: amountInSmallestUnits,
            shortfall: amountInSmallestUnits - availableBalance,
          });

          clearProcessingTimeout();
          await failProcessing();

          // Navigate back to amount input with params to show insufficient sheet
          navigation.dispatch(
            StackActions.replace('AmountInput', {
              showInsufficientSheet: true,
              insufficientAmount: parseFloat(sendAmount),
              insufficientBalance: availableBalance / 100,
            })
          );
          return;
        }

        const { sendP2PKToken } = await import('../../services/cashu/cashuWalletService');

        // For P2PK, we need the tweaked output pubkey (extracted from the Taproot address)
        // This is the pubkey that's actually encoded in the tb1p... address
        // Extract the pubkey directly from the taproot address (works for any address, not just own wallet)
        const { extractPubkeyFromTaprootAddress } = await import('../../utils/bitcoin');
        const recipientPubkey = extractPubkeyFromTaprootAddress(sendRecipient); // Tweaked x-only pubkey (32 bytes / 64 hex chars)

        logger.info('[TurboProcessingScreen] 🔐 P2PK TOKEN CREATION:', {
          recipientAddress: sendRecipient,
          tweakedPubkey: recipientPubkey,
          pubkeyLength: recipientPubkey.length,
        });

        // Create P2PK locked token with progress callback
        logger.info('Calling sendP2PKToken...');
        const { token } = await sendP2PKToken(
          amountInSmallestUnits,
          recipientPubkey,
          {},
          async (step, total, message) => {
            logger.info('Progress update:', { step, total, message });
            setCurrentStep(step);
            setCurrentMessage(message);
            await updateProgress(step, message);
          }
        );
        logger.info('sendP2PKToken completed successfully');

        // Step 5: Shortening URL
        setCurrentStep(5);
        setCurrentMessage('Shortening URL');
        await updateProgress(5, 'Shortening URL');

        // Generate shortened URL and save token to storage
        let shortUrl;
        try {
          const { generateTurboDeeplink, saveSentLockedToken } = await import('../../services/cashu/cashuLockedTokensService');

          shortUrl = await generateTurboDeeplink(token, sendRecipient, amountInSmallestUnits);
          logger.info('Generated short URL', { shortUrlLength: shortUrl.length });

          await saveSentLockedToken(token, sendRecipient, amountInSmallestUnits, null, shortUrl, wallet?.taprootAddress);
          logger.info('Token saved to storage with short URL');
        } catch (storageError) {
          const storageErrorMsg = storageError instanceof Error ? storageError.message : 'Unknown error';
          logger.error('Failed to generate/save token:', { error: storageErrorMsg });
          // Non-critical - continue anyway
        }

        // Clear timeout on success
        clearProcessingTimeout();

        // Mark processing as complete
        await completeProcessing();

        // Navigate to confirmation
        navigation.dispatch(
          StackActions.replace('Confirmation', {
            isTurbo: true,
            turboRecipient: sendRecipient,
            turboToken: token,
            turboAmount: amountInSmallestUnits,
            skipMint: true,
          })
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to create Turbo token:', { error: errorMessage });

        // Clear timeout
        clearProcessingTimeout();

        // Mark processing as failed
        await failProcessing();

        // Show error and go back
        Alert.alert(
          'Error',
          `Failed to create token: ${errorMessage}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    };

    createToken();

    // Cleanup timeout on unmount
    return () => {
      clearProcessingTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, sendAmount, sendRecipient, wallet?.taprootAddress, startProcessing, updateProgress, completeProcessing, failProcessing]);

  return (
    <View style={localStyles.container} testID="turbo-processing-screen">
      <View style={localStyles.content}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={localStyles.spinner} testID="turbo-processing-spinner" />
        <Text style={localStyles.title} testID="turbo-processing-title">Creating Token</Text>
        <Text style={localStyles.message} testID="turbo-processing-message">{currentMessage}</Text>
        {totalSteps > 0 && (
          <Text style={localStyles.progress} testID="turbo-processing-progress">
            {currentStep} / {totalSteps}
          </Text>
        )}
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
  progress: {
    fontSize: 14,
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Medium',
    marginTop: 12,
  },
});
