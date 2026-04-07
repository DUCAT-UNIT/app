/**
 * ConfirmationScreen - Full screen showing successful transaction confirmation
 * Features: success checkmark, explorer link, Done button
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { useTransactionHistory } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
import { useCashuOperations } from '../../contexts/CashuContext';
import { analytics } from '../../services/analyticsService';
import { TRANSACTION_EVENTS } from '../../constants/analyticsEvents';
import { logger } from '../../utils/logger';
import { useConfirmationParams } from '../../hooks/useConfirmationParams';
import { useTurboMintCompletion } from '../../hooks/useTurboMintCompletion';
import { useCashuMintCompletion } from '../../hooks/useCashuMintCompletion';
import { useConfirmationHandlers } from '../../hooks/useConfirmationHandlers';
import { useResponsive } from '../../hooks/useResponsive';
import { useNotifications } from '../../stores/notificationStore';
import { colors } from '../../styles/theme';
import { createConfirmationStyles } from './confirmationStyles';

/**
 * Route parameters for ConfirmationScreen
 */
interface ConfirmationRouteParams {
  isTurbo?: boolean;
  mintQuoteId?: string;
  mintAmount?: number;
  turboRecipient?: string;
  skipMint?: boolean;
  cashuMint?: boolean;
  quoteId?: string;
  broadcastedTxid?: string;
  turboToken?: string;
  turboDeeplink?: string;
  turboAmount?: number;
}

/**
 * Props for ConfirmationScreen
 */
interface ConfirmationScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: ConfirmationRouteParams }, 'params'>;
}

