/**
 * useRedeemCashuToken Hook
 * Handles redeeming Cashu tokens (both regular and P2PK)
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { logger } from '../utils/logger';

export function useRedeemCashuToken({ fetchTransactionHistory }) {
  const handleRedeemToken = useCallback(() => {
    Alert.prompt(
      'Redeem Cashu Token',
      'Paste your Cashu token to redeem:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async (tokenString) => {
            if (!tokenString || !tokenString.trim()) {
              Alert.alert('Error', 'Please enter a valid token');
              return;
            }

            try {
              const { decodeToken } = await import('../services/cashu/crypto');
              const { isP2PKSecret } = await import('../services/cashu/p2pk');
              const decoded = decodeToken(tokenString.trim());

              if (!decoded || !decoded.proofs || !Array.isArray(decoded.proofs)) {
                Alert.alert('Error', 'Invalid token format');
                return;
              }

              const hasP2PKProofs = decoded.proofs.some(p => isP2PKSecret(p.secret));

              if (hasP2PKProofs) {
                await redeemP2PKToken(tokenString.trim(), decoded, fetchTransactionHistory);
              } else {
                await redeemRegularToken(tokenString.trim(), fetchTransactionHistory);
              }
            } catch (error) {
              Alert.alert('Error', `Failed to redeem token: ${error.message}`);
            }
          },
        },
      ],
      'plain-text'
    );
  }, [fetchTransactionHistory]);

  return { handleRedeemToken };
}

async function redeemP2PKToken(tokenString, decoded, fetchTransactionHistory) {
  logger.debug('[RedeemToken] Token is P2PK-locked, finding correct account');

  const { getP2PKRecipient, findAccountForP2PKToken } = await import('../services/cashu/p2pk');

  // Extract recipient pubkey
  let recipientPubkey = null;
  for (const proof of decoded.proofs) {
    if (proof.secret) {
      const pubkey = getP2PKRecipient(proof.secret);
      if (pubkey) {
        recipientPubkey = pubkey;
        logger.debug('[RedeemToken] Found P2PK recipient pubkey');
        break;
      }
    }
  }

  if (!recipientPubkey) {
    Alert.alert('Error', 'Could not extract recipient pubkey from P2PK token');
    return;
  }

  // Find matching account
  const accountMatch = await findAccountForP2PKToken(recipientPubkey);

  if (!accountMatch) {
    Alert.alert('Error', 'This token is not locked to any of your accounts (checked 50 accounts). Make sure you are using the correct wallet.');
    return;
  }

  logger.debug('[RedeemToken] Found matching account:', { accountIndex: accountMatch.accountIndex });

  // Check if token belongs to current account
  const { getCurrentAccount } = await import('../services/secureStorageService');
  const currentAccountIndex = await getCurrentAccount();

  if (accountMatch.accountIndex !== currentAccountIndex) {
    Alert.alert('Wrong Account', `This proof belongs to account ${accountMatch.accountIndex + 1}. Please switch to that account to claim this token.`);
    return;
  }

  // Redeem with correct private key
  const { receiveP2PKToken } = await import('../services/cashu/cashuWalletService');
  await receiveP2PKToken(tokenString, accountMatch.privateKey);
  await fetchTransactionHistory();
  Alert.alert('Success', 'P2PK token redeemed successfully!');
}

async function redeemRegularToken(tokenString, fetchTransactionHistory) {
  const { receiveToken } = await import('../services/cashu/cashuWalletService');
  await receiveToken(tokenString);
  await fetchTransactionHistory();
  Alert.alert('Success', 'Token redeemed successfully!');
}
