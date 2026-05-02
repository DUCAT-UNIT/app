/**
 * VaultConfirmScreen - Generic confirm screen for all vault operations
 * Uses configuration pattern to handle borrow, deposit, repay, and withdraw
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator,ScrollView,StyleSheet,Text,TouchableOpacity,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TouchableScale from '../../components/common/TouchableScale';
import Icon from '../../components/icons';
import { ReceiveAssetBadge, getReceiveAssetMeta } from '../../components/vaultAction';
import { colors,fonts,fontSizes,radii,spacing } from '../../styles/theme';
import { formatFiat } from '../../utils/formatters';
import { useVaultConfirmScreen } from './hooks/useVaultConfirmScreen';
import type {
  SummaryRow,
  VaultConfirmScreenConfig,
  VaultOperationHookState,
  VaultScreenNavigationProp,
  VaultStoreState,
} from './types';

interface VaultConfirmScreenProps<
  TStore extends VaultStoreState,
  THook extends VaultOperationHookState,
> {
  navigation: VaultScreenNavigationProp;
  config: VaultConfirmScreenConfig<TStore>;
  store: TStore;
  vaultHook: THook;
}

export default function VaultConfirmScreen<
  TStore extends VaultStoreState,
  THook extends VaultOperationHookState,
>({
  navigation,
  config,
  store,
  vaultHook,
}: VaultConfirmScreenProps<TStore, THook>) {
  const {
    primaryAmount,
    summaryRows,
    estimatedFeeSats,
    feeUsdValue,
    selectedFeeRate,
    isAuthenticating,
    isSubmitting,
    isLoading,
    error,
    handleConfirm,
    handleClose,
    handleBack,
  } = useVaultConfirmScreen({ config, store, vaultHook }, navigation);
  const isUsdPrimaryAmount = primaryAmount.unit === 'USD';
  const isUnitPrimaryAmount = primaryAmount.unit === 'UNIT';
  const isBusy = isLoading || isAuthenticating || isSubmitting;
  const selectedPayoutRow = summaryRows.find((row) => row.badgeAsset);
  const payoutMeta = selectedPayoutRow?.badgeAsset ? getReceiveAssetMeta(selectedPayoutRow.badgeAsset) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID={`vault-${config.operationType}-confirm-screen`}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header} accessibilityRole="header">
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Review</Text>
            <Text style={styles.title} accessibilityRole="header">{config.title}</Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
            accessibilityHint={`Close ${config.title} screen`}
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
              {isUsdPrimaryAmount ? (
                <Text style={styles.primaryAmount}>${formatFiat(primaryAmount.amount)}</Text>
              ) : (
                <>
                  <Text style={styles.primaryAmount}>
                    {isUnitPrimaryAmount
                      ? primaryAmount.amount.toFixed(2)
                      : primaryAmount.amount.toFixed(8)}
                  </Text>
                  <Icon
                    name={isUnitPrimaryAmount ? 'unit_symbol' : 'btc_symbol'}
                    size={24}
                  />
                </>
              )}
            </View>
            {isUnitPrimaryAmount && (
              <Text style={styles.primaryUsd}>≈ ${formatFiat(primaryAmount.amount)}</Text>
            )}
          </View>

          {payoutMeta && (
            <>
              <View style={styles.divider} />
              <View style={styles.routeCard}>
                <View style={styles.routeCopy}>
                  <Text style={styles.routeLabel}>Payout Route</Text>
                  <Text style={styles.routeText}>{payoutMeta.note}</Text>
                </View>
                <ReceiveAssetBadge asset={payoutMeta.label as 'USDC' | 'UNIT'} />
              </View>
            </>
          )}

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
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Return to the previous screen to modify the amount"
          accessibilityState={{ disabled: isBusy }}
          pressLockMs={700}
        >
          <Text style={styles.backText} accessibilityElementsHidden>Back</Text>
        </TouchableScale>

        <TouchableScale
          style={[styles.confirmButton, isBusy && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={isBusy}
          testID={`vault-${config.operationType}-confirm-btn`}
          accessibilityRole="button"
          accessibilityLabel={isBusy ? "Preparing transaction" : "Confirm and sign transaction"}
          accessibilityHint="Authenticate to sign and broadcast the transaction"
          accessibilityState={{ disabled: isBusy, busy: isBusy }}
          lockWhilePending
          pressLockMs={900}
        >
          {isBusy ? (
            isAuthenticating ? (
              <Ionicons name="finger-print" size={20} color={colors.text.white} accessibilityElementsHidden />
            ) : (
              <View style={styles.busyButtonContent}>
                <ActivityIndicator size="small" color={colors.text.white} />
                <Text style={styles.confirmText} accessibilityElementsHidden>Preparing...</Text>
              </View>
            )
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
  const showCurrentIcon = row.currentUnit === 'UNIT' || row.currentUnit === 'BTC';
  const showNewIcon = row.newUnit === 'UNIT' || row.newUnit === 'BTC';
  const showsBadge = !!row.badgeAsset;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{row.label}</Text>
      {showsBadge ? (
        <ReceiveAssetBadge asset={row.badgeAsset!} size="sm" />
      ) : (
        <View style={styles.changeRow}>
          <Text style={[styles.value, row.valueColor ? { color: row.valueColor } : undefined]}>
            {row.currentValue}
          </Text>
          {showCurrentIcon && (
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
              {showNewIcon && (
                <Icon
                  name={row.newUnit === 'UNIT' ? 'unit_symbol' : 'btc_symbol'}
                  size={row.newUnit === 'UNIT' ? 14 : 16}
                />
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function getOperationLabel(operationType: string): string {
  switch (operationType) {
    case 'borrow':
      return 'Borrow Value';
    case 'deposit':
      return 'Deposit Amount';
    case 'repay':
      return 'Repay Value';
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
  headerCopy: {
    gap: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
    zIndex: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.brand.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
  routeCard: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  routeCopy: {
    flex: 1,
    gap: 2,
  },
  routeLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  routeText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  label: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    flex: 1,
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
  busyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
