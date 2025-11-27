/**
 * useQRCodeHandler - Hook for handling QR code scanning and processing
 * Extracts the complex QR handling logic from WalletPage
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import { logger } from '../utils/logger';
import { hasP2PKProofs } from '../services/cashu/p2pk';
import { decodeToken, encodeToken } from '../services/cashu/crypto';
import { checkProofsSpent } from '../services/cashu/cashuMintClient';
import type { ToastType, SnackbarParams } from '../contexts/NotificationContext';

interface ReceiveTokenResult {
  amount: number;
}

interface UseQRCodeHandlerParams {
  receiveCashuToken: (token: string) => Promise<ReceiveTokenResult>;
  showToast: (message: string, type?: ToastType) => void;
  showSnackbar: (params: SnackbarParams) => void;
  setShowQRScanner: (value: boolean) => void;
}

interface Proof {
  id: string;
  amount: number;
  secret: string;
  C: string;
}

interface DecodedToken {
  proofs: Proof[];
  amount: number;
  mint: string;
}

interface ProofState {
  state: 'UNSPENT' | 'SPENT' | 'PENDING';
}

interface CheckProofsResult {
  states: ProofState[];
}

interface TokenEntry {
  mint: string;
  proofs: Proof[];
}

// Extend global for token processing
declare global {
  // eslint-disable-next-line no-var
  var processedCashuTokens: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var pendingCashuToken: string | undefined;
  // eslint-disable-next-line no-var
  var triggerPendingTokenCheck: (() => void) | undefined;
}

/**
 * Hook for handling various QR code formats
 */
