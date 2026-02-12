/**
 * VaultConfirmScreen - Generic confirm screen for all vault operations
 * Uses configuration pattern to handle borrow, deposit, repay, and withdraw
 */

import React from 'react';
import { Text, View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TouchableScale from '../../components/common/TouchableScale';
import Icon from '../../components/icons';
import { useVaultConfirmScreen } from './hooks/useVaultConfirmScreen';
import { formatFiat } from '../../utils/formatters';
import type { VaultConfirmScreenConfig, VaultScreenNavigationProp, SummaryRow } from './types';
import { colors, fonts, fontSizes, spacing, radii } from '../../styles/theme';

interface VaultConfirmScreenProps {
  navigation: VaultScreenNavigationProp;
  config: VaultConfirmScreenConfig;
  store: any; // Operation-specific store hook result
  vaultHook: any; // Operation-specific vault hook result
}

export default function VaultConfirmScreen({
  navigation,
  config,
  store,
  vaultHook,
}: VaultConfirmScreenProps) {
  const {
    primaryAmount,
    summaryRows,
    estimatedFeeSats,
    feeUsdValue,
    selectedFeeRate,
    isAuthenticating,
    isLoading,
    error,
    handleConfirm,
    handleBack,
  } = useVaultConfirmScreen({ config, store, vaultHook }, navigation);

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID={`vault-${config.operationType}-confirm-screen`}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header} accessibilityRole="header">
          <Text style={styles.title} accessibilityRole="header">{config.title}</Text>
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
            accessibilityHint="Go back to the previous screen"
          >
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          {/* Primary Amount - Highlighted */}
          <View style={styles.primarySection}>
            <Text style={styles.primaryLabel}>{getOperationLabel(config.operationType)}</Text>
            <View style={styles.amountRow}>
              <Text style={styles.primaryAmount}>
                {primaryAmount.unit === 'UNIT'
                  ? primaryAmount.amount.toFixed(2)
                  : primaryAmount.amount.toFixed(8)}
              </Text>
              <Icon
                name={primaryAmount.unit === 'UNIT' ? 'unit_symbol' : 'btc_symbol'}
                size={24}
              />
            </View>
            {primaryAmount.unit === 'UNIT' && (
              <Text style={styles.primaryUsd}>≈ ${formatFiat(primaryAmount.amount)}</Text>
            )}
          </View>

          <View style={styles.divider} />

          {/* Summary Rows */}
          {summaryRows.map((row, index) => (
            <React.Fragment key={row.label}>
              <SummaryRowView row={row} />
              {index < summaryRows.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Fee Display */}
        <View style={styles.feeSection}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Network Fee</Text>
            <View style={styles.feeValues}>
              <View style={styles.feeAmountRow}>
                <Text style={styles.feeAmount}>{(estimatedFeeSats / 100_000_000).toFixed(8)}</Text>
                <Icon name="btc_symbol" size={14} />
              </View>
              <Text style={styles.feeUsdText}>≈ ${formatFiat(feeUsdValue)}</Text>
            </View>
          </View>
          <View style={[styles.feeRow, { marginTop: spacing.sm }]}>
            <Text style={styles.feeLabel}>Fee Rate</Text>
            <Text style={styles.feeAmount}>{selectedFeeRate} sat/vB</Text>
          </View>
        </View>

        {/* Error message */}
        {error && (
          <View
            style={styles.errorContainer}
            accessibilityRole="alert"
            accessibilityLabel={`Error: ${error}`}
          >
            <Text style={styles.errorText} accessibilityElementsHidden>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableScale
          style={styles.backButton}
          onPress={handleBack}
          disabled={isLoading || isAuthenticating}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Return to the previous screen to modify the amount"
          accessibilityState={{ disabled: isLoading || isAuthenticating }}
        >
          <Text style={styles.backText} accessibilityElementsHidden>Back</Text>
        </TouchableScale>

        <TouchableScale
          style={[styles.confirmButton, (isLoading || isAuthenticating) && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={isLoading || isAuthenticating}
          testID={`vault-${config.operationType}-confirm-btn`}
          accessibilityRole="button"
          accessibilityLabel={isAuthenticating ? "Authenticating with biometrics" : "Confirm and sign transaction"}
          accessibilityHint="Authenticate to sign and broadcast the transaction"
          accessibilityState={{ disabled: isLoading || isAuthenticating }}
        >
          {isAuthenticating ? (
            <Ionicons name="finger-print" size={20} color={colors.text.white} accessibilityElementsHidden />
          ) : (
            <Text style={styles.confirmText} accessibilityElementsHidden>Confirm & Sign</Text>
          )}
        </TouchableScale>
      </View>
    </SafeAreaView>
  );
}

// Summary row component
function SummaryRowView({ row }: { row: SummaryRow }) {
  const hasChange = row.showArrow && row.newValue !== undefined;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{row.label}</Text>
      <View style={styles.changeRow}>
        <Text style={[styles.value, row.valueColor ? { color: row.valueColor } : undefined]}>
          {row.currentValue}
        </Text>
        {row.currentUnit && (
          <Icon
            name={row.currentUnit === 'UNIT' ? 'unit_symbol' : 'btc_symbol'}
            size={row.currentUnit === 'UNIT' ? 14 : 16}
            color={hasChange ? colors.text.secondary : undefined}
          />
        )}
        {hasChange && (
          <>
            <Ionicons name="arrow-forward" size={14} color={colors.text.tertiary} />
            <Text style={[styles.valueHighlight, row.newValueColor ? { color: row.newValueColor } : undefined]}>
              {row.newValue}
            </Text>
            {row.newUnit && (
              <Icon
                name={row.newUnit === 'UNIT' ? 'unit_symbol' : 'btc_symbol'}
                size={row.newUnit === 'UNIT' ? 14 : 16}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

function getOperationLabel(operationType: string): string {
  switch (operationType) {
    case 'borrow':
      return 'Borrow Amount';
    case 'deposit':
      return 'Deposit Amount';
    case 'repay':
      return 'Repay Amount';
    case 'withdraw':
      return 'Withdraw Amount';
    default:
      return 'Amount';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  summaryCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  primarySection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  primaryLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryAmount: {
    fontSize: fontSizes.xxxl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  primaryUsd: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
  },
  value: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  valueHighlight: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  feeSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  feeValues: {
    alignItems: 'flex-end',
  },
  feeAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  feeAmount: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  feeUsdText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  errorContainer: {
    backgroundColor: 'rgba(208, 76, 104, 0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.semantic.error,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  backText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  confirmButton: {
    flex: 2,
    backgroundColor: colors.brand.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
