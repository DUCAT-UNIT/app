import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TouchableScale from '../common/TouchableScale';
import Icon from '../icons';
import type { VaultSettlementRequestedAsset } from '../../stores/vaultSettlementStore';
import { colors, fonts, fontSizes, radii, spacing } from '../../styles/theme';
import { formatVaultUsd } from '../../utils/vaultFaceValue';

type RepayFundingBalances = Record<VaultSettlementRequestedAsset, number>;

interface RepayFundingStepProps {
  amountUsd: number;
  value: VaultSettlementRequestedAsset;
  balances: RepayFundingBalances;
  onChange: (asset: VaultSettlementRequestedAsset) => void;
  onBack: () => void;
  onContinue: () => void;
  testIDPrefix?: string;
  allowUsdc?: boolean;
  allowTurboUnit?: boolean;
}

type OptionMeta = {
  title: string;
  subtitle: string;
  description: string;
  balanceLabel: string;
  icon: 'usdc_logo' | 'unit_logo';
  bullets: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }>;
};

const OPTIONS: Record<VaultSettlementRequestedAsset, OptionMeta> = {
  UNIT: {
    title: 'Repay with UNIT',
    subtitle: 'Use spendable UNIT',
    description: 'Spend UNIT already available in your Mutinynet wallet.',
    balanceLabel: 'Spendable UNIT',
    icon: 'unit_logo',
    bullets: [
      { icon: 'layers-outline', label: 'Fastest path when UNIT is already spendable' },
      { icon: 'swap-horizontal-outline', label: 'No TurboUNIT melt or Sepolia redemption' },
      { icon: 'shield-checkmark-outline', label: 'Repays the vault directly' },
    ],
  },
  TURBOUNIT: {
    title: 'Repay with TurboUNIT',
    subtitle: 'Use UNIT + TurboUNIT',
    description: 'Melt only the needed TurboUNIT, then repay with your combined UNIT balance.',
    balanceLabel: 'UNIT + TurboUNIT',
    icon: 'unit_logo',
    bullets: [
      { icon: 'flash-outline', label: 'Uses your TurboUNIT balance' },
      { icon: 'qr-code-outline', label: 'Good when borrowed funds were kept as TurboUNIT' },
      { icon: 'git-network-outline', label: 'App waits for released UNIT before final repay' },
    ],
  },
  USDC: {
    title: 'Repay with Sepolia USDC',
    subtitle: 'Redeem to UNIT first',
    description: 'Redeem Sepolia USDC into UNIT, then use the released UNIT to repay the vault.',
    balanceLabel: 'Sepolia USDC',
    icon: 'usdc_logo',
    bullets: [
      { icon: 'wallet-outline', label: 'Uses your Sepolia USDC balance' },
      { icon: 'swap-horizontal-outline', label: 'Automatically requests the UNIT release' },
      { icon: 'shield-checkmark-outline', label: 'Best when borrowed funds were settled to USDC' },
    ],
  },
};