export function useQRCodeHandler({
  receiveCashuToken,
  showToast,
  showSnackbar,
  setShowQRScanner,
}: UseQRCodeHandlerParams): (data: string) => Promise<void> {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const handleQRScan = useCallback(async (data: string) => {
    logger.debug('[useQRCodeHandler] QR scanned:', data);
    logger.debug('[useQRCodeHandler] Data length:', data.length);
    logger.debug('[useQRCodeHandler] First 100 chars:', data.substring(0, 100));

    // Handle Bitcoin addresses
    if (data.startsWith('bitcoin:') || data.startsWith('tb1') || data.startsWith('bc1')) {
      navigation.navigate('SendFlow', {
        screen: 'AddressInput',
        params: { scannedAddress: data },
      });
      requestAnimationFrame(() => setShowQRScanner(false));
      return;
    }

    // Handle Cashu tokens
    if (data.startsWith('cashu')) {
      try {
        // Check if this is a P2PK locked token (Turbo)
        const isP2PKToken = hasP2PKProofs(data);

        if (isP2PKToken) {
          // This is a Turbo token - check if already processed
          logger.debug('[useQRCodeHandler] P2PK token detected, checking if already processed');

          // Check if already processed
          const tokenHash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            data
          );

          if (global.processedCashuTokens && global.processedCashuTokens.has(tokenHash)) {
            logger.debug('[useQRCodeHandler] Token already processed, showing error');
            setShowQRScanner(false);
            showSnackbar({
              type: 'error',
              action: 'swap',
              description: 'Token already claimed',
            });
            return;
          }

          // Store token globally for processing
          logger.debug('[useQRCodeHandler] Processing new token');
          global.pendingCashuToken = data;

          // Close scanner immediately
          setShowQRScanner(false);

          // Trigger the claim process which shows the loading overlay
          if (typeof global.triggerPendingTokenCheck === 'function') {
            const triggerCheck = global.triggerPendingTokenCheck;
            setTimeout(() => triggerCheck(), 50);
          }
          return;
        }

        // Regular token - check proofs first
        showToast('Checking token...', 'info');

        // Decode and analyze the token
        const decoded = decodeToken(data) as DecodedToken;
        const { proofs, amount } = decoded;

        // Check which proofs are spent
        const stateResult = await checkProofsSpent(proofs) as CheckProofsResult;

        const spentProofs = stateResult.states.filter(s => s.state !== 'UNSPENT');
        const unspentProofs = proofs.filter((_, idx) =>
          stateResult.states[idx].state === 'UNSPENT'
        );

        const unspentAmount = unspentProofs.reduce((sum, p) => sum + p.amount, 0);

        if (spentProofs.length > 0 && unspentProofs.length === 0) {
          // All proofs spent
          showSnackbar({
            type: 'error',
            action: 'swap',
            description: 'All proofs in this token have been spent',
          });
        } else if (spentProofs.length > 0) {
          // Some proofs spent - ask user
          Alert.alert(
            'Partial Token',
            `This token has ${proofs.length} proofs totaling ${amount} UNIT.\n\n` +
            `${spentProofs.length} proofs (${amount - unspentAmount} UNIT) already spent.\n` +
            `${unspentProofs.length} proofs (${unspentAmount} UNIT) can be claimed.\n\n` +
            `Claim the ${unspentAmount} UNIT?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Claim',
                onPress: async () => {
                  try {
                    showToast('Claiming unspent proofs...', 'info');

                    // Create a new token with only unspent proofs
                    const filteredToken: { token: TokenEntry[] } = {
                      token: [{
                        mint: decoded.mint,
                        proofs: unspentProofs
                      }]
                    };
                    const filteredTokenString = encodeToken(filteredToken.token[0].proofs, filteredToken.token[0].mint);

                    const result = await receiveCashuToken(filteredTokenString);
                    showSnackbar({
                      type: 'success',
                      action: 'claim',
                      description: `Successfully claimed ${result.amount} UNIT`,
                    });
                  } catch (error: unknown) {
                    logger.error('[useQRCodeHandler] Claim failed:', { error: error instanceof Error ? error.message : String(error) });
                    showSnackbar({
                      type: 'error',
                      action: 'claim',
                      description: `Failed to claim: ${error instanceof Error ? error.message : String(error)}`,
                    });
                  }
                }
              }
            ]
          );
        } else {
          // All proofs unspent - claim directly
          showToast('Claiming token...', 'info');
          const result = await receiveCashuToken(data);
          showSnackbar({
            type: 'success',
            action: 'claim',
            description: `Successfully claimed ${result.amount} UNIT`,
          });
        }
      } catch (error: unknown) {
        logger.error('[useQRCodeHandler] Token check failed:', { error: error instanceof Error ? error.message : String(error) });
        showSnackbar({
          type: 'error',
          action: 'claim',
          description: `Failed to process token: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      return;
    }

    // Handle JSON proofs format
    if (data.startsWith('{') || data.startsWith('[')) {
      try {
        const parsed = JSON.parse(data) as { token?: TokenEntry[]; proofs?: Proof[] };
        logger.debug('[useQRCodeHandler] Parsed JSON:', parsed);

        // If it's already a proper token object with proofs, encode it
        if (parsed.token && Array.isArray(parsed.token)) {
          const firstEntry = parsed.token[0];
          const encoded = encodeToken(firstEntry.proofs, firstEntry.mint);
          logger.debug('[useQRCodeHandler] Encoded token:', { tokenStart: encoded.substring(0, 50) });

          showToast('Claiming token...', 'info');
          const result = await receiveCashuToken(encoded);
          showSnackbar({
            type: 'success',
            action: 'claim',
            description: `Successfully claimed ${result.amount} UNIT`,
          });
        } else if (Array.isArray(parsed.proofs) || Array.isArray(parsed)) {
          // Raw proofs array - need to wrap it
          showSnackbar({
            type: 'error',
            action: 'claim',
            description: 'Invalid token format - raw proofs not supported',
          });
        } else {
          showSnackbar({
            type: 'error',
            action: 'claim',
            description: 'Invalid JSON token format',
          });
        }
      } catch (error: unknown) {
        logger.error('[useQRCodeHandler] Failed to parse/claim JSON token:', { error: error instanceof Error ? error.message : String(error) });
        showSnackbar({
          type: 'error',
          action: 'claim',
          description: `Failed to claim token: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      return;
    }

    // Handle Turbo URL formats
    if (data.includes('ducat://turbo/') || data.includes('unit?')) {
      try {
        let token = null;

        // Check if this is the ducat://turbo/ format
        const turboMatch = data.match(/ducat:\/\/turbo\/([^/?#]+)/);
        if (turboMatch && turboMatch[1]) {
          token = turboMatch[1];
          logger.debug('[useQRCodeHandler] Extracted token from ducat:// URL');
        }
        // Check if this is a direct token link with base64 encoded token
        else {
          const tokenMatch = data.match(/[?&]t=([^&]+)/);
          if (tokenMatch && tokenMatch[1]) {
            // Decode URL-safe base64
            let base64Token = tokenMatch[1]
              .replace(/-/g, '+')
              .replace(/_/g, '/');

            // Add padding
            while (base64Token.length % 4) {
              base64Token += '=';
            }

            token = atob(base64Token);
            logger.debug('[useQRCodeHandler] Decoded base64 token');
          }
        }

        if (token) {
          // Navigate to claiming screen
          navigation.navigate('SendFlow', {
            screen: 'TurboClaiming',
            params: { tokenString: token },
          });
        } else {
          showToast('Failed to extract token from URL', 'error');
        }
      } catch (error: unknown) {
        logger.error('[useQRCodeHandler] Failed to extract token:', { error: error instanceof Error ? error.message : String(error) });
        showToast(`Failed to extract token: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
      return;
    }

    // Unknown format
    logger.debug('[useQRCodeHandler] Unknown QR format:', { data });
    showToast('Unknown QR code format', 'error');
  }, [navigation, receiveCashuToken, showToast, showSnackbar, setShowQRScanner]);

  return handleQRScan;
}

export default useQRCodeHandler;