export default function ConfirmationScreen({
  navigation,
  route,
}: ConfirmationScreenProps): React.JSX.Element {
  const { fetchTransactionHistory } = useTransactionHistory();
  const { wallet } = useWallet();
  const { refresh: refreshCashuBalance } = useCashuOperations();
  const { s, sf } = useResponsive();
  const { showToast } = useNotifications();

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
  const [localTurboDeeplink, setLocalTurboDeeplink] = useState(
    route?.params?.turboDeeplink || null
  );

  // Handle Turbo mint completion (polling, P2PK token generation, deeplink)
  const {
    turboToken: generatedTurboToken,
    turboDeeplink: generatedTurboDeeplink,
    processingStage,
  } = useTurboMintCompletion({
    isTurbo,
    mintQuoteId: mintQuoteId ?? null,
    mintAmount: mintAmount ?? 0,
    turboRecipient: turboRecipient ?? null,
    skipMint,
    senderTaprootAddress: wallet?.taprootAddress,
    fetchTransactionHistory,
    refreshCashuBalance,
  });

  // Handle Cashu mint completion (for threshold conversion)
  useCashuMintCompletion({
    cashuMint,
    quoteId,
    mintAmount,
    fetchTransactionHistory,
    refreshCashuBalance,
    navigation: cashuMint ? navigation : undefined,
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
  }, [
    route?.params?.turboToken,
    route?.params?.turboDeeplink,
    localTurboToken,
    localTurboDeeplink,
  ]);

  // Generate Turbo deeplink when token is ready (only if not already provided)
  useEffect(() => {
    if (turboToken && turboRecipient && turboAmount && !turboDeeplink) {
      const generateLink = async () => {
        try {
          const { generateTurboDeeplink } = await import(
            '../../services/cashu/cashuLockedTokensService'
          );
          const deeplink = await generateTurboDeeplink(turboToken, turboRecipient, turboAmount);
          setLocalTurboDeeplink(deeplink);
          logger.debug('[ConfirmationScreen] Generated Turbo deeplink:', deeplink);
        } catch (error: unknown) {
          logger.error('[ConfirmationScreen] Failed to generate deeplink:', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };
      generateLink();
    }
  }, [turboToken, turboRecipient, turboAmount, turboDeeplink]);

  // Track send broadcast once when txid is present
  useEffect(() => {
    if (broadcastedTxid) {
      analytics.trackTransaction(TRANSACTION_EVENTS.SEND_BROADCAST, broadcastedTxid, {
        is_turbo: isTurbo ?? false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcastedTxid]);

  // Handlers
  const {
    handleViewExplorer,
    handleShareDeeplink,
    handleCopyDeeplink,
    handleOpenInBrowser,
    handleDone,
  } = useConfirmationHandlers({
    broadcastedTxid,
    turboDeeplink: turboDeeplink ?? undefined,
    fetchTransactionHistory,
    navigation,
  });

  // Copy transaction ID to clipboard
  const handleCopyTxid = useCallback(async () => {
    if (broadcastedTxid) {
      await Clipboard.setStringAsync(broadcastedTxid);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast('Transaction ID copied');
    }
  }, [broadcastedTxid, showToast]);

  // Truncate txid for display
  const truncatedTxid = broadcastedTxid
    ? `${broadcastedTxid.slice(0, 8)}...${broadcastedTxid.slice(-8)}`
    : '';

  // If we're in 'ready' state but expecting turbo data that hasn't arrived yet, show loading
  const isWaitingForTurboData =
    processingStage === 'ready' && isTurbo && skipMint && (!turboToken || !turboDeeplink);

  // Create responsive styles
  const styles = useMemo(() => createConfirmationStyles(s, sf), [s, sf]);

  // Non-turbo success view (matching VaultActionSuccess design)
  const renderNonTurboSuccess = () => (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="confirmation-screen">
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={48} color={colors.semantic.success} />
          </View>
        </View>

        {/* Success Message */}
        <Text style={styles.title}>Transaction Sent!</Text>

        {/* Transaction Links */}
        {broadcastedTxid && (
          <View style={styles.linksContainer}>
            <TouchableOpacity onPress={handleCopyTxid} style={styles.linkRow} activeOpacity={0.7}>
              <Ionicons name="copy-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.txId}>{truncatedTxid}</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              onPress={handleViewExplorer}
              style={styles.linkRow}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={16} color={colors.brand.primary} />
              <Text style={styles.explorerText}>View on Explorer</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.warningRow}>
          <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
          <Text style={styles.infoText}>May take a few minutes to confirm.</Text>
        </View>
      </View>

      {/* Done Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleDone}
          activeOpacity={0.7}
          testID="confirmation-done-btn"
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // Turbo/processing view (keep existing design)
  const renderTurboOrProcessingView = () => (
    <View style={styles.container} testID="confirmation-screen">
      {/* Content */}
      <View style={styles.content}>
        {/* Icon based on processing stage */}
        {/* Stage 0: Waiting for turbo data from ProcessingScreen */}
        {isWaitingForTurboData && (
          <>
            <ActivityIndicator
              size="large"
              color={COLORS.PRIMARY_BLUE}
              style={{ marginTop: s(40), marginBottom: s(40) }}
            />
            <Text style={styles.title}>Converting to TurboUNIT</Text>
            <Text style={styles.subtitle}>Finalizing P2PK locked token...</Text>
          </>
        )}

        {/* Stage 1: Converting - Match ProcessingScreen appearance exactly */}
        {processingStage === 'converting' && (
          <>
            <ActivityIndicator
              size="large"
              color={COLORS.PRIMARY_BLUE}
              style={{ marginBottom: s(24) }}
            />
            <Text style={styles.processingTitle}>Converting to TurboUNIT</Text>
            <Text style={styles.processingMessage}>
              Minting e-cash tokens and creating P2PK locked token...
            </Text>
          </>
        )}

        {/* Stage 2: Ready - Show turbo icon */}
        {!isWaitingForTurboData && processingStage === 'ready' && isTurbo && turboToken && (
          <>
            <View style={styles.checkmarkContainer}>
              <View style={styles.heroLogoContainer}>
                <Icon name="unit_logo" size={s(80)} />
                <Text style={styles.heroLightningBadge}>⚡</Text>
              </View>
            </View>
            <Text style={styles.title}>Turbo Token Ready</Text>
            <Text style={styles.subtitle}>Share this link with the recipient</Text>
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
                    <Icon name="share" size={s(16)} color={COLORS.PRIMARY_BLUE} />
                    <Text style={styles.actionButtonText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.copyButton]}
                    onPress={handleOpenInBrowser}
                    activeOpacity={0.7}
                  >
                    <Icon name="arrow_right" size={s(16)} color={COLORS.VERY_LIGHT_GRAY} />
                    <Text style={styles.actionButtonText}>Open Link</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.urlContainer}>
                <ActivityIndicator size="small" color={COLORS.PRIMARY_BLUE} />
                <Text style={[styles.urlText, { marginTop: s(8) }]}>Generating link...</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Done Button - Fixed at bottom, only show when ready */}
      {processingStage === 'ready' && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
            activeOpacity={0.7}
            testID="confirmation-done-btn"
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Show non-turbo success view for regular BTC transactions
  const showNonTurboSuccess = !isTurbo && !skipMint && processingStage === 'ready';

  return showNonTurboSuccess ? renderNonTurboSuccess() : renderTurboOrProcessingView();
}