function formatBalance(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

export function RepayFundingStep({
  amountUsd,
  value,
  balances,
  onChange,
  onBack,
  onContinue,
  testIDPrefix,
  allowUsdc = false,
  allowTurboUnit = true,
}: RepayFundingStepProps): React.JSX.Element {
  const [expandedAsset, setExpandedAsset] = useState<VaultSettlementRequestedAsset | null>(value);
  const availableAssets = useMemo(
    (): VaultSettlementRequestedAsset[] => [
      'UNIT',
      ...(allowTurboUnit ? (['TURBOUNIT'] as const) : []),
      ...(allowUsdc ? (['USDC'] as const) : []),
    ],
    [allowTurboUnit, allowUsdc],
  );

  const selectedCanContinue = availableAssets.includes(value) && balances[value] >= amountUsd;

  useEffect(() => {
    if (selectedCanContinue) return;
    const firstFundedAsset = availableAssets.find((asset) => balances[asset] >= amountUsd);
    if (firstFundedAsset && firstFundedAsset !== value) {
      onChange(firstFundedAsset);
      setExpandedAsset(firstFundedAsset);
    }
  }, [amountUsd, availableAssets, balances, onChange, selectedCanContinue, value]);

  const handleSelect = (asset: VaultSettlementRequestedAsset) => {
    if (balances[asset] < amountUsd) return;
    onChange(asset);
    setExpandedAsset(asset);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={28} color={colors.text.secondary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.stepLabel}>Step 2 of 3</Text>
          <Text style={styles.title}>What do you want to repay with?</Text>
          <Text style={styles.subtitle}>
            Choose the source for{' '}
            <Text style={styles.subtitleAmount}>{formatVaultUsd(amountUsd)}</Text>.
          </Text>
        </View>

        <View style={styles.cardList}>
          {availableAssets.map((asset) => {
            const option = OPTIONS[asset];
            const isSelected = value === asset;
            const isExpanded = isSelected && expandedAsset === asset;
            const balance = balances[asset] || 0;
            const isFunded = balance >= amountUsd;

            return (
              <View
                key={asset}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                  !isFunded && styles.optionCardDisabled,
                ]}
              >
                <TouchableScale
                  style={styles.optionButton}
                  onPress={() => handleSelect(asset)}
                  disabled={!isFunded}
                  testID={testIDPrefix ? `${testIDPrefix}-${asset.toLowerCase()}-card` : undefined}
                >
                  <View style={styles.optionTopRow}>
                    <View style={styles.optionIdentity}>
                      <View style={[styles.optionIconWrap, isSelected && styles.optionIconWrapSelected]}>
                        <Icon name={option.icon} size={24} />
                      </View>
                      <View style={styles.optionIdentityCopy}>
                        <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                          {option.title}
                        </Text>
                        <Text style={styles.optionSubtitle}>
                          {option.subtitle} · {formatBalance(balance)} available
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.selectionCircle, isSelected && styles.selectionCircleSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={18} color={colors.brand.primary} />}
                    </View>
                  </View>
                </TouchableScale>

                {!isFunded && (
                  <Text style={styles.insufficientText}>
                    Not enough {option.balanceLabel} for this repay amount.
                  </Text>
                )}

                {isSelected && (
                  <TouchableOpacity
                    onPress={() => setExpandedAsset(isExpanded ? null : asset)}
                    style={styles.detailsButton}
                    accessibilityRole="button"
                    accessibilityLabel={isExpanded ? `Hide ${asset} details` : `Show ${asset} details`}
                  >
                    <Text style={styles.detailsButtonText}>
                      {isExpanded ? 'Hide details' : 'View details'}
                    </Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.text.secondary}
                    />
                  </TouchableOpacity>
                )}

                {isExpanded && (
                  <View style={styles.detailsPanel}>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                    <View style={styles.bulletList}>
                      {option.bullets.map((bullet) => (
                        <View key={`${asset}-${bullet.label}`} style={styles.bulletRow}>
                          <Ionicons name={bullet.icon} size={16} color={colors.text.primary} />
                          <Text style={styles.bulletText}>{bullet.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableScale
          style={[styles.continueButton, !selectedCanContinue && styles.continueButtonDisabled]}
          onPress={onContinue}
          disabled={!selectedCanContinue}
          testID={testIDPrefix ? `${testIDPrefix}-continue-btn` : undefined}
        >
          <Text style={[styles.continueText, !selectedCanContinue && styles.continueTextDisabled]}>
            Continue
          </Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  stepLabel: {
    color: colors.brand.primary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  title: {
    color: colors.text.white,
    fontSize: fontSizes.xl,
    lineHeight: 34,
    fontFamily: fonts.bold,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: fontSizes.sm,
    lineHeight: 21,
    fontFamily: fonts.regular,
  },
  subtitleAmount: {
    color: colors.brand.primary,
    fontFamily: fonts.bold,
  },
  cardList: {
    gap: spacing.md,
  },
  optionCard: {
    backgroundColor: '#161b22',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  optionCardSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: '#171f2a',
  },
  optionCardDisabled: {
    opacity: 0.62,
  },
  optionButton: {
    paddingVertical: spacing.xs,
  },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  optionIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24,88,228,0.12)',
  },
  optionIconWrapSelected: {
    backgroundColor: 'rgba(24,88,228,0.18)',
  },
  optionIdentityCopy: {
    gap: 4,
    flex: 1,
  },
  optionTitle: {
    color: colors.text.white,
    fontSize: fontSizes.lg,
    fontFamily: fonts.bold,
  },
  optionTitleSelected: {
    color: colors.text.white,
  },
  optionSubtitle: {
    color: colors.text.primary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
  },
  selectionCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  selectionCircleSelected: {
    borderColor: colors.brand.primary,
  },
  insufficientText: {
    color: colors.semantic.warning,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    marginTop: spacing.sm,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingVertical: 4,
  },
  detailsButtonText: {
    color: colors.text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
  },
  detailsPanel: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  optionDescription: {
    color: colors.text.primary,
    fontSize: fontSizes.md,
    lineHeight: 22,
    fontFamily: fonts.regular,
  },
  bulletList: {
    gap: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bulletText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.bg.primary,
  },
  continueButton: {
    backgroundColor: colors.text.white,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: colors.bg.tertiary,
  },
  continueText: {
    color: colors.bg.primary,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
  continueTextDisabled: {
    color: colors.text.tertiary,
  },
});
