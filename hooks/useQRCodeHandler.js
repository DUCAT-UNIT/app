/**
 * useQRCodeHandler - Hook for handling QR code scanning and processing
 * Extracts the complex QR handling logic from WalletPage
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { logger } from '../utils/logger';

/**
 * Hook for handling various QR code formats
 * @param {Object} params
 * @param {Function} params.receiveCashuToken - Function to receive Cashu tokens
 * @param {Function} params.showToast - Function to show toast notifications
 * @param {Function} params.showSnackbar - Function to show snackbar notifications
 * @param {Function} params.setShowQRScanner - Function to control QR scanner visibility
 * @returns {Function} handleQRScan function
 */
export function useQRCodeHandler({
  receiveCashuToken,
  showToast,
  showSnackbar,
  setShowQRScanner,
}) {
  const navigation = useNavigation();

  const handleQRScan = useCallback(async (data) => {
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
        const { hasP2PKProofs } = await import('../services/cashu/cashuP2PK');
        const isP2PKToken = hasP2PKProofs(data);

        if (isP2PKToken) {
          // This is a Turbo token - check if already processed
          logger.debug('[useQRCodeHandler] P2PK token detected, checking if already processed');

          // Check if already processed
          const Crypto = await import('expo-crypto');
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
            setTimeout(() => global.triggerPendingTokenCheck(), 50);
          }
          return;
        }

        // Regular token - check proofs first
        showToast('Checking token...', 'info');

        // Decode and analyze the token
        const { decodeToken } = await import('../services/cashu/cashuCrypto');
        const decoded = decodeToken(data);
        const { proofs, amount } = decoded;

        // Check which proofs are spent
        const { checkProofsSpent } = await import('../services/cashu/cashuMintClient');
        const stateResult = await checkProofsSpent(proofs);

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
                    const { encodeToken } = await import('../services/cashu/cashuCrypto');
                    const filteredToken = {
                      token: [{
                        mint: decoded.mint,
                        proofs: unspentProofs
                      }]
                    };
                    const filteredTokenString = encodeToken(filteredToken.token[0].mint, filteredToken.token[0].proofs);

                    const result = await receiveCashuToken(filteredTokenString);
                    showSnackbar({
                      type: 'success',
                      action: 'claim',
                      description: `Successfully claimed ${result.amount} UNIT`,
                    });
                  } catch (error) {
                    logger.error('[useQRCodeHandler] Claim failed:', error);
                    showSnackbar({
                      type: 'error',
                      action: 'claim',
                      description: `Failed to claim: ${error.message}`,
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
      } catch (error) {
        logger.error('[useQRCodeHandler] Token check failed:', error);
        showSnackbar({
          type: 'error',
          action: 'claim',
          description: `Failed to process token: ${error.message}`,
        });
      }
      return;
    }

    // Handle JSON proofs format
    if (data.startsWith('{') || data.startsWith('[')) {
      try {
        const parsed = JSON.parse(data);
        logger.debug('[useQRCodeHandler] Parsed JSON:', parsed);

        // If it's already a proper token object with proofs, encode it
        if (parsed.token && Array.isArray(parsed.token)) {
          const { encodeToken } = await import('../services/cashu/cashuCrypto');
          const encoded = encodeToken(parsed);
          logger.debug('[useQRCodeHandler] Encoded token:', encoded.substring(0, 50));

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
      } catch (error) {
        logger.error('[useQRCodeHandler] Failed to parse/claim JSON token:', error);
        showSnackbar({
          type: 'error',
          action: 'claim',
          description: `Failed to claim token: ${error.message}`,
        });
      }
      return;
    }

    // Handle Turbo URL formats
    if (data.includes('ducat://turbo/') || data.includes('unit?')) {
      try {
        let token = null;

        // Check if this is the ducat://turbo/ format
        const turboMatch = data.match(/ducat:\/\/turbo\/([^\/?#]+)/);
        if (turboMatch && turboMatch[1]) {
          token = turboMatch[1];
          logger.debug('[useQRCodeHandler] Extracted token from ducat:// URL');
        }
        // Check if this is an ID-based link
        else {
          const idMatch = data.match(/[?&]id=([^&]+)/);
          if (idMatch && idMatch[1]) {
            showToast('Fetching token...', 'info');
            const { fetchTokenFromRebrandly } = await import('../services/urlShortener');
            token = await fetchTokenFromRebrandly(idMatch[1]);
            logger.debug('[useQRCodeHandler] Fetched token from Rebrandly');
          }
          // Check if this is a direct token link
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
      } catch (error) {
        logger.error('[useQRCodeHandler] Failed to extract token:', error);
        showToast(`Failed to extract token: ${error.message}`, 'error');
      }
      return;
    }

    // Unknown format
    logger.debug('[useQRCodeHandler] Unknown QR format:', data);
    showToast('Unknown QR code format', 'error');
  }, [navigation, receiveCashuToken, showToast, showSnackbar, setShowQRScanner]);

  return handleQRScan;
}

export default useQRCodeHandler;
