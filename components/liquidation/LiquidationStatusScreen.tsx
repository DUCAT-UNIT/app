/**
 * LiquidationStatusScreen
 * Processing, success, and error states for liquidation.
 * Matches the vault operation UI patterns (ProcessingStepsList + VaultActionSuccess style).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ProcessingStepsList } from '../vaultCreation/ProcessingStepsList';
import TouchableScale from '../common/TouchableScale';
import { useNotifications } from '../../stores/notificationStore';
import { getTxUrl } from '../../utils/constants';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';
import type { LiquidationStep } from '../../stores/liquidationFlowStore';
import type { ProcessingStep } from '../../stores/vault/vaultStoreTypes';

// ============================================================
// Props
// ============================================================

export interface LiquidationStatusScreenProps {
  step: LiquidationStep;
  processingMessage: string;
  txid: string | null;
  swapTxid: string | null;
  error: string | null;
}

// ============================================================
// Processing Step Config
// ============================================================

const STEP_ADVANCE_INTERVAL = 1000;
const INITIAL_DELAY = 2000;

function getStatusMessage(visualStep: ProcessingStep): string {
  switch (visualStep) {
    case 1: return 'Preparing liquidation...';
    case 2: return 'Connecting to network...';
    case 3: return 'Validating transaction...';
    case 4: return 'Finalizing liquidation...';
  }
}

// ============================================================
// Component
// ============================================================

const LiquidationStatusScreen = React.memo(function LiquidationStatusScreen({
  step,
  processingMessage,
  txid,
  swapTxid,
  error,
}: LiquidationStatusScreenProps): React.ReactElement {
  const { showToast } = useNotifications();

  // ── Processing step animation (matches VaultProcessingScreen) ──
  const [visualStep, setVisualStep] = useState<ProcessingStep>(1);
  const isProcessing = step === 'processing';
  const isSuccess = step === 'success';
  const isError = step === 'error';

  useEffect(() => {
    if (!isProcessing) return;
    setVisualStep(1);
    const delay = setTimeout(() => {
      const interval = setInterval(() => {
        setVisualStep((prev) => {
          if (prev >= 4) {
            clearInterval(interval);
            return 4;
          }
          return (prev + 1) as ProcessingStep;
        });
      }, STEP_ADVANCE_INTERVAL);
      return () => clearInterval(interval);
    }, INITIAL_DELAY);
    return () => clearTimeout(delay);
  }, [isProcessing]);

  // ── Success handlers ──
  useEffect(() => {
    if (isSuccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [isSuccess]);

  const handleCopyTxid = useCallback(async () => {
    if (txid) {
      await Clipboard.setStringAsync(txid);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast('Transaction ID copied');
    }
  }, [txid, showToast]);

  const handleCopySwapTxid = useCallback(async () => {
    if (swapTxid) {
      await Clipboard.setStringAsync(swapTxid);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast('Swap TX ID copied');
    }
  }, [swapTxid, showToast]);

  const handleViewExplorer = useCallback(() => {
    if (txid) {
      void Linking.openURL(getTxUrl(txid));
    }
  }, [txid]);

  const handleViewSwapExplorer = useCallback(() => {
    if (swapTxid) {
      void Linking.openURL(getTxUrl(swapTxid));
    }
  }, [swapTxid]);

  const truncatedTxid = txid
    ? `${txid.slice(0, 8)}...${txid.slice(-8)}`
    : '';

  const truncatedSwapTxid = swapTxid
    ? `${swapTxid.slice(0, 8)}...${swapTxid.slice(-8)}`
    : '';

  // ── Processing ──
  if (isProcessing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Claiming Liquidation</Text>
          <Text style={styles.headerSubtitle}>
            Please wait while we process your claim
          </Text>
        </View>

        <View style={styles.stepsContainer}>
          <ProcessingStepsList currentStep={visualStep} />
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {processingMessage || getStatusMessage(visualStep)}
          </Text>
        </View>
      </View>
    );
  }

  // ── Success ──
  if (isSuccess) {
    return (
      <View style={styles.container}>
        <View style={styles.successContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={48} color={colors.semantic.success} />
          </View>

          <Text style={styles.title}>Liquidation Claimed!</Text>
          <Text style={styles.successMessage}>
            Your vault has been updated with the liquidated collateral and debt.
          </Text>

          {txid && (
            <View style={styles.linksContainer}>
              <Text style={styles.txLabelText}>Repo TX</Text>
              <TouchableOpacity onPress={handleCopyTxid} style={styles.linkRow} activeOpacity={0.7}>
                <Ionicons name="copy-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.txidText}>{truncatedTxid}</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity onPress={handleViewExplorer} style={styles.linkRow} activeOpacity={0.7}>
                <Ionicons name="open-outline" size={16} color={colors.brand.primary} />
                <Text style={styles.explorerText}>View on Explorer</Text>
              </TouchableOpacity>
            </View>
          )}

          {swapTxid && (
            <View style={styles.swapContainer}>
              {swapTxid ? (
                <>
                  <Text style={styles.txLabelText}>Swap TX</Text>
                  <TouchableOpacity onPress={handleCopySwapTxid} style={styles.linkRow} activeOpacity={0.7}>
                    <Ionicons name="copy-outline" size={16} color={colors.text.secondary} />
                    <Text style={styles.txidText}>{truncatedSwapTxid}</Text>
                  </TouchableOpacity>

                  <View style={styles.divider} />

                  <TouchableOpacity onPress={handleViewSwapExplorer} style={styles.linkRow} activeOpacity={0.7}>
                    <Ionicons name="open-outline" size={16} color={colors.brand.primary} />
                    <Text style={styles.explorerText}>View on Explorer</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.linkRow}>
                  <Ionicons name="swap-horizontal-outline" size={16} color={colors.text.tertiary} />
                  <Text style={styles.swapPendingText}>Swap pending...</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.warningRow}>
            <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
            <Text style={styles.infoText}>May take a few minutes to confirm.</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Error ──
  return (
    <View style={styles.container}>
      <View style={styles.successContent}>
        <View style={[styles.iconCircle, styles.iconCircleError]}>
          <Ionicons name="close" size={48} color={colors.semantic.error} />
        </View>

        <Text style={styles.title}>Liquidation Failed</Text>
        <Text style={styles.errorMessage}>{error || 'An error occurred'}</Text>
      </View>
    </View>
  );
});

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Processing ──
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  headerSubtitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  stepsContainer: {
    flex: 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  statusText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  // ── Success / Error ──
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: radii.full,
    backgroundColor: 'rgba(89, 170, 138, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircleError: {
    backgroundColor: 'rgba(208, 76, 104, 0.15)',
  },
  successMessage: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  errorMessage: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  linksContainer: {
    marginTop: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  swapContainer: {
    marginTop: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  txLabelText: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.medium,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  txidText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
  },
  explorerText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.brand.primary,
  },
  swapPendingText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  infoText: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
  },
});

export default LiquidationStatusScreen;
