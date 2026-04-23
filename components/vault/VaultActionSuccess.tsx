/**
 * VaultActionSuccess - Shared success UI component for all vault actions
 * Used by: DepositSuccessScreen, WithdrawSuccessScreen, BorrowSuccessScreen, RepaySuccessScreen
 */

import React, { useCallback, useEffect } from 'react';
import { Text, View, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import TouchableScale from '../common/TouchableScale';
import { ReceiveAssetBadge } from '../vaultAction';
import { useNotifications } from '../../stores/notificationStore';
import { getTxUrl } from '../../utils/constants';
import { formatFiat, formatBTC } from '../../utils/formatters';
import { formatVaultUsd } from '../../utils/vaultFaceValue';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

export type VaultActionType = 'create' | 'deposit' | 'withdraw' | 'borrow' | 'repay';

interface VaultActionSuccessProps {
  actionType: VaultActionType;
  amount: number;
  usdValue: number;
  txid: string;
  unit: 'BTC' | 'UNIT' | 'USD' | 'USDC' | 'wUNIT';
  titleOverride?: string;
  messageOverride?: string;
  onDone: () => void;
}

const ACTION_CONFIG = {
  create: {
    title: 'Vault Created!',
    message: 'May take a few minutes to confirm.',
  },
  deposit: {
    title: 'Deposit Complete!',
    message: 'Collateral added. May take a few minutes to confirm.',
  },
  withdraw: {
    title: 'Withdrawal Complete!',
    message: 'BTC withdrawn. May take a few minutes to confirm.',
  },
  borrow: {
    title: 'Borrow Complete!',
    message: 'Borrow recorded. May take a few minutes to confirm.',
  },
  repay: {
    title: 'Repayment Complete!',
    message: 'Debt reduced. May take a few minutes to confirm.',
  },
};

export default function VaultActionSuccess({
  actionType,
  amount,
  usdValue,
  txid,
  unit,
  titleOverride,
  messageOverride,
  onDone,
}: VaultActionSuccessProps) {
  const { showToast } = useNotifications();
  const config = {
    ...ACTION_CONFIG[actionType],
    title: titleOverride || ACTION_CONFIG[actionType].title,
    message: messageOverride || ACTION_CONFIG[actionType].message,
  };

  // Trigger haptic feedback on mount
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Copy transaction ID to clipboard
  const handleCopyTxid = useCallback(async () => {
    if (txid) {
      await Clipboard.setStringAsync(txid);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast('Transaction ID copied');
    }
  }, [txid, showToast]);

  // Open transaction in explorer
  const handleViewExplorer = useCallback(() => {
    if (txid) {
      const url = getTxUrl(txid);
      Linking.openURL(url);
    }
  }, [txid]);

  // Truncate txid for display
  const truncatedTxid = txid
    ? `${txid.slice(0, 8)}...${txid.slice(-8)}`
    : '';

  // Format amount based on unit
  const formattedAmount = unit === 'BTC'
    ? `${formatBTC(amount)} BTC`
    : unit === 'USD'
      ? formatVaultUsd(amount)
      : unit === 'USDC'
        ? `${formatFiat(amount)} USDC`
        : unit === 'wUNIT'
          ? `${amount.toFixed(2)} wUNIT`
          : `${amount.toFixed(2)} UNIT`;
  const shouldShowUsdApproximation = unit !== 'USD' && unit !== 'USDC';
  const receivesAssetBadge = unit === 'USDC' || unit === 'UNIT' || unit === 'wUNIT';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID={`vault-${actionType}-success-screen`}>
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={48} color={colors.semantic.success} />
          </View>
        </View>

        {/* Success Message */}
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.amount}>{formattedAmount}</Text>
        {shouldShowUsdApproximation && (
          <Text style={styles.amountUsd}>≈ ${formatFiat(usdValue)}</Text>
        )}
        {receivesAssetBadge && (
          <View style={styles.badgeWrap}>
            <ReceiveAssetBadge asset={unit as 'USDC' | 'UNIT' | 'wUNIT'} />
          </View>
        )}

        {/* Transaction Links */}
        {txid && (
          <View style={styles.linksContainer}>
            <Text style={styles.linksTitle}>Transaction</Text>
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
          <Text style={styles.infoText}>{config.message}</Text>
        </View>
      </View>

      {/* Done Button */}
      <View style={styles.footer}>
        <TouchableScale style={styles.doneButton} onPress={onDone} testID="vault-success-done-btn">
          <Text style={styles.doneText}>Done</Text>
        </TouchableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    marginTop: spacing.xxl,
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
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  amount: {
    fontSize: fontSizes.xxxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  amountUsd: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  badgeWrap: {
    marginBottom: spacing.md,
  },
  linksContainer: {
    marginTop: spacing.xl,
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignSelf: 'center',
    minWidth: 250,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  linksTitle: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.text.secondary,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: spacing.xs,
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
  doneText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
});
