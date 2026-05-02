import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TouchableScale from '../common/TouchableScale';
import Icon from '../icons';
import type { VaultSettlementRequestedAsset } from '../../stores/vaultSettlementStore';
import { colors, fonts, fontSizes, radii, spacing } from '../../styles/theme';
import { formatVaultUsd } from '../../utils/vaultFaceValue';

interface ReceiveAssetStepProps {
  amountUsd: number;
  value: VaultSettlementRequestedAsset;
  onChange: (asset: VaultSettlementRequestedAsset) => void;
  onBack: () => void;
  onContinue: () => void;
  testIDPrefix?: string;
  allowUsdc?: boolean;
}

type OptionMeta = {
  title: string;
  subtitle: string;
  description: string;
  icon: 'usdc_logo' | 'unit_logo';
  bullets: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }>;
};

const OPTIONS: Record<VaultSettlementRequestedAsset, OptionMeta> = {
  USDC: {
    title: 'Receive as Sepolia USDC',
    subtitle: 'Cash out',
    description: "We'll automatically convert and settle to Sepolia USDC after issuance.",
    icon: 'usdc_logo',
    bullets: [
      { icon: 'wallet-outline', label: 'Receive Sepolia USDC in your wallet' },
      { icon: 'shield-checkmark-outline', label: 'Best for cash out or holding stable value' },
      { icon: 'swap-horizontal-outline', label: 'Simple and direct' },
    ],
  },
  UNIT: {
    title: 'Receive as UNIT',
    subtitle: 'Stay in the system',
    description: "We'll issue UNIT directly to your wallet. No conversion.",
    icon: 'unit_logo',
    bullets: [
      { icon: 'layers-outline', label: 'Use UNIT across Mutinynet' },
      { icon: 'trending-up-outline', label: 'Best for composability and earning opportunities' },
      { icon: 'git-network-outline', label: 'Stay inside the ecosystem' },
    ],
  },
};

export function ReceiveAssetStep({
  amountUsd,
  value,
  onChange,
  onBack,
  onContinue,
  testIDPrefix,
  allowUsdc = false,
}: ReceiveAssetStepProps): React.JSX.Element {
  const [expandedAsset, setExpandedAsset] = useState<VaultSettlementRequestedAsset | null>(value);
  const availableAssets: VaultSettlementRequestedAsset[] = allowUsdc ? ['USDC', 'UNIT'] : ['UNIT'];

  const handleSelect = (asset: VaultSettlementRequestedAsset) => {
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
          <Text style={styles.title}>How do you want to receive your loan?</Text>
          <Text style={styles.subtitle}>
            {allowUsdc ? 'Choose Sepolia USDC or UNIT' : 'You will receive UNIT'} for{' '}
            <Text style={styles.subtitleAmount}>{formatVaultUsd(amountUsd)}</Text>.
          </Text>
        </View>

        <View style={styles.cardList}>
          {availableAssets.map((asset) => {
            const option = OPTIONS[asset];
            const isSelected = value === asset;
            const isExpanded = isSelected && expandedAsset === asset;
            return (
              <View key={asset} style={[styles.optionCard, isSelected && styles.optionCardSelected]}>
                <TouchableScale
                  style={styles.optionButton}
                  onPress={() => handleSelect(asset)}
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
                        <Text style={[styles.optionSubtitle, isSelected && styles.optionSubtitleSelected]}>
                          {option.subtitle}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.selectionCircle, isSelected && styles.selectionCircleSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={18} color={colors.brand.primary} />}
                    </View>
                  </View>
                </TouchableScale>

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
                    <Text style={[styles.optionDescription, isSelected && styles.optionDescriptionSelected]}>
                      {option.description}
                    </Text>

                    <View style={styles.bulletList}>
                      {option.bullets.map((bullet) => (
                        <View key={`${asset}-${bullet.label}`} style={styles.bulletRow}>
                          <Ionicons
                            name={bullet.icon}
                            size={16}
                            color={isSelected ? colors.text.primary : colors.text.secondary}
                          />
                          <Text style={[styles.bulletText, isSelected && styles.bulletTextSelected]}>
                            {bullet.label}
                          </Text>
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
        <TouchableScale style={styles.continueButton} onPress={onContinue} testID={testIDPrefix ? `${testIDPrefix}-continue-btn` : undefined}>
          <Text style={styles.continueText}>Continue</Text>
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
    letterSpacing: 0.8,
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
  optionSubtitleSelected: {
    color: colors.text.primary,
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
  optionDescription: {
    color: colors.text.primary,
    fontSize: fontSizes.md,
    lineHeight: 22,
    fontFamily: fonts.regular,
  },
  optionDescriptionSelected: {
    color: colors.text.primary,
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
  bulletTextSelected: {
    color: colors.text.primary,
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
  continueText: {
    color: colors.bg.primary,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
});
