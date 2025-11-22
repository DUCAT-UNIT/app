/**
 * SpectreClaimingScreen - Processing screen for claiming Spectre tokens
 * Shows progress during: validating token, decoding proofs, claiming tokens
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { COLORS } from '../../theme';
import { useWallet } from '../../contexts/WalletContext';
import { logger } from '../../utils/logger';

export default function SpectreClaimingScreen({ navigation, route }) {
  const { tokenString } = route.params;
  const { wallet } = useWallet();
  const [currentMessage, setCurrentMessage] = useState('Starting...');
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 3;
  const hasStarted = useRef(false);
  const timeoutRef = useRef(null);

  // Start token claiming when screen mounts
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Set a timeout to detect if we get stuck
    timeoutRef.current = setTimeout(() => {
      logger.error('Token claiming timeout - stuck on step:', currentStep, currentMessage);
      Alert.alert(
        'Error',
        `Token claiming timed out at: ${currentMessage}. Please try again.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    }, 30000); // 30 second timeout

    const claimToken = async () => {
      try {
        logger.info('SpectreClaimingScreen: Starting token claim', { tokenLength: tokenString.length });

        // Step 1: Validating token
        setCurrentStep(1);
        setCurrentMessage('Validating token');

        // Check if token has P2PK-locked proofs
        const { hasP2PKProofs } = await import('../../services/cashu/cashuP2PK');
        const hasP2PKProofs_result = hasP2PKProofs(tokenString);

        if (hasP2PKProofs_result) {
          // Step 2: Getting private key
          setCurrentStep(2);
          setCurrentMessage('Getting private key');

          // Token is P2PK-locked, get private key from wallet
          const taprootAddress = wallet?.taprootAddress;
          if (!taprootAddress) {
            throw new Error('Taproot address not available');
          }

          // Get private key and x-only pubkey for the taproot address
          const { getPrivateKeyForAddress } = await import('../../utils/wallet');
          const { privateKey } = await getPrivateKeyForAddress(taprootAddress);

          logger.info('Got private key for claiming P2PK token');

          // Step 3: Claiming token
          setCurrentStep(3);
          setCurrentMessage('Claiming token');

          // Redeem P2PK token with private key
          const { receiveP2PKToken } = await import('../../services/cashu/cashuWalletService');
          await receiveP2PKToken(tokenString.trim(), privateKey);
        } else {
          // Step 2: Claiming token
          setCurrentStep(2);
          setCurrentMessage('Claiming token');

          // Regular token, redeem directly
          const { receiveToken } = await import('../../services/cashu/cashuWalletService');
          await receiveToken(tokenString.trim());
        }

        // Clear timeout on success
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Navigate back and show success
        navigation.goBack();

        // Show success alert after a small delay
        setTimeout(() => {
          Alert.alert('Success', 'Spectre token claimed successfully!');
        }, 300);

      } catch (error) {
        logger.error('Failed to claim Spectre token:', error);

        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Show error and go back
        Alert.alert(
          'Error',
          `Failed to claim token: ${error.message}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    };

    claimToken();

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [navigation, tokenString, wallet?.taprootAddress, currentStep, currentMessage]);

  return (
    <View style={localStyles.container}>
      <View style={localStyles.content}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={localStyles.spinner} />
        <Text style={localStyles.title}>Claiming Token</Text>
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
