/**
 * ConfirmationScreen - Full screen showing successful transaction confirmation
 * Features: success checkmark, explorer link, Done button
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Text, View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../theme';
import Icon from '../../components/icons';
import { useTransactionHistory } from '../../contexts/WalletDataContext';
import { useWallet } from '../../contexts/WalletContext';
import { useCashu } from '../../contexts/CashuContext';
import { logger } from '../../utils/logger';
import { useConfirmationParams } from '../../hooks/useConfirmationParams';
import { useTurboMintCompletion } from '../../hooks/useTurboMintCompletion';
import { useCashuMintCompletion } from '../../hooks/useCashuMintCompletion';
import { useConfirmationHandlers } from '../../hooks/useConfirmationHandlers';
import { useResponsive } from '../../hooks/useResponsive';
import { useNotifications } from '../../stores/notificationStore';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

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

export default function ConfirmationScreen({ navigation, route }: ConfirmationScreenProps): React.JSX.Element {
  const { fetchTransactionHistory } = useTransactionHistory();
  const { wallet } = useWallet();
  const { refresh: refreshCashuBalance } = useCashu();
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
  const [localTurboDeeplink, setLocalTurboDeeplink] = useState(route?.params?.turboDeeplink || null);

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
        } catch (error: unknown) {
          logger.error('[ConfirmationScreen] Failed to generate deeplink:', { error: error instanceof Error ? error.message : String(error) });
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
  const isWaitingForTurboData = processingStage === 'ready' && isTurbo && skipMint && (!turboToken || !turboDeeplink);

  // Create responsive styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg.primary,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: s(40),
    },
    checkmarkContainer: {
      marginBottom: s(24),
    },
    checkmark: {
      width: s(80),
      height: s(80),
      borderRadius: s(40),
      backgroundColor: COLORS.SUCCESS_GREEN + '20',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: s(2),
      borderColor: COLORS.SUCCESS_GREEN,
    },
    heroLogoContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroLightningBadge: {
      position: 'absolute',
      bottom: s(-8),
      right: s(-8),
      fontSize: sf(32),
    },
    processingTitle: {
      fontSize: sf(18),
      fontWeight: '600',
      color: COLORS.VERY_LIGHT_GRAY,
      textAlign: 'center',
      marginBottom: s(8),
    },
    processingMessage: {
      fontSize: sf(14),
      color: COLORS.SECONDARY_TEXT,
      textAlign: 'center',
      lineHeight: sf(20, 16),
    },
    title: {
      fontSize: fontSizes.xxl,
      fontFamily: fonts.bold,
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    subtitle: {
      fontSize: sf(14),
      color: COLORS.SECONDARY_TEXT,
      textAlign: 'center',
      lineHeight: sf(20, 16),
    },
    // New styles for non-turbo success screen (matching VaultActionSuccess)
    iconContainer: {
      marginBottom: spacing.xl,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: radii.full,
      backgroundColor: 'rgba(89, 170, 138, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    linksContainer: {
      marginTop: spacing.xl,
      backgroundColor: colors.bg.secondary,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignSelf: 'center',
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
    },
    txId: {
      fontSize: fontSizes.md,
      fontFamily: fonts.mono,
      color: colors.text.secondary,
      marginLeft: spacing.sm,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.default,
    },
    explorerText: {
      fontSize: fontSizes.md,
      fontFamily: fonts.medium,
      color: colors.brand.primary,
      marginLeft: spacing.sm,
    },
    warningRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.lg,
    },
    infoText: {
      fontSize: fontSizes.xs,
      fontFamily: fonts.regular,
      color: colors.text.tertiary,
      marginLeft: spacing.xs,
    },
    // Legacy styles for turbo flow
    explorerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(8),
      backgroundColor: COLORS.CARD_BG,
      paddingVertical: s(12),
      paddingHorizontal: s(16),
      borderRadius: s(10),
      borderWidth: 1,
      borderColor: COLORS.PRIMARY_BLUE + '30',
      marginTop: s(24),
    },
    explorerButtonText: {
      fontSize: sf(14),
      fontWeight: '500',
      color: COLORS.PRIMARY_BLUE,
    },
    urlContainer: {
      backgroundColor: COLORS.CARD_BG,
      borderRadius: s(12),
      padding: s(16),
      borderWidth: 1,
      borderColor: COLORS.BORDER_COLOR,
      width: '100%',
      gap: s(8),
    },
    urlText: {
      fontSize: sf(13),
      color: COLORS.VERY_LIGHT_GRAY,
      fontFamily: 'monospace',
      textAlign: 'center',
    },
    tapToCopyHint: {
      fontSize: sf(11, 9),
      color: COLORS.SECONDARY_TEXT,
      textAlign: 'center',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: s(12),
      marginTop: s(16),
      width: '100%',
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: s(10),
      paddingHorizontal: s(16),
      borderRadius: s(10),
      gap: s(6),
    },
    shareButton: {
      backgroundColor: COLORS.CARD_BG,
      borderWidth: 1,
      borderColor: COLORS.PRIMARY_BLUE + '30',
    },
    copyButton: {
      backgroundColor: COLORS.PRIMARY_BLUE,
    },
    actionButtonText: {
      fontSize: sf(14),
      fontWeight: '500',
      color: COLORS.VERY_LIGHT_GRAY,
    },
    footer: {
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
    },
    doneButton: {
      backgroundColor: colors.brand.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    doneButtonText: {
      fontSize: fontSizes.md,
      fontFamily: fonts.bold,
      color: colors.text.white,
    },
  });

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

            <TouchableOpacity onPress={handleViewExplorer} style={styles.linkRow} activeOpacity={0.7}>
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
            <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={{ marginBottom: s(24) }} />
            <Text style={styles.processingTitle}>Converting to TurboUNIT</Text>
            <Text style={styles.processingMessage}>Minting e-cash tokens and creating P2PK locked token...</Text>
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
