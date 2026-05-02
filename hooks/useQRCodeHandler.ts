/**
 * useQRCodeHandler - Hook for handling QR code scanning and processing
 * Extracts the complex QR handling logic from WalletPage
 */

import { NavigationProp,ParamListBase,useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  checkProofsSpent,
  decodeToken,
  decodeTokenMetadata,
  encodeToken,
  getOrFetchKeys,
  hasP2PKProofs,
} from '../services/cashu/cashuWalletService';
import { getKeysetIdsFromMintKeys } from '../services/cashu/cashuTsCompat';
import { isTurboTokenUrl, resolveCashuTokenFromUrl } from '../services/turbo/turboTokenUrl';
import type { SnackbarParams } from '../stores/notificationStore';
import { useTokenProcessingStore } from '../stores/tokenProcessingStore';
import { TAPROOT_ADDRESS_PREFIX, validateBitcoinAddress } from '../utils/bitcoin';
import { logger } from '../utils/logger';
import { notify } from '../utils/notify';

interface ReceiveTokenResult {
  amount: number;
}

interface UseQRCodeHandlerParams {
  receiveCashuToken: (token: string) => Promise<ReceiveTokenResult>;
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

function classifyQrPayload(data: string): string {
  const lower = data.toLowerCase();
  if (lower.startsWith('cashub')) return 'cashu_token';
  if (lower.startsWith('cashu')) return 'unsupported_cashu_token';
  if (lower.startsWith('bitcoin:')) return 'bitcoin_uri';
  if (lower.startsWith('tb1') || lower.startsWith('bc1')) return 'bitcoin_address';
  if (isTurboTokenUrl(data)) return 'turbo_url';
  if (data.startsWith('{') || data.startsWith('[')) return 'json';
  return 'unknown';
}

const isSupportedCashuToken = (token: string): boolean => /^cashuB/i.test(token);

/**
 * Hook for handling various QR code formats
 */
export function useQRCodeHandler({
  receiveCashuToken,
  showSnackbar,
  setShowQRScanner,
}: UseQRCodeHandlerParams): (data: string) => Promise<void> {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const tokenStore = useTokenProcessingStore();

  const handleQRScan = useCallback(async (data: string) => {
    const trimmedData = data.trim();
    const lowerData = trimmedData.toLowerCase();
    logger.debug('[useQRCodeHandler] QR scanned', {
      length: trimmedData.length,
      kind: classifyQrPayload(trimmedData),
    });

    // Handle Bitcoin addresses and BIP21 URIs. Mainnet-looking addresses are
    // routed through validation so the user sees the explicit Mutinynet error.
    if (lowerData.startsWith('bitcoin:') || lowerData.startsWith('tb1') || lowerData.startsWith('bc1')) {
      // Extract address from BIP21 URI if present (bitcoin:address?amount=...)
      let address = trimmedData;
      if (lowerData.startsWith('bitcoin:')) {
        address = trimmedData.replace(/^bitcoin:/i, '').split('?')[0].trim();
      }

      // Close scanner FIRST before any navigation/snackbar to prevent race conditions
      setShowQRScanner(false);

      const validation = validateBitcoinAddress(address);
      if (!validation.valid) {
        showSnackbar({
          type: 'error',
          action: 'send',
          description: validation.error || 'Invalid Bitcoin address',
        });
        return;
      }

      // Determine asset type based on address type
      // Mutinynet Taproot addresses default to UNIT, segwit defaults to BTC.
      const lowerAddress = address.toLowerCase();
      const isTaproot = lowerAddress.startsWith(TAPROOT_ADDRESS_PREFIX);
      const assetType = isTaproot ? 'unit' : 'btc';

      // Navigate to send flow - address is passed via route params, not the store
      // Don't call resetSendFlow here as it would clear the prefilled address
      navigation.navigate('SendFlow', {
        screen: 'SendInput',
        params: { prefillAddress: address, assetType },
      });
      return;
    }

    // Handle Cashu tokens
    if (lowerData.startsWith('cashu')) {
      if (!isSupportedCashuToken(trimmedData)) {
        setShowQRScanner(false);
        showSnackbar({
          type: 'error',
          action: 'claim',
          description: 'Only cashuB UNIT tokens are supported',
        });
        return;
      }

      try {
        // Check if this is a P2PK locked token (Turbo)
        const isP2PKToken = hasP2PKProofs(trimmedData);

        if (isP2PKToken) {
          // This is a Turbo token - check if already processed
          logger.debug('[useQRCodeHandler] P2PK token detected, checking if already processed');

          // Check if already processed using the token store
          const alreadyProcessed = await tokenStore.isTokenProcessed(trimmedData);
          if (alreadyProcessed) {
            logger.debug('[useQRCodeHandler] Token already processed, showing error');
            setShowQRScanner(false);
            showSnackbar({
              type: 'error',
              action: 'swap',
              description: 'Token already claimed',
            });
            return;
          }

          // Store token in store for processing
          logger.debug('[useQRCodeHandler] Processing new token');
          tokenStore.setPendingToken(trimmedData);

          // Close scanner immediately
          setShowQRScanner(false);

          // Trigger the claim process which shows the loading overlay
          tokenStore.triggerTokenCheck();
          return;
        }

        // Regular token - close scanner first, then check proofs
        setShowQRScanner(false);
        notify.token.checking();

        const metadata = decodeTokenMetadata(trimmedData);
        const keyData = await getOrFetchKeys();
        const decoded = decodeToken(trimmedData, getKeysetIdsFromMintKeys(keyData)) as DecodedToken;
        const { proofs, amount } = decoded;

        // Check which proofs are spent
        const stateResult = await checkProofsSpent(metadata.proofs) as CheckProofsResult;

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
                    notify.token.claimingUnspent();

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
          notify.token.claiming();
          const result = await receiveCashuToken(trimmedData);
          showSnackbar({
            type: 'success',
            action: 'claim',
            description: `Successfully claimed ${result.amount} UNIT`,
          });
        }
      } catch (error: unknown) {
        logger.error('[useQRCodeHandler] Token check failed:', { error: error instanceof Error ? error.message : String(error) });
        setShowQRScanner(false);
        showSnackbar({
          type: 'error',
          action: 'claim',
          description: `Failed to process token: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      return;
    }

    // Handle JSON proofs format
    if (trimmedData.startsWith('{') || trimmedData.startsWith('[')) {
      // Close scanner first
      setShowQRScanner(false);
      try {
        const parsed = JSON.parse(trimmedData) as { token?: TokenEntry[]; proofs?: Proof[] };
        logger.debug('[useQRCodeHandler] Parsed JSON token payload', {
          hasTokenEntries: Array.isArray(parsed.token),
          hasProofs: Array.isArray(parsed.proofs) || Array.isArray(parsed),
        });

        // If it's already a proper token object with proofs, encode it
        if (parsed.token && Array.isArray(parsed.token)) {
          const firstEntry = parsed.token[0];
          const encoded = encodeToken(firstEntry.proofs, firstEntry.mint);
          logger.debug('[useQRCodeHandler] Encoded token', { tokenLength: encoded.length });

          notify.token.claiming();
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
    if (isTurboTokenUrl(trimmedData)) {
      try {
        const token = await resolveCashuTokenFromUrl(trimmedData);

        if (token) {
          if (!isSupportedCashuToken(token)) {
            setShowQRScanner(false);
            showSnackbar({
              type: 'error',
              action: 'claim',
              description: 'Only cashuB UNIT tokens are supported',
            });
            return;
          }

          const alreadyProcessed = await tokenStore.isTokenProcessed(token);
          if (alreadyProcessed) {
            setShowQRScanner(false);
            showSnackbar({
              type: 'error',
              action: 'swap',
              description: 'Token already claimed',
            });
            return;
          }

          // Close scanner FIRST, then hand the token to the unified processor.
          setShowQRScanner(false);
          tokenStore.setPendingToken(token);
          tokenStore.triggerTokenCheck();
        } else {
          setShowQRScanner(false);
          notify.token.extractFailed();
        }
      } catch (error: unknown) {
        logger.error('[useQRCodeHandler] Failed to extract token:', { error: error instanceof Error ? error.message : String(error) });
        setShowQRScanner(false);
        notify.token.extractError(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    // Unknown format - close scanner and notify
    setShowQRScanner(false);
    logger.debug('[useQRCodeHandler] Unknown QR format', {
      length: trimmedData.length,
      kind: classifyQrPayload(trimmedData),
    });
    notify.token.unknownFormat();
  }, [navigation, receiveCashuToken, showSnackbar, setShowQRScanner, tokenStore]);

  return handleQRScan;
}
