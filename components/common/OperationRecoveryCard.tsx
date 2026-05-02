import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, fonts, fontSizes, radii, spacing } from '../../styles/theme';

interface OperationRecoveryCardProps {
  title: string;
  body: string;
  statusLabel?: string;
  txid?: string | null;
  error?: string | null;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
  busy?: boolean;
  disabled?: boolean;
  retryable?: boolean;
  children?: React.ReactNode;
  testID?: string;
}

function shortTxid(txid: string): string {
  return txid.length <= 18 ? txid : `${txid.slice(0, 10)}...${txid.slice(-6)}`;
}

export default function OperationRecoveryCard({
  title,
  body,
  statusLabel,
  txid,
  error,
  primaryLabel,
  secondaryLabel,
  onPrimaryPress,
  onSecondaryPress,
  busy = false,
  disabled = false,
  retryable = false,
  children,
  testID,
}: OperationRecoveryCardProps): React.ReactElement {
  const showActions = Boolean(primaryLabel && onPrimaryPress) || Boolean(secondaryLabel && onSecondaryPress);

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {statusLabel ? (
          <Text style={[styles.statusPill, retryable && styles.retryablePill]}>
            {statusLabel}
          </Text>
        ) : null}
      </View>
      <Text style={styles.body}>{body}</Text>
      {txid ? <Text style={styles.meta}>Tx: {shortTxid(txid)}</Text> : null}
      {error ? <Text style={styles.error}>Error: {error}</Text> : null}
      {children}
      {showActions ? (
        <View style={styles.actionRow}>
          {primaryLabel && onPrimaryPress ? (
            <TouchableOpacity
              style={[styles.primaryButton, (busy || disabled) && styles.disabled]}
              onPress={onPrimaryPress}
              disabled={busy || disabled}
              testID={`${testID || 'operation-recovery'}-primary-btn`}
            >
              {busy ? (
                <ActivityIndicator color={colors.text.white} />
              ) : (
                <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
              )}
            </TouchableOpacity>
          ) : null}
          {secondaryLabel && onSecondaryPress ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onSecondaryPress}
              testID={`${testID || 'operation-recovery'}-secondary-btn`}
            >
              <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
  statusPill: {
    color: colors.semantic.warning,
    fontSize: fontSizes.xs,
    fontFamily: fonts.bold,
  },
  retryablePill: {
    color: colors.semantic.error,
  },
  body: {
    color: colors.text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  meta: {
    color: colors.text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
  },
  error: {
    color: colors.semantic.error,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  primaryButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  disabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.text.white,
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
  },
  secondaryButton: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
  },
});
