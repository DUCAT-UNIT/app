/**
 * ConfirmationScreen - Full screen showing successful transaction confirmation
 * Features: success checkmark, explorer link, Done button
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, View, TouchableOpacity, Linking, StyleSheet, ActivityIndicator, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { getTxUrl } from '../../utils/constants';
import { useTransactionExecution } from '../../contexts/TransactionExecutionContext';
import { useTransactionHistory } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
import { useCashu } from '../../contexts/CashuContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { logger } from '../../utils/logger';
import { useConfirmationParams } from '../../hooks/useConfirmationParams';
import { useTurboMintCompletion } from '../../hooks/useTurboMintCompletion';
import { useCashuMintCompletion } from '../../hooks/useCashuMintCompletion';

export default function ConfirmationScreen({ navigation, route }) {
  const { broadcastedTxid } = useTransactionExecution();
  const { fetchTransactionHistory } = useTransactionHistory();
  const { wallet } = useWallet();
  const { refresh: refreshCashuBalance } = useCashu();
  const { showToast, showSnackbar } = useNotifications();

  // Extract and validate route params
  const {
    isTurbo,
    mintQuoteId,
    mintAmount,
    turboRecipient,
    skipMint,
    cashuMint,
    quoteId,
  } = useConfirmationParams(route);

  const turboAmount = route?.params?.turboAmount; // Amount in smallest units

  // Local state for token and deeplink (can be passed via route params or generated)
  const [localTurboToken, setLocalTurboToken] = useState(route?.params?.turboToken || null);
  const [localTurboDeeplink, setLocalTurboDeeplink] = useState(route?.params?.turboDeeplink || null);

  // Handle Turbo mint completion (polling, P2PK token generation, deeplink)
  const {
    turboToken: generatedTurboToken,
    turboDeeplink: generatedTurboDeeplink,
    processingStage,
    isCompletingMint: turboMintCompleting,
  } = useTurboMintCompletion({
    isTurbo,
    mintQuoteId,
    mintAmount,
    turboRecipient,
    skipMint,
    fetchTransactionHistory,
    refreshCashuBalance,
    showSnackbar,
    showToast,
  });

  // Handle Cashu mint completion (for threshold conversion)
  const { isCompletingMint: cashuMintCompleting } = useCashuMintCompletion({
    cashuMint,
    quoteId,
    fetchTransactionHistory,
    refreshCashuBalance,
    showSnackbar,
    showToast,
  });

  // Combine completion states
  const isCompletingMint = turboMintCompleting || cashuMintCompleting;

  // Use generated token/deeplink if available, otherwise use local state
  const turboToken = generatedTurboToken || localTurboToken;
  const turboDeeplink = generatedTurboDeeplink || localTurboDeeplink;

  // Update local turboToken and turboDeeplink when route params change
  // This fixes the issue where React Navigation pre-renders the screen with empty params
  useEffect(() => {
    if (route?.params?.turboToken && route.params.turboToken !== localTurboToken) {
      logger.debug('[ConfirmationScreen] 🔄 Updating turboToken from route params');
      setLocalTurboToken(route.params.turboToken);
    }
    if (route?.params?.turboDeeplink && route.params.turboDeeplink !== localTurboDeeplink) {
      logger.debug('[ConfirmationScreen] 🔄 Updating turboDeeplink from route params');
      setLocalTurboDeeplink(route.params.turboDeeplink);
    }
  }, [route?.params?.turboToken, route?.params?.turboDeeplink, localTurboToken, localTurboDeeplink]);

  // Log all route params on mount for debugging
  useEffect(() => {
    logger.debug('[ConfirmationScreen] Mounted with route params:', route?.params);
    logger.debug('[ConfirmationScreen] Extracted values:', {
      isTurbo,
      mintQuoteId,
      mintAmount,
      turboRecipient,
      turboAmount,
      skipMint,
      turboToken: turboToken ? `Present (${turboToken.length} chars)` : 'null',
      turboDeeplink: turboDeeplink || 'null',
      broadcastedTxid,
      cashuMint: route?.params?.cashuMint,
      quoteId: route?.params?.quoteId,
      processingStage,
    });

    // Debug: Check if we should be creating a token
    if (isTurbo && turboRecipient) {
      logger.debug('[ConfirmationScreen] ✅ Should create P2PK token - all params present');
    } else if (isTurbo && !turboRecipient) {
      logger.debug('[ConfirmationScreen] ⚠️ isTurbo=true but turboRecipient is missing!');
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
    logger.debug('[ConfirmationScreen] 🎫 turboToken state changed:', turboToken ? `Token present (${turboToken.length} chars)` : 'null');
  }, [turboToken]);

  // Debug: Log when processing stage changes
  useEffect(() => {
    logger.debug('[ConfirmationScreen] 🎬 Processing stage changed:', processingStage, {
      turboToken: turboToken ? 'present' : 'null',
      turboDeeplink: turboDeeplink || 'null',
      shouldShowLinks: processingStage === 'ready' && turboToken && turboDeeplink,
    });
  }, [processingStage, turboToken, turboDeeplink]);

  // Generate Turbo deeplink when token is ready (only if not already provided)
  useEffect(() => {
    if (turboToken && turboRecipient && turboAmount && !turboDeeplink) {
      const generateLink = async () => {
        try {
          const { generateTurboDeeplink } = await import('../../services/cashu/cashuLockedTokensService');
          const deeplink = await generateTurboDeeplink(turboToken, turboRecipient, turboAmount);
          setLocalTurboDeeplink(deeplink);
          logger.debug('[ConfirmationScreen] Generated Turbo deeplink:', deeplink);
        } catch (error) {
          logger.error('[ConfirmationScreen] Failed to generate deeplink:', error);
        }
      };
      generateLink();
    }
  }, [turboToken, turboRecipient, turboAmount, turboDeeplink]);

  const handleViewExplorer = () => {
    if (broadcastedTxid) {
      Linking.openURL(getTxUrl(broadcastedTxid));
    }
  };

  const handleShareDeeplink = async () => {
    if (turboDeeplink) {
      try {
        logger.debug('[ConfirmationScreen] Sharing Turbo deeplink:', turboDeeplink);

        await Share.share({
          message: turboDeeplink,
          title: 'Receive UNIT',
        });
      } catch (error) {
        logger.error('[ConfirmationScreen] Failed to share link:', error);
        showToast('Failed to share link. Please try again.', 'error');
      }
    }
  };

  const handleCopyDeeplink = async () => {
    if (turboDeeplink) {
      try {
        logger.debug('[ConfirmationScreen] Copying Turbo deeplink to clipboard:', turboDeeplink);

        await Clipboard.setStringAsync(turboDeeplink);
        showToast('Link copied to clipboard', 'info');
      } catch (error) {
        logger.error('[ConfirmationScreen] Failed to copy link:', error);
        showToast('Failed to copy link. Please try again.', 'error');
      }
    }
  };

  const handleOpenInBrowser = async () => {
    if (turboDeeplink) {
      try {
        logger.debug('[ConfirmationScreen] Opening Turbo deeplink in browser:', turboDeeplink);
        await Linking.openURL(turboDeeplink);
      } catch (error) {
        logger.error('[ConfirmationScreen] Failed to open link:', error);
        showToast('Failed to open link. Please try again.', 'error');
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

  // If we're in 'ready' state but expecting turbo data that hasn't arrived yet, show loading
  const isWaitingForTurboData = processingStage === 'ready' && isTurbo && skipMint && (!turboToken || !turboDeeplink);

  return (
    <View style={localStyles.container}>
      {/* Content */}
      <View style={localStyles.content}>
        {/* Icon based on processing stage */}
        {/* Stage 0: Waiting for turbo data from ProcessingScreen */}
        {isWaitingForTurboData && (
          <>
            <ActivityIndicator
              size="large"
              color={COLORS.PRIMARY_BLUE}
              style={{ marginTop: 40, marginBottom: 40 }}
            />
            <Text style={localStyles.title}>Converting to TurboUNIT</Text>
            <Text style={localStyles.subtitle}>Finalizing P2PK locked token...</Text>
          </>
        )}

        {/* Stage 1: Converting - Match ProcessingScreen appearance exactly */}
        {processingStage === 'converting' && (
          <>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={{ marginBottom: 24 }} />
            <Text style={localStyles.processingTitle}>Converting to TurboUNIT</Text>
            <Text style={localStyles.processingMessage}>Minting e-cash tokens and creating P2PK locked token...</Text>
          </>
        )}

        {/* Stage 2: Ready - Show turbo icon or checkmark */}
        {!isWaitingForTurboData && processingStage === 'ready' && (
          <>
            <View style={localStyles.checkmarkContainer}>
              {isTurbo && turboToken ? (
                <View style={localStyles.heroLogoContainer}>
                  <Icon name="unit_logo" size={80} />
                  <Text style={localStyles.heroLightningBadge}>⚡</Text>
                </View>
              ) : (
                <View style={localStyles.checkmark}>
                  <Icon name="checkmark" size={48} color={COLORS.SUCCESS_GREEN} />
                </View>
              )}
            </View>
            <Text style={localStyles.title}>
              {isTurbo && turboToken ? 'Turbo Token Ready' : 'Transaction Sent'}
            </Text>
            <Text style={localStyles.subtitle}>
              {isTurbo && turboToken ? 'Share this link with the recipient' : 'Your transaction has been successfully broadcast to the network'}
            </Text>
          </>
        )}

        {/* Turbo Token Action - Show when ready */}
        {processingStage === 'ready' && isTurbo && turboToken && (
          <>
            {turboDeeplink ? (
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
            ) : (
              <View style={localStyles.urlContainer}>
                <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
                <Text style={[localStyles.urlText, { marginTop: 8 }]}>Generating link...</Text>
              </View>
            )}
          </>
        )}

        {/* View Explorer Button - for non-turbo transactions */}
        {!isTurbo && !skipMint && broadcastedTxid && (
          <TouchableOpacity
            style={localStyles.explorerButton}
            activeOpacity={0.7}
            onPress={handleViewExplorer}
          >
            <Text style={localStyles.explorerButtonText}>View on Explorer</Text>
            <Icon name="arrow_right" size={16} color={COLORS.PRIMARY_BLUE} />
          </TouchableOpacity>
        )}

        {/* Debug - show if nothing is rendering */}
        {__DEV__ && processingStage === 'ready' && !isTurbo && !turboToken && (
          <View style={{ padding: 20, backgroundColor: 'red', marginTop: 20 }}>
            <Text style={{ color: 'white' }}>DEBUG: Ready state but no content to show</Text>
            <Text style={{ color: 'white', fontSize: 12 }}>isTurbo: {String(isTurbo)}</Text>
            <Text style={{ color: 'white', fontSize: 12 }}>turboToken: {turboToken ? 'present' : 'null'}</Text>
            <Text style={{ color: 'white', fontSize: 12 }}>skipMint: {String(skipMint)}</Text>
          </View>
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
  checkmark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.SUCCESS_GREEN + '20',
    alignItems: 'center',
    justifyContent: 'center',
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
  // Processing state styles - match ProcessingScreen exactly
  processingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  processingMessage: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
  },
  // Ready state styles
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
