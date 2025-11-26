/**
 * ConfirmationScreen - Full screen showing successful transaction confirmation
 * Features: success checkmark, explorer link, Done button
 */

import React, { useEffect, useState } from 'react';
import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { useTransactionHistory } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
import { useCashu } from '../../contexts/CashuContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { logger } from '../../utils/logger';
import { useConfirmationParams } from '../../hooks/useConfirmationParams';
import { useTurboMintCompletion } from '../../hooks/useTurboMintCompletion';
import { useCashuMintCompletion } from '../../hooks/useCashuMintCompletion';
import { useConfirmationHandlers } from '../../hooks/useConfirmationHandlers';
import { styles } from './ConfirmationScreen.styles';

export default function ConfirmationScreen({ navigation, route }) {
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
    broadcastedTxid,
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
  } = useTurboMintCompletion({
    isTurbo,
    mintQuoteId,
    mintAmount,
    turboRecipient,
    skipMint,
    senderTaprootAddress: wallet?.taprootAddress,
    fetchTransactionHistory,
    refreshCashuBalance,
    showSnackbar,
    showToast,
  });

  // Handle Cashu mint completion (for threshold conversion)
  useCashuMintCompletion({
    cashuMint,
    quoteId,
    fetchTransactionHistory,
    refreshCashuBalance,
    showSnackbar,
    showToast,
  });

  // Use generated token/deeplink if available, otherwise use local state
  const turboToken = generatedTurboToken || localTurboToken;
  const turboDeeplink = generatedTurboDeeplink || localTurboDeeplink;

  // Update local turboToken and turboDeeplink when route params change
  useEffect(() => {
    if (route?.params?.turboToken && route.params.turboToken !== localTurboToken) {
      setLocalTurboToken(route.params.turboToken);
    }
    if (route?.params?.turboDeeplink && route.params.turboDeeplink !== localTurboDeeplink) {
      setLocalTurboDeeplink(route.params.turboDeeplink);
    }
  }, [route?.params?.turboToken, route?.params?.turboDeeplink, localTurboToken, localTurboDeeplink]);

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

  // Handlers
  const {
    handleViewExplorer,
    handleShareDeeplink,
    handleCopyDeeplink,
    handleOpenInBrowser,
    handleDone,
  } = useConfirmationHandlers({
    broadcastedTxid,
    turboDeeplink,
    fetchTransactionHistory,
    navigation,
    showToast,
  });

  // If we're in 'ready' state but expecting turbo data that hasn't arrived yet, show loading
  const isWaitingForTurboData = processingStage === 'ready' && isTurbo && skipMint && (!turboToken || !turboDeeplink);

  return (
    <View style={styles.container}>
      {/* Content */}
      <View style={styles.content}>
        {/* Icon based on processing stage */}
        {/* Stage 0: Waiting for turbo data from ProcessingScreen */}
        {isWaitingForTurboData && (
          <>
            <ActivityIndicator
              size="large"
              color={COLORS.PRIMARY_BLUE}
              style={{ marginTop: 40, marginBottom: 40 }}
            />
            <Text style={styles.title}>Converting to TurboUNIT</Text>
            <Text style={styles.subtitle}>Finalizing P2PK locked token...</Text>
          </>
        )}

        {/* Stage 1: Converting - Match ProcessingScreen appearance exactly */}
        {processingStage === 'converting' && (
          <>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={{ marginBottom: 24 }} />
            <Text style={styles.processingTitle}>Converting to TurboUNIT</Text>
            <Text style={styles.processingMessage}>Minting e-cash tokens and creating P2PK locked token...</Text>
          </>
        )}

        {/* Stage 2: Ready - Show turbo icon or checkmark */}
        {!isWaitingForTurboData && processingStage === 'ready' && (
          <>
            <View style={styles.checkmarkContainer}>
              {isTurbo && turboToken ? (
                <View style={styles.heroLogoContainer}>
                  <Icon name="unit_logo" size={80} />
                  <Text style={styles.heroLightningBadge}>⚡</Text>
                </View>
              ) : (
                <View style={styles.checkmark}>
                  <Icon name="check" size={48} color={COLORS.SUCCESS_GREEN} />
                </View>
              )}
            </View>
            <Text style={styles.title}>
              {isTurbo && turboToken ? 'Turbo Token Ready' : 'Transaction Sent'}
            </Text>
            <Text style={styles.subtitle}>
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
                  style={styles.urlContainer}
                  onPress={handleCopyDeeplink}
                  activeOpacity={0.7}
                >
                  <Text style={styles.urlText} numberOfLines={2}>
                    {turboDeeplink}
                  </Text>
                  <Text style={styles.tapToCopyHint}>Tap to copy</Text>
                </TouchableOpacity>

                {/* Action Buttons */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.shareButton]}
                    onPress={handleShareDeeplink}
                    activeOpacity={0.7}
                  >
                    <Icon name="share" size={16} color={COLORS.PRIMARY_BLUE} />
                    <Text style={styles.actionButtonText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.copyButton]}
                    onPress={handleOpenInBrowser}
                    activeOpacity={0.7}
                  >
                    <Icon name="arrow_right" size={16} color={COLORS.VERY_LIGHT_GRAY} />
                    <Text style={styles.actionButtonText}>Open Link</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.urlContainer}>
                <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
                <Text style={[styles.urlText, { marginTop: 8 }]}>Generating link...</Text>
              </View>
            )}
          </>
        )}

        {/* View Explorer Button - for non-turbo transactions */}
        {!isTurbo && !skipMint && broadcastedTxid && (
          <TouchableOpacity
            style={styles.explorerButton}
            activeOpacity={0.7}
            onPress={handleViewExplorer}
          >
            <Text style={styles.explorerButtonText}>View on Explorer</Text>
            <Icon name="arrow_right" size={16} color={COLORS.PRIMARY_BLUE} />
          </TouchableOpacity>
        )}

      </View>

      {/* Done Button - Fixed at bottom */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleDone}
          activeOpacity={0.7}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

