import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { VaultSettlementRequestedAsset } from '../../stores/vaultSettlementStore';
import { colors, fonts, fontSizes, radii, spacing } from '../../styles/theme';
import { ReceiveAssetBadge, getReceiveAssetMeta } from './ReceiveAssetBadge';

interface ReceiveAssetSelectorProps {
  value: VaultSettlementRequestedAsset;
  onChange: (asset: VaultSettlementRequestedAsset) => void;
  title?: string;
  subtitle?: string;
  testIDPrefix?: string;
}

const OPTIONS: VaultSettlementRequestedAsset[] = ['USDC', 'UNIT'];

export function ReceiveAssetSelector({
  value,
  onChange,
  title = 'Receive As',
  subtitle = 'USDC settles on Sepolia. UNIT stays on Mutinynet.',
  testIDPrefix,
}: ReceiveAssetSelectorProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>Payout</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <ReceiveAssetBadge asset={value} size="sm" />
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.toggleRow}>
        {OPTIONS.map((option) => {
          const isActive = option === value;
          const meta = getReceiveAssetMeta(option);
          return (
            <TouchableOpacity
              key={option}
              style={[styles.optionButton, isActive && styles.optionButtonActive]}
              onPress={() => onChange(option)}
              activeOpacity={0.85}
              testID={testIDPrefix ? `${testIDPrefix}-${option.toLowerCase()}-btn` : undefined}
            >
              <View style={styles.optionMainRow}>
                <ReceiveAssetBadge asset={option} tone={isActive ? 'inverse' : 'default'} />
                {isActive && <Ionicons name="checkmark-circle" size={18} color={colors.bg.primary} />}
              </View>
              <Text style={[styles.optionDescription, isActive && styles.optionDescriptionActive]}>
                {meta.note}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleWrap: {
    gap: 2,
    flex: 1,
  },
  eyebrow: {
    color: colors.brand.primary,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: fonts.regular,
    lineHeight: 17,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionButton: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  optionButtonActive: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  optionMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  optionDescription: {
    color: colors.text.secondary,
    fontSize: 11,
    fontFamily: fonts.regular,
    lineHeight: 15,
  },
  optionDescriptionActive: {
    color: 'rgba(17,16,21,0.72)',
  },
});
