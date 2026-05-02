/**
 * VaultActionSuccess - Shared success UI component for all vault actions
 * Used by: DepositSuccessScreen, WithdrawSuccessScreen, BorrowSuccessScreen, RepaySuccessScreen
 */

import React, { useCallback, useEffect } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import TouchableScale from '../common/TouchableScale';
import { useNotifications } from '../../stores/notificationStore';
import { EVM_CONFIG } from '../../constants/evm';
import { getTxUrl } from '../../utils/constants';
import { formatBTC, formatFiat } from '../../utils/formatters';
import { formatVaultUsd } from '../../utils/vaultFaceValue';
import { colors, fonts, fontSizes, radii, spacing } from '../../styles/theme';

export type VaultActionType = 'create' | 'deposit' | 'withdraw' | 'borrow' | 'repay';

interface VaultActionTxItem {
  label: string;
  txid: string;
  explorerUrl: string;
}

interface VaultActionSuccessProps {
  actionType: VaultActionType;
  amount: number;
  usdValue: number;
  txid: string;
  unit: 'BTC' | 'UNIT' | 'USD' | 'USDC' | 'wUNIT';
  titleOverride?: string;
  messageOverride?: string;
  txItems?: VaultActionTxItem[];
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

function truncateTxid(txid: string): string {
  return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
}

export default function VaultActionSuccess({
  actionType,
  amount,
  usdValue,
  txid,
  unit,
  titleOverride,
  messageOverride,
  txItems,
  onDone,
}: VaultActionSuccessProps) {
  const { showToast } = useNotifications();
  const config = {
    ...ACTION_CONFIG[actionType],
    title: titleOverride || ACTION_CONFIG[actionType].title,
    message: messageOverride || ACTION_CONFIG[actionType].message,
  };

  const resolvedTxItems: VaultActionTxItem[] = txItems && txItems.length > 0
    ? txItems
    : txid
      ? [{ label: 'Transaction', txid, explorerUrl: getTxUrl(txid) }]
      : [];

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleCopyTxid = useCallback(
    async (value: string) => {
      await Clipboard.setStringAsync(value);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast('Transaction ID copied');
    },
    [showToast],
  );

  const handleOpenExplorer = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID={`vault-${actionType}-success-screen`}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={48} color={colors.semantic.success} />
          </View>
        </View>

        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.amount}>{formattedAmount}</Text>
        {shouldShowUsdApproximation && (
          <Text style={styles.amountUsd}>≈ ${formatFiat(usdValue)}</Text>
        )}

        {resolvedTxItems.length > 0 && (
          <View style={styles.linksContainer}>
            <Text style={styles.linksTitle}>Transactions</Text>
            {resolvedTxItems.map((item, index) => (
              <View key={`${item.label}-${item.txid}`} style={styles.txItem}>
                <Text style={styles.txLabel}>{item.label}</Text>
                <TouchableOpacity onPress={() => handleCopyTxid(item.txid)} style={styles.linkRow} activeOpacity={0.7}>
                  <Ionicons name="copy-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.txId}>{truncateTxid(item.txid)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleOpenExplorer(item.explorerUrl)} style={styles.linkRow} activeOpacity={0.7}>
                  <Ionicons name="open-outline" size={16} color={colors.brand.primary} />
                  <Text style={styles.explorerText}>View on Explorer</Text>
                </TouchableOpacity>
                {index < resolvedTxItems.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        )}

        <View style={styles.warningRow}>
          <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
          <Text style={styles.infoText}>{config.message}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableScale style={styles.doneButton} onPress={onDone} testID="vault-success-done-btn" pressLockMs={700}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableScale>
      </View>
    </SafeAreaView>
  );
}

export function buildVaultSuccessTxItems(params: {
  mutinynetTxid?: string | null;
  sepoliaTxHash?: string | null;
  includeSepolia?: boolean;
}): VaultActionTxItem[] {
  const items: VaultActionTxItem[] = [];

  if (params.mutinynetTxid) {
    items.push({
      label: 'Mutinynet creation',
      txid: params.mutinynetTxid,
      explorerUrl: getTxUrl(params.mutinynetTxid),
    });
  }

  if (params.includeSepolia && params.sepoliaTxHash) {
    items.push({
      label: 'Sepolia USDC deposit',
      txid: params.sepoliaTxHash,
      explorerUrl: `${EVM_CONFIG.explorerBaseUrl}/tx/${params.sepoliaTxHash}`,
    });
  }

  return items;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  iconContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
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
  linksContainer: {
    marginTop: spacing.lg,
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
  txItem: {
    paddingVertical: spacing.xs,
  },
  txLabel: {
    fontSize: 12,
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
    marginTop: spacing.sm,
  },
  explorerText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.brand.primary,
    marginLeft: spacing.sm,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  infoText: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
    flex: 1,
    textAlign: 'center',
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
