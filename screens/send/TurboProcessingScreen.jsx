/**
 * TurboProcessingScreen - Processing screen for Turbo token creation
 * Shows progress during: selecting proofs, creating secrets, swapping, shortening URL
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { COLORS } from '../../theme';
import { useSendFlow } from '../../contexts/SendFlowContext';
import { useWallet } from '../../contexts/WalletContext';
import { logger } from '../../utils/logger';

export default function TurboProcessingScreen({ navigation, route }) {
  const { sendAmount, sendRecipient } = useSendFlow();
  const { wallet } = useWallet();
  const [currentMessage, setCurrentMessage] = useState('Starting...');
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 5;
  const hasStarted = useRef(false);
  const timeoutRef = useRef(null);

  // Start token creation when screen mounts
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Set a timeout to detect if we get stuck
    timeoutRef.current = setTimeout(() => {
      logger.error('Token creation timeout - stuck on step:', currentStep, currentMessage);
      Alert.alert(
        'Error',
        `Token creation timed out at: ${currentMessage}. Please check your balance and try again.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    }, 30000); // 30 second timeout

    const createToken = async () => {
      try {
        logger.info('TurboProcessing: Starting token creation', { amount: sendAmount, recipient: sendRecipient });

        const amountInSmallestUnits = Math.round(parseFloat(sendAmount) * 100);

        const { sendP2PKToken } = await import('../../services/cashu/cashuWalletService');
        const { extractPubkeyFromTaprootAddress } = await import('../../utils/bitcoin');

        // Extract recipient's pubkey
        const recipientPubkey = extractPubkeyFromTaprootAddress(sendRecipient);
        logger.info('Extracted recipient pubkey:', recipientPubkey.substring(0, 16) + '...');

        // Create P2PK locked token with progress callback
        logger.info('Calling sendP2PKToken...');
        const { token } = await sendP2PKToken(
          amountInSmallestUnits,
          recipientPubkey,
          {},
          (step, total, message) => {
            logger.info('Progress update:', { step, total, message });
            setCurrentStep(step);
            setCurrentMessage(message);
          }
        );
        logger.info('sendP2PKToken completed successfully');

        // Step 5: Shortening URL
        setCurrentStep(5);
        setCurrentMessage('Shortening URL');

        // Generate shortened URL and save token to storage
        let shortUrl;
        try {
          const { generateTurboDeeplink, saveSentLockedToken } = await import('../../services/cashu/cashuLockedTokensService');

          shortUrl = await generateTurboDeeplink(token, sendRecipient, amountInSmallestUnits);
          logger.info('Generated short URL:', shortUrl);

          await saveSentLockedToken(token, sendRecipient, amountInSmallestUnits, null, shortUrl, wallet.taprootAddress);
          logger.info('Token saved to storage with short URL');
        } catch (storageError) {
          logger.error('Failed to generate/save token:', storageError);
          // Non-critical - continue anyway
        }

        // Clear timeout on success
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Navigate to confirmation
        navigation.replace('Confirmation', {
          isTurbo: true,
          turboRecipient: sendRecipient,
          turboToken: token,
          turboAmount: amountInSmallestUnits,
          skipMint: true,
        });
      } catch (error) {
        logger.error('Failed to create Turbo token:', error);

        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Show error and go back
        Alert.alert(
          'Error',
          `Failed to create token: ${error.message}`,
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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [navigation, sendAmount, sendRecipient, wallet.taprootAddress, currentStep, currentMessage]);

  return (
    <View style={localStyles.container}>
      <View style={localStyles.content}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={localStyles.spinner} />
        <Text style={localStyles.title}>Creating Token</Text>
        <Text style={localStyles.message}>{currentMessage}</Text>
        {totalSteps > 0 && (
          <Text style={localStyles.progress}>
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
