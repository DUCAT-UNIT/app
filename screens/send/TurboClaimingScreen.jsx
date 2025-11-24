/**
 * TurboClaimingScreen - Processing screen for claiming Turbo tokens
 * Shows progress during: validating token, decoding proofs, claiming tokens
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import { useWallet } from '../../contexts/WalletContext';
import { useNotifications } from '../../hooks/useNotifications';
import { logger } from '../../utils/logger';

export default function TurboClaimingScreen({ navigation, route }) {
  const { tokenString } = route.params;
  const { wallet } = useWallet();
  const { showSnackbar } = useNotifications();
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
      navigation.navigate('Wallet', {
        claimError: `Token claiming timed out at: ${currentMessage}. Please try again.`,
      });
    }, 30000); // 30 second timeout

    const claimToken = async () => {
      try {
        logger.info('TurboClaimingScreen: Starting token claim', { tokenLength: tokenString.length });

        // Step 1: Validating token
        setCurrentStep(1);
        setCurrentMessage('Validating token');

        // Check if token has P2PK-locked proofs
        const { hasP2PKProofs } = await import('../../services/cashu/cashuP2PK');
        const hasP2PKProofs_result = hasP2PKProofs(tokenString);

        if (hasP2PKProofs_result) {
          // Step 2: Finding correct account
          setCurrentStep(2);
          setCurrentMessage('Finding correct account');

          // Token is P2PK-locked, need to find which account it's locked to
          logger.info('Token is P2PK-locked, extracting recipient pubkey');

          // Decode token to extract recipient pubkey
          const { decodeToken } = await import('../../services/cashu/cashuCrypto');
          const { getP2PKRecipient } = await import('../../services/cashu/cashuP2PK');

          const decoded = decodeToken(tokenString);
          const proofs = decoded.proofs || decoded.token?.[0]?.proofs || [];

          if (!proofs || proofs.length === 0) {
            throw new Error('No proofs found in token');
          }

          // Find first P2PK proof and extract recipient pubkey
          let recipientPubkey = null;
          for (const proof of proofs) {
            if (proof.secret) {
              const pubkey = getP2PKRecipient(proof.secret);
              if (pubkey) {
                recipientPubkey = pubkey;
                logger.info('Found P2PK recipient pubkey:', pubkey.substring(0, 16) + '...');
                break;
              }
            }
          }

          if (!recipientPubkey) {
            throw new Error('Could not extract recipient pubkey from P2PK token');
          }

          // Find which account owns this pubkey
          const { findAccountForP2PKToken } = await import('../../services/cashu/cashuP2PK');
          const accountMatch = await findAccountForP2PKToken(
            recipientPubkey,
            50,
            (accountIndex, total) => {
              // Update progress message as we check each account
              setCurrentMessage(`Checking account ${accountIndex + 1}...`);
            }
          );

          if (!accountMatch) {
            throw new Error('This token is not locked to any of your accounts (checked 50 accounts). Make sure you are using the correct wallet.');
          }

          logger.info('Found matching account:', {
            accountIndex: accountMatch.accountIndex,
            address: accountMatch.address,
          });

          // Check if token belongs to current account
          const { getCurrentAccount } = await import('../../services/secureStorageService');
          const currentAccountIndex = await getCurrentAccount();

          if (accountMatch.accountIndex !== currentAccountIndex) {
            // Token belongs to a different account - show error
            throw new Error(`This proof belongs to account ${accountMatch.accountIndex + 1}. Please switch to that account to claim this token.`);
          }

          // Step 3: Claiming token
          setCurrentStep(3);
          setCurrentMessage('Claiming token');

          // Redeem P2PK token with the correct account's private key
          const { receiveP2PKToken } = await import('../../services/cashu/cashuWalletService');
          await receiveP2PKToken(tokenString.trim(), accountMatch.privateKey);
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

        // Navigate back with success flag - snackbar will be shown by parent screen
        navigation.navigate('Wallet', {
          claimSuccess: true,
        });

      } catch (error) {
        logger.error('Failed to claim Turbo token:', error);

        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Navigate back with error - snackbar will be shown by parent screen
        // Pass the token string so it can be retried after account switch
        navigation.navigate('Wallet', {
          claimError: error.message,
          claimToken: tokenString,
        });
      }
    };

    claimToken();

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [navigation, tokenString, wallet?.taprootAddress, currentStep, currentMessage, showSnackbar]);

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
