/**
 * ConfirmationScreen - Full screen showing successful transaction confirmation
 * Features: success checkmark, explorer link, Done button
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, TouchableOpacity, Linking, StyleSheet, Alert, ActivityIndicator, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { getTxUrl } from '../../utils/constants';
import { useTransactionExecution } from '../../contexts/TransactionExecutionContext';
import { useTransactionHistory } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
import { useCashu } from '../../contexts/CashuContext';

export default function ConfirmationScreen({ navigation, route }) {
  const { broadcastedTxid } = useTransactionExecution();
  const { fetchTransactionHistory } = useTransactionHistory();
  const { wallet } = useWallet();
  const { refresh: refreshCashuBalance } = useCashu();
  const isTurbo = route?.params?.isTurbo === true;
  const mintQuoteId = route?.params?.mintQuoteId;
  const mintAmount = route?.params?.mintAmount;
  const turboRecipient = route?.params?.turboRecipient; // Original recipient address for P2PK locking
  const turboAmount = route?.params?.turboAmount; // Amount in smallest units
  const skipMint = route?.params?.skipMint === true; // If true, token was created directly from ecash
  const [isCompletingMint, setIsCompletingMint] = useState(false);
  const [turboToken, setTurboToken] = useState(route?.params?.turboToken || null); // Store the P2PK locked token
  const hasMintCompleted = useRef(false);
  const [turboDeeplink, setTurboDeeplink] = useState(null);

  // Log all route params on mount for debugging
  useEffect(() => {
    console.log('[ConfirmationScreen] Mounted with route params:', route?.params);
    console.log('[ConfirmationScreen] Extracted values:', {
      isTurbo,
      mintQuoteId,
      mintAmount,
      turboRecipient,
      broadcastedTxid,
      cashuMint: route?.params?.cashuMint,
      quoteId: route?.params?.quoteId,
    });

    // Debug: Check if we should be creating a token
    if (isTurbo && turboRecipient) {
      console.log('[ConfirmationScreen] ✅ Should create P2PK token - all params present');
    } else if (isTurbo && !turboRecipient) {
      console.log('[ConfirmationScreen] ⚠️ isTurbo=true but turboRecipient is missing!');
    }
  }, []);

  // Refresh transaction history when confirmation screen appears
  useEffect(() => {
    if (fetchTransactionHistory) {
      fetchTransactionHistory();
    }
  }, [fetchTransactionHistory]);

  // Debug: Log when turboToken changes
  useEffect(() => {
    console.log('[ConfirmationScreen] 🎫 turboToken state changed:', turboToken ? `Token present (${turboToken.length} chars)` : 'null');
  }, [turboToken]);

  // Generate Turbo deeplink when token is ready
  useEffect(() => {
    if (turboToken && turboRecipient && turboAmount) {
      const generateLink = async () => {
        try {
          const { generateTurboDeeplink } = await import('../../services/cashu/cashuLockedTokensService');
          const deeplink = await generateTurboDeeplink(turboToken, turboRecipient, turboAmount);
          setTurboDeeplink(deeplink);
          console.log('[ConfirmationScreen] Generated Turbo deeplink:', deeplink);
        } catch (error) {
          console.error('[ConfirmationScreen] Failed to generate deeplink:', error);
        }
      };
      generateLink();
    }
  }, [turboToken, turboRecipient, turboAmount]);

  // Handle Turbo mint completion
  useEffect(() => {
    console.log('[ConfirmationScreen] Checking mint completion:', {
      isTurbo,
      mintQuoteId,
      mintAmount,
      skipMint,
      hasMintCompleted: hasMintCompleted.current
    });

    // Skip mint polling if token was created directly from ecash
    if (skipMint) {
      console.log('[ConfirmationScreen] Token created directly from ecash - skipping mint flow');
      return;
    }

    // Only proceed if this is a Turbo flow with all required params
    if (!isTurbo) {
      console.log('[ConfirmationScreen] Not a Turbo transaction, skipping mint completion');
      return;
    }

    if (!mintQuoteId || !mintAmount) {
      console.error('[ConfirmationScreen] MISSING REQUIRED PARAMS:', {
        mintQuoteId: !!mintQuoteId,
        mintAmount: !!mintAmount,
      });
      Alert.alert('Error', 'Missing quote information. Cannot complete conversion.');
      return;
    }

    if (hasMintCompleted.current) {
      console.log('[ConfirmationScreen] Mint already completed, skipping');
      return;
    }

    hasMintCompleted.current = true;
    console.log('[ConfirmationScreen] Starting mint completion process');

    const completeMintProcess = async () => {
      setIsCompletingMint(true);
      try {
        const { completeMint, sendP2PKToken } = await import('../../services/cashu/cashuWalletService');
        const { checkMintQuote } = await import('../../services/cashu/cashuMintClient');
        const { extractPubkeyFromTaprootAddress } = await import('../../utils/bitcoin');
        console.log('[ConfirmationScreen] Starting to poll for payment confirmation');

        // Poll for payment confirmation
        let paidQuote = null;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds

        while (!paidQuote && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const quote = await checkMintQuote(mintQuoteId);
          console.log(`[ConfirmationScreen] Check ${attempts + 1}/${maxAttempts}:`, quote);
          if (quote.state === 'PAID' || quote.state === 'ISSUED') {
            paidQuote = quote;
            break;
          }
          attempts++;
        }

        if (paidQuote) {
          console.log('[ConfirmationScreen] Payment confirmed! Completing mint with amount:', paidQuote.amount);
          // Complete mint to get e-cash tokens - quote.amount is already in smallest units
          await completeMint(mintQuoteId, paidQuote.amount);
          console.log('[ConfirmationScreen] Mint completed successfully');

          // If this is new Turbo mode (with turboRecipient), create P2PK locked token
          if (turboRecipient) {
            console.log('[ConfirmationScreen] Creating P2PK locked token for recipient:', turboRecipient);

            // Get balance before creating token
            const { getBalance } = await import('../../services/cashu/cashuWalletService');
            const balanceBefore = await getBalance();
            console.log('[ConfirmationScreen] Balance before P2PK token creation:', balanceBefore);

            // For P2PK, lock to the OUTPUT pubkey extracted from the recipient's Taproot address
            // The Taproot address directly encodes the output pubkey (tweaked pubkey)
            const { extractPubkeyFromTaprootAddress } = await import('../../utils/bitcoin');
            const recipientPubkey = extractPubkeyFromTaprootAddress(turboRecipient);

            console.log('[ConfirmationScreen] Recipient pubkey for P2PK locking:', {
              address: turboRecipient,
              pubkey: recipientPubkey.substring(0, 16) + '...',
            });

            // Use quote amount directly (already in smallest units)
            console.log('[ConfirmationScreen] Creating P2PK token for amount (smallest units):', paidQuote.amount);

            // Create P2PK locked token - this should remove the unlocked proofs
            const { token, balance: balanceAfter } = await sendP2PKToken(paidQuote.amount, recipientPubkey);
            console.log('[ConfirmationScreen] P2PK token created successfully');
            console.log('[ConfirmationScreen] Balance after P2PK token creation:', balanceAfter);
            console.log('[ConfirmationScreen] Proofs cleaned up:', balanceBefore - balanceAfter, 'removed');

            // Verify cleanup worked (compare display units)
            const expectedDecrease = paidQuote.amount / 100; // Convert smallest units to display units
            const actualDecrease = balanceBefore - balanceAfter;
            if (Math.abs(actualDecrease - expectedDecrease) > 0.01) {
              console.warn('[ConfirmationScreen] WARNING: Balance mismatch after P2PK creation', {
                expected: expectedDecrease,
                actual: actualDecrease,
                difference: Math.abs(actualDecrease - expectedDecrease),
              });
            } else {
              console.log('[ConfirmationScreen] ✅ Balance decreased correctly:', actualDecrease, 'UNIT');
            }

            // Generate shortened URL and store token persistently
            try {
              const { generateTurboDeeplink } = await import('../../services/cashu/cashuLockedTokensService');
              const { saveSentLockedToken } = await import('../../services/cashu/cashuLockedTokensService');

              // Generate short URL first
              const shortUrl = await generateTurboDeeplink(token, turboRecipient, paidQuote.amount);
              console.log('[ConfirmationScreen] Generated short URL:', shortUrl);

              // Save token with short URL and taproot address
              await saveSentLockedToken(token, turboRecipient, paidQuote.amount, broadcastedTxid, shortUrl, wallet.taprootAddress);
              console.log('[ConfirmationScreen] Token saved to persistent storage with short URL');

              // Store short URL for display
              setTurboDeeplink(shortUrl);
            } catch (storageError) {
              console.error('[ConfirmationScreen] Failed to generate/save token:', storageError);
              // Non-critical error - continue anyway
            }

            // Store token for display
            console.log('[ConfirmationScreen] 🎫 Setting turboToken state with token length:', token?.length);
            setTurboToken(token);
            console.log('[ConfirmationScreen] 🎫 turboToken state has been set');
          }

          // Refresh balance
          await fetchTransactionHistory();

          setIsCompletingMint(false);

          // Refresh cashu balance to reflect the new tokens
          await refreshCashuBalance();
          console.log('[ConfirmationScreen] Cashu balance refreshed');

          // Different message based on whether this is address-bound or regular Turbo
          if (turboRecipient) {
            Alert.alert('Success', 'Turbo transaction complete! Token is ready for the recipient.');
          } else {
            Alert.alert('Success', 'On-chain UNIT converted to eUNIT!');
          }
        } else {
          console.log('[ConfirmationScreen] Payment not confirmed after 30 seconds');
          setIsCompletingMint(false);
          Alert.alert('Pending', 'Payment sent. E-cash will be available once confirmed.');
        }
      } catch (error) {
        console.error('[ConfirmationScreen] Error during mint completion:', error);
        setIsCompletingMint(false);
        Alert.alert('Error', `Failed to complete conversion: ${error.message}`);
      }
    };

    completeMintProcess();
  }, [isTurbo, mintQuoteId, mintAmount, turboRecipient, fetchTransactionHistory]);

  // Handle Cashu mint completion (for threshold conversion)
  const cashuMint = route?.params?.cashuMint === true;
  const quoteId = route?.params?.quoteId;
  const hasCashuMintCompleted = useRef(false);

  useEffect(() => {
    console.log('[ConfirmationScreen] Checking cashu mint completion:', {
      cashuMint,
      quoteId,
      hasCashuMintCompleted: hasCashuMintCompleted.current
    });

    // Only proceed if this is a Cashu mint flow with all required params
    if (!cashuMint || !quoteId) {
      return;
    }

    if (hasCashuMintCompleted.current) {
      console.log('[ConfirmationScreen] Cashu mint already completed, skipping');
      return;
    }

    hasCashuMintCompleted.current = true;
    console.log('[ConfirmationScreen] Starting cashu mint completion process');

    const completeCashuMintProcess = async () => {
      setIsCompletingMint(true);
      try {
        const { completeMint } = await import('../../services/cashu/cashuWalletService');
        const { checkMintQuote } = await import('../../services/cashu/cashuMintClient');
        console.log('[ConfirmationScreen] Starting to poll for payment confirmation');

        // Poll for payment confirmation
        let paidQuote = null;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds

        while (!paidQuote && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const quote = await checkMintQuote(quoteId);
          console.log(`[ConfirmationScreen] Cashu check ${attempts + 1}/${maxAttempts}:`, quote);
          if (quote.state === 'PAID' || quote.state === 'ISSUED') {
            paidQuote = quote;
            break;
          }
          attempts++;
        }

        if (paidQuote) {
          console.log('[ConfirmationScreen] Payment confirmed! Completing cashu mint with amount:', paidQuote.amount);
          // Complete mint to get e-cash tokens - quote.amount is already in smallest units
          await completeMint(quoteId, paidQuote.amount);
          console.log('[ConfirmationScreen] Cashu mint completed successfully');

          // Refresh transaction history and balance
          if (fetchTransactionHistory) {
            await fetchTransactionHistory();
          }

          // Refresh cashu balance to reflect the new tokens
          await refreshCashuBalance();
          console.log('[ConfirmationScreen] Cashu balance refreshed after threshold conversion');

          setIsCompletingMint(false);
          Alert.alert('Success', 'UNIT successfully converted to ecash!');
        } else {
          console.log('[ConfirmationScreen] Payment not confirmed after 30 seconds');
          setIsCompletingMint(false);
          Alert.alert('Pending', 'Payment sent. Ecash will be available once confirmed.');
        }
      } catch (error) {
        console.error('[ConfirmationScreen] Error during cashu mint completion:', error);
        setIsCompletingMint(false);
        Alert.alert('Error', `Failed to complete conversion: ${error.message}`);
      }
    };

    completeCashuMintProcess();
  }, [cashuMint, quoteId, fetchTransactionHistory]);

  const handleViewExplorer = () => {
    if (broadcastedTxid) {
      Linking.openURL(getTxUrl(broadcastedTxid));
    }
  };

  const handleShareDeeplink = async () => {
    if (turboDeeplink) {
      try {
        console.log('[ConfirmationScreen] Sharing Turbo deeplink:', turboDeeplink);

        await Share.share({
          message: turboDeeplink,
          title: 'Receive UNIT',
        });
      } catch (error) {
        console.error('[ConfirmationScreen] Failed to share link:', error);
        Alert.alert('Error', 'Failed to share link. Please try again.');
      }
    }
  };

  const handleCopyDeeplink = async () => {
    if (turboDeeplink) {
      try {
        console.log('[ConfirmationScreen] Copying Turbo deeplink to clipboard:', turboDeeplink);

        await Clipboard.setStringAsync(turboDeeplink);
        Alert.alert('Copied!', 'Link copied to clipboard');
      } catch (error) {
        console.error('[ConfirmationScreen] Failed to copy link:', error);
        Alert.alert('Error', 'Failed to copy link. Please try again.');
      }
    }
  };

  const handleOpenInBrowser = async () => {
    if (turboDeeplink) {
      try {
        console.log('[ConfirmationScreen] Opening Turbo deeplink in browser:', turboDeeplink);
        await Linking.openURL(turboDeeplink);
      } catch (error) {
        console.error('[ConfirmationScreen] Failed to open link:', error);
        Alert.alert('Error', 'Failed to open link. Please try again.');
      }
    }
  };

  const handleDone = () => {
    // Refresh transaction history one more time before closing
    if (fetchTransactionHistory) {
      fetchTransactionHistory();
    }

    // Dismiss the send flow modal
    // Add a small delay to allow the fetch to start
    setTimeout(() => {
      navigation.getParent()?.goBack();
    }, 100);
  };

  return (
    <View style={localStyles.container}>
      {/* Content */}
      <View style={localStyles.content}>
        {/* Success icon - checkmark or UNIT logo */}
        <View style={localStyles.checkmarkContainer}>
          {skipMint ? (
            <View style={localStyles.heroLogoContainer}>
              <Icon name="unit_logo" size={80} />
              <Text style={localStyles.heroLightningBadge}>⚡</Text>
            </View>
          ) : (
            <Icon name="done" size={100} color={COLORS.TEAL} />
          )}
        </View>

        <Text style={localStyles.title}>
          {isCompletingMint ? 'Converting to eUNIT...' : (skipMint ? 'Turbo Token Ready' : 'Transaction Sent')}
        </Text>
        <Text style={localStyles.subtitle}>
          {isCompletingMint
            ? 'Waiting for payment confirmation and minting e-cash tokens...'
            : (skipMint
              ? 'Share this link with the recipient'
              : 'Your transaction has been successfully broadcast to the network')
          }
        </Text>

        {isCompletingMint && (
          <ActivityIndicator
            size="large"
            color={COLORS.PRIMARY_BLUE}
            style={{ marginTop: 20 }}
          />
        )}

        {/* Turbo Token Action */}
        {turboToken && turboDeeplink && (
          <>
            {/* Short URL Display */}
            <TouchableOpacity
              style={localStyles.urlContainer}
              onPress={handleCopyDeeplink}
              activeOpacity={0.7}
            >
              <Text style={localStyles.urlText} numberOfLines={2}>
                {turboDeeplink}
              </Text>
              <Text style={localStyles.tapToCopyHint}>Tap to copy</Text>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={localStyles.buttonRow}>
              <TouchableOpacity
                style={[localStyles.actionButton, localStyles.shareButton]}
                onPress={handleShareDeeplink}
                activeOpacity={0.7}
              >
                <Icon name="share" size={16} color={COLORS.PRIMARY_BLUE} />
                <Text style={localStyles.actionButtonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[localStyles.actionButton, localStyles.copyButton]}
                onPress={handleOpenInBrowser}
                activeOpacity={0.7}
              >
                <Icon name="arrow_right" size={16} color={COLORS.VERY_LIGHT_GRAY} />
                <Text style={localStyles.actionButtonText}>Open Link</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* View Explorer Button */}
        {!turboToken && !skipMint && (
          <TouchableOpacity
            style={localStyles.explorerButton}
            activeOpacity={0.7}
            onPress={handleViewExplorer}
          >
            <Text style={localStyles.explorerButtonText}>View on Explorer</Text>
            <Icon name="arrow_right" size={16} color={COLORS.PRIMARY_BLUE} />
          </TouchableOpacity>
        )}
      </View>

      {/* Done Button - Fixed at bottom */}
      <View style={localStyles.buttonContainer}>
        <TouchableOpacity
          style={localStyles.doneButton}
          onPress={handleDone}
          activeOpacity={0.7}
        >
          <Text style={localStyles.doneButtonText}>Done</Text>
        </TouchableOpacity>
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
  checkmarkContainer: {
    marginBottom: 32,
  },
  heroLogoContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  heroLightningBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  explorerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE,
    gap: 8,
  },
  explorerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  doneButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  tokenContainer: {
    width: '100%',
    backgroundColor: COLORS.DARK_CARD_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
    marginTop: 20,
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  tokenLogoContainer: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  lightningBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    fontSize: 16,
  },
  tokenHeaderText: {
    flex: 1,
  },
  tokenLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    marginBottom: 2,
  },
  tokenDescription: {
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    lineHeight: 18,
  },
  urlContainer: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginTop: 32,
    marginBottom: 12,
    marginHorizontal: -20,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  urlText: {
    fontSize: 14,
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  tapToCopyHint: {
    fontSize: 12,
    color: COLORS.PRIMARY_BLUE,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 4,
    marginHorizontal: -20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  shareButton: {
    backgroundColor: COLORS.PRIMARY_BLUE + '15',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_BLUE,
  },
  copyButton: {
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
  },
});
