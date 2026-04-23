import { Ionicons } from '@expo/vector-icons';
import React from 'react';
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
}

type OptionMeta = {
  title: string;
  subtitle: string;
  description: string;
  icon: 'usdc_logo' | 'unit_logo';
  recommended?: boolean;
  bullets: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }>;
};

const OPTIONS: Record<VaultSettlementRequestedAsset, OptionMeta> = {
  USDC: {
    title: 'Receive as USDC',
    subtitle: 'Cash out',
    description: "We'll automatically convert and settle to USDC after issuance.",
    icon: 'usdc_logo',
    recommended: true,
    bullets: [
      { icon: 'wallet-outline', label: 'Receive USDC in your wallet' },
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
}: ReceiveAssetStepProps): React.JSX.Element {
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
          <Text style={styles.title}>Where should we send your borrowed value?</Text>
          <Text style={styles.subtitle}>
            Choose how you&apos;d like to receive{' '}
            <Text style={styles.subtitleAmount}>{formatVaultUsd(amountUsd)}</Text>
            {' '}in value.
          </Text>
        </View>

        <View style={styles.cardList}>
          {(['USDC', 'UNIT'] as VaultSettlementRequestedAsset[]).map((asset) => {
            const option = OPTIONS[asset];
            const isSelected = value === asset;
            return (
              <TouchableScale
                key={asset}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => onChange(asset)}
                testID={testIDPrefix ? `${testIDPrefix}-${asset.toLowerCase()}-card` : undefined}
              >
                <View style={styles.optionTopRow}>
                  <View style={styles.optionIdentity}>
                    <View style={[styles.optionIconWrap, isSelected && styles.optionIconWrapSelected]}>
                      <Icon name={option.icon} size={26} />
                    </View>
                    <View style={styles.optionIdentityCopy}>
                      <View style={styles.optionTitleRow}>
                        <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                          {option.title}
                        </Text>
                        {option.recommended && (
                          <View style={styles.recommendedBadge}>
                            <Text style={styles.recommendedText}>Recommended</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.optionSubtitle, isSelected && styles.optionSubtitleSelected]}>
                        {option.subtitle}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.selectionCircle, isSelected && styles.selectionCircleSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.brand.primary} />}
                  </View>
                </View>

                <Text style={[styles.optionDescription, isSelected && styles.optionDescriptionSelected]}>
                  {option.description}
                </Text>

                <View style={styles.bulletList}>
                  {option.bullets.map((bullet) => (
                    <View key={`${asset}-${bullet.label}`} style={styles.bulletRow}>
                      <Ionicons
                        name={bullet.icon}
                        size={19}
                        color={isSelected ? colors.text.primary : colors.text.secondary}
                      />
                      <Text style={[styles.bulletText, isSelected && styles.bulletTextSelected]}>
                        {bullet.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </TouchableScale>
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
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  stepLabel: {
    color: colors.brand.primary,
    fontSize: fontSizes.lg,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text.white,
    fontSize: 28,
    lineHeight: 38,
    fontFamily: fonts.bold,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: fontSizes.lg,
    lineHeight: 28,
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
    borderRadius: radii.xxl,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  optionCardSelected: {
    borderColor: colors.brand.primary,
    boxShadow: '0 0 0 1px rgba(24,88,228,0.3)',
  },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  optionIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  optionIconWrap: {
    width: 52,
    height: 52,
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
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionTitle: {
    color: colors.text.white,
    fontSize: fontSizes.xl,
    fontFamily: fonts.bold,
  },
  optionTitleSelected: {
    color: colors.text.white,
  },
  optionSubtitle: {
    color: colors.text.primary,
    fontSize: fontSizes.lg,
    fontFamily: fonts.medium,
  },
  optionSubtitleSelected: {
    color: colors.text.primary,
  },
  recommendedBadge: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
  },
  recommendedText: {
    color: colors.text.white,
    fontSize: 11,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
  },
  selectionCircle: {
    width: 38,
    height: 38,
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
    fontSize: fontSizes.lg,
    lineHeight: 32,
    fontFamily: fonts.regular,
  },
  optionDescriptionSelected: {
    color: colors.text.primary,
  },
  bulletList: {
    gap: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  bulletText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSizes.lg,
    lineHeight: 28,
    fontFamily: fonts.regular,
  },
  bulletTextSelected: {
    color: colors.text.primary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.bg.primary,
  },
  continueButton: {
    backgroundColor: colors.text.white,
    borderRadius: radii.xxl,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  continueText: {
    color: colors.bg.primary,
    fontSize: fontSizes.lg,
    fontFamily: fonts.bold,
  },
});

export default ReceiveAssetStep;
