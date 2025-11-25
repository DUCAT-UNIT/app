/**
 * TurboClaimingScreen - Processing screen for claiming Turbo tokens
 * Shows progress during: validating token, decoding proofs, claiming tokens
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../../theme';
import { useWallet } from '../../contexts/WalletContext';
import { logger } from '../../utils/logger';

export default function TurboClaimingScreen({ navigation, route }) {
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
      navigation.navigate('Wallet', {
        claimError: `Token claiming timed out at: ${currentMessage}. Please try again.`,
      });
    }, 30000); // 30 second timeout

    const claimToken = async () => {
      const txn = logger.startTransaction('turbo_claim_screen');

      try {
        logger.cashu('claim_screen_start', {
          step: 'UI_CLAIM',
          tokenLength: tokenString?.length,
          tokenPrefix: tokenString?.substring(0, 20) + '...',
          message: 'TurboClaimingScreen mounted and starting claim',
        });

        // Step 1: Validating token
        setCurrentStep(1);
        setCurrentMessage('Validating token');

        // Check if token has P2PK-locked proofs
        const { hasP2PKProofs } = await import('../../services/cashu/p2pk');
        const hasP2PKProofs_result = hasP2PKProofs(tokenString);

        logger.cashu('claim_p2pk_detection', {
          step: 'UI_CLAIM',
          hasP2PK: hasP2PKProofs_result,
          message: hasP2PKProofs_result ? 'Token contains P2PK locked proofs' : 'Regular token (no P2PK)',
        });

        if (hasP2PKProofs_result) {
          // Step 2: Finding correct account
          setCurrentStep(2);
          setCurrentMessage('Finding correct account');

          // Token is P2PK-locked, need to find which account it's locked to
          logger.cashu('claim_p2pk_extract_start', {
            step: 'UI_CLAIM',
            message: 'Extracting recipient pubkey from P2PK token',
          });

          // Decode token to extract recipient pubkey
          const { decodeToken } = await import('../../services/cashu/crypto');
          const { getP2PKRecipient } = await import('../../services/cashu/p2pk');

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
                logger.cashu('claim_p2pk_pubkey_found', {
                  step: 'UI_CLAIM',
                  pubkeyLength: pubkey?.length,
                  pubkeyPreview: pubkey?.substring(0, 16) + '...',
                  message: 'Found recipient pubkey in P2PK proof',
                });
                break;
              }
            }
          }

          if (!recipientPubkey) {
            logger.cashu('claim_p2pk_pubkey_missing', {
              step: 'UI_CLAIM',
              proofCount: proofs.length,
              error: 'Could not extract recipient pubkey from P2PK token',
            });
            throw new Error('Could not extract recipient pubkey from P2PK token');
          }

          // Find which account owns this pubkey
          logger.cashu('claim_account_search_start', {
            step: 'UI_CLAIM',
            targetPubkey: recipientPubkey?.substring(0, 16) + '...',
            message: 'Starting account search for P2PK token',
          });

          const { findAccountForP2PKToken } = await import('../../services/cashu/p2pk');
          const accountMatch = await findAccountForP2PKToken(
            recipientPubkey,
            50,
            (accountIndex) => {
              // Update progress message as we check each account
              setCurrentMessage(`Checking account ${accountIndex + 1}...`);
            }
          );

          if (!accountMatch) {
            logger.cashu('claim_account_not_found', {
              step: 'UI_CLAIM',
              targetPubkey: recipientPubkey?.substring(0, 16) + '...',
              accountsChecked: 50,
              error: 'Token does not belong to any scanned account',
            });
            throw new Error('This token is not locked to any of your accounts (checked 50 accounts). Make sure you are using the correct wallet.');
          }

          logger.cashu('claim_account_match_found', {
            step: 'UI_CLAIM',
            accountIndex: accountMatch.accountIndex,
            address: accountMatch.address?.substring(0, 20) + '...',
            message: 'Found account that owns this P2PK token',
          });

          // Check if token belongs to current account
          const { getCurrentAccount } = await import('../../services/secureStorageService');
          const currentAccountIndex = await getCurrentAccount();

          logger.cashu('claim_account_comparison', {
            step: 'UI_CLAIM',
            currentAccountIndex,
            tokenAccountIndex: accountMatch.accountIndex,
            isMatch: accountMatch.accountIndex === currentAccountIndex,
          });

          if (accountMatch.accountIndex !== currentAccountIndex) {
            // Token belongs to a different account - show error
            logger.cashu('claim_account_mismatch', {
              step: 'UI_CLAIM',
              currentAccount: currentAccountIndex,
              tokenAccount: accountMatch.accountIndex,
              error: 'Token belongs to a different account - user needs to switch',
            });
            throw new Error(`This proof belongs to account ${accountMatch.accountIndex + 1}. Please switch to that account to claim this token.`);
          }

          logger.cashu('claim_account_verified', {
            step: 'UI_CLAIM',
            accountIndex: currentAccountIndex,
            message: 'Token verified for current account - proceeding with claim',
          });

          // Step 3: Claiming token
          setCurrentStep(3);
          setCurrentMessage('Claiming token');

          // Redeem P2PK token with the correct account's private key
          logger.cashu('claim_p2pk_redeem_start', {
            step: 'UI_CLAIM',
            accountIndex: accountMatch.accountIndex,
            hasPrivateKey: !!accountMatch.privateKey,
            privateKeyLength: accountMatch.privateKey?.length,
            message: 'Starting P2PK token redemption',
          });

          const { receiveP2PKToken } = await import('../../services/cashu/cashuWalletService');
          await receiveP2PKToken(tokenString.trim(), accountMatch.privateKey);

          logger.cashu('claim_p2pk_redeem_success', {
            step: 'UI_CLAIM',
            accountIndex: accountMatch.accountIndex,
            message: 'P2PK token claimed successfully',
          });
        } else {
          // Step 2: Claiming token
          setCurrentStep(2);
          setCurrentMessage('Claiming token');

          // Regular token, redeem directly
          logger.cashu('claim_regular_redeem_start', {
            step: 'UI_CLAIM',
            tokenLength: tokenString?.length,
            message: 'Starting regular token redemption (no P2PK)',
          });

          const { receiveToken } = await import('../../services/cashu/cashuWalletService');
          await receiveToken(tokenString.trim());

          logger.cashu('claim_regular_redeem_success', {
            step: 'UI_CLAIM',
            message: 'Regular token claimed successfully',
          });
        }

        // Clear timeout on success
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        logger.cashu('claim_screen_success', {
          step: 'UI_CLAIM',
          message: 'Token claim complete - navigating to wallet with success',
        });

        txn.finish('ok');

        // Navigate back with success flag - snackbar will be shown by parent screen
        navigation.navigate('Wallet', {
          claimSuccess: true,
        });

      } catch (error) {
        logger.cashu('claim_screen_error', {
          step: 'UI_CLAIM',
          error: error.message,
          tokenLength: tokenString?.length,
          currentStep,
          currentMessage,
        });

        txn.finish('error');

        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        logger.cashu('claim_screen_navigate_error', {
          step: 'UI_CLAIM',
          error: error.message,
          message: 'Navigating to wallet with error state',
        });

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
