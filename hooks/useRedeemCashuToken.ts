/**
 * useRedeemCashuToken Hook
 * Handles redeeming Cashu tokens (both regular and P2PK)
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { logger } from '../utils/logger';
import { getCurrentAccount } from '../services/secureStorageService';
import {
  decodeTokenMetadata,
  findAccountForP2PKToken,
  getP2PKRecipient,
  isP2PKSecret,
  receiveP2PKToken,
  receiveToken,
} from '../services/cashu/cashuWalletService';

interface UseRedeemCashuTokenParams {
  fetchTransactionHistory: () => Promise<void> | void;
}

interface UseRedeemCashuTokenReturn {
  handleRedeemToken: () => void;
}

interface DecodedToken {
  mint: string;
  proofs: Array<{
    secret: string;
    amount: number;
    C: string;
    id?: string;
  }>;
  amount: number;
}

interface AccountMatch {
  accountIndex: number;
  address: string;
  privateKey: string;
}

const isSupportedCashuToken = (token: string): boolean => /^cashuB/i.test(token);

export function useRedeemCashuToken({ fetchTransactionHistory }: UseRedeemCashuTokenParams): UseRedeemCashuTokenReturn {
  const handleRedeemToken = useCallback(() => {
    Alert.prompt(
      'Redeem Cashu Token',
      'Paste your Cashu token to redeem:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async (tokenString: string | undefined) => {
            if (!tokenString || !tokenString.trim()) {
              logger.cashu('manual_redeem_empty', {
                step: 'MANUAL_REDEEM',
                error: 'Empty token string provided',
              });
              Alert.alert('Error', 'Please enter a valid token');
              return;
            }

            logger.cashu('manual_redeem_start', {
              step: 'MANUAL_REDEEM',
              tokenLength: tokenString?.length,
              message: 'User initiated manual token redemption',
            });

            try {
              const trimmedToken = tokenString.trim();
              if (!isSupportedCashuToken(trimmedToken)) {
                Alert.alert('Error', 'Only cashuB UNIT tokens are supported');
                return;
              }

              const decoded = decodeTokenMetadata(trimmedToken) as DecodedToken | null;

              if (!decoded || !decoded.proofs || !Array.isArray(decoded.proofs)) {
                logger.cashu('manual_redeem_invalid_format', {
                  step: 'MANUAL_REDEEM',
                  hasDecoded: !!decoded,
                  hasProofs: !!decoded?.proofs,
                  error: 'Invalid token format',
                });
                Alert.alert('Error', 'Invalid token format');
                return;
              }

              const hasP2PKProofs = decoded.proofs.some(p => isP2PKSecret(p.secret));

              logger.cashu('manual_redeem_p2pk_detection', {
                step: 'MANUAL_REDEEM',
                hasP2PK: hasP2PKProofs,
                proofCount: decoded.proofs.length,
                message: hasP2PKProofs ? 'Token contains P2PK locked proofs' : 'Regular token (no P2PK)',
              });

              if (hasP2PKProofs) {
                await redeemP2PKToken(trimmedToken, decoded, fetchTransactionHistory);
              } else {
                await redeemRegularToken(trimmedToken, fetchTransactionHistory);
              }
            } catch (error: unknown) {
              logger.cashu('manual_redeem_error', {
                step: 'MANUAL_REDEEM',
                error: error instanceof Error ? error.message : String(error),
              });
              Alert.alert('Error', `Failed to redeem token: ${error instanceof Error ? error.message : String(error)}`);
            }
          },
        },
      ],
      'plain-text'
    );
  }, [fetchTransactionHistory]);

  return { handleRedeemToken };
}

async function redeemP2PKToken(
  tokenString: string,
  decoded: DecodedToken,
  fetchTransactionHistory: () => Promise<void> | void
): Promise<void> {
  logger.cashu('manual_p2pk_redeem_start', {
    step: 'MANUAL_REDEEM',
    proofCount: decoded.proofs?.length,
    message: 'Starting P2PK token redemption (manual)',
  });

  // Extract recipient pubkey
  let recipientPubkey: string | null = null;
  for (const proof of decoded.proofs) {
    if (proof.secret) {
      const pubkey = getP2PKRecipient(proof.secret);
      if (pubkey) {
        recipientPubkey = pubkey;
                logger.cashu('manual_p2pk_pubkey_found', {
                  step: 'MANUAL_REDEEM',
                  pubkeyLength: pubkey?.length,
                });
        break;
      }
    }
  }

  if (!recipientPubkey) {
    logger.cashu('manual_p2pk_pubkey_missing', {
      step: 'MANUAL_REDEEM',
      proofCount: decoded.proofs?.length,
      error: 'Could not extract recipient pubkey',
    });
    Alert.alert('Error', 'Could not extract recipient pubkey from P2PK token');
    return;
  }

  // Find matching account
  logger.cashu('manual_p2pk_account_search_start', {
    step: 'MANUAL_REDEEM',
    targetPubkeyLength: recipientPubkey?.length,
    message: 'Searching for account that owns this P2PK token',
  });

  const accountMatch: AccountMatch | null = await findAccountForP2PKToken(recipientPubkey);

  if (!accountMatch) {
    logger.cashu('manual_p2pk_account_not_found', {
      step: 'MANUAL_REDEEM',
      targetPubkeyLength: recipientPubkey?.length,
      error: 'Token does not belong to any scanned account',
    });
    Alert.alert('Error', 'This token is not locked to any of your accounts (checked 50 accounts). Make sure you are using the correct wallet.');
    return;
  }

  logger.cashu('manual_p2pk_account_found', {
    step: 'MANUAL_REDEEM',
    accountIndex: accountMatch.accountIndex,
    addressLength: accountMatch.address?.length,
    message: 'Found matching account for P2PK token',
  });

  // Check if token belongs to current account
  const currentAccountIndex = await getCurrentAccount();

  logger.cashu('manual_p2pk_account_comparison', {
    step: 'MANUAL_REDEEM',
    currentAccountIndex,
    tokenAccountIndex: accountMatch.accountIndex,
    isMatch: accountMatch.accountIndex === currentAccountIndex,
  });

  if (accountMatch.accountIndex !== currentAccountIndex) {
    logger.cashu('manual_p2pk_account_mismatch', {
      step: 'MANUAL_REDEEM',
      currentAccount: currentAccountIndex,
      tokenAccount: accountMatch.accountIndex,
      error: 'Token belongs to different account',
    });
    Alert.alert('Wrong Account', `This proof belongs to account ${accountMatch.accountIndex + 1}. Please switch to that account to claim this token.`);
    return;
  }

  // Redeem with correct private key
  logger.cashu('manual_p2pk_redeem_execute', {
    step: 'MANUAL_REDEEM',
    accountIndex: accountMatch.accountIndex,
    hasPrivateKey: !!accountMatch.privateKey,
    message: 'Executing P2PK token redemption',
  });

  await receiveP2PKToken(tokenString, accountMatch.privateKey);
  await fetchTransactionHistory();

  logger.cashu('manual_p2pk_redeem_success', {
    step: 'MANUAL_REDEEM',
    accountIndex: accountMatch.accountIndex,
    message: 'P2PK token redeemed successfully',
  });

  Alert.alert('Success', 'P2PK token redeemed successfully!');
}

async function redeemRegularToken(
  tokenString: string,
  fetchTransactionHistory: () => Promise<void> | void
): Promise<void> {
  logger.cashu('manual_regular_redeem_start', {
    step: 'MANUAL_REDEEM',
    tokenLength: tokenString?.length,
    message: 'Starting regular token redemption (manual)',
  });

  await receiveToken(tokenString);
  await fetchTransactionHistory();

  logger.cashu('manual_regular_redeem_success', {
    step: 'MANUAL_REDEEM',
    message: 'Regular token redeemed successfully',
  });

  Alert.alert('Success', 'Token redeemed successfully!');
}
