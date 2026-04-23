import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from '../icons';
import { colors, fonts, fontSizes, radii, spacing } from '../../styles/theme';
import type { VaultSettlementRequestedAsset } from '../../stores/vaultSettlementStore';

type ReceiveAssetBadgeAsset = VaultSettlementRequestedAsset | 'wUNIT';
type ReceiveAssetBadgeSize = 'sm' | 'md';
type ReceiveAssetBadgeTone = 'default' | 'inverse';

interface ReceiveAssetBadgeProps {
  asset: ReceiveAssetBadgeAsset;
  size?: ReceiveAssetBadgeSize;
  tone?: ReceiveAssetBadgeTone;
}

interface ReceiveAssetMeta {
  icon: 'usdc_logo' | 'unit_logo';
  label: string;
  network: string;
  note: string;
}

export function getReceiveAssetMeta(asset: ReceiveAssetBadgeAsset): ReceiveAssetMeta {
  switch (asset) {
    case 'USDC':
      return {
        icon: 'usdc_logo',
        label: 'USDC',
        network: 'Sepolia',
        note: 'Auto-settled after issuance',
      };
    case 'wUNIT':
      return {
        icon: 'unit_logo',
        label: 'wUNIT',
        network: 'Sepolia',
        note: 'Fallback if auto-swap is unavailable',
      };
    case 'UNIT':
    default:
      return {
        icon: 'unit_logo',
        label: 'UNIT',
        network: 'Mutinynet',
        note: 'Issued directly to the wallet',
      };
  }
}

export function ReceiveAssetBadge({
  asset,
  size = 'md',
  tone = 'default',
}: ReceiveAssetBadgeProps): React.JSX.Element {
  const meta = getReceiveAssetMeta(asset);
  const compact = size === 'sm';
  const inverse = tone === 'inverse';

  return (
    <View
      style={[
        styles.container,
        compact ? styles.containerCompact : styles.containerRegular,
        inverse ? styles.containerInverse : styles.containerDefault,
      ]}
    >
      <View style={[styles.iconWrap, compact ? styles.iconWrapCompact : styles.iconWrapRegular, inverse && styles.iconWrapInverse]}>
        <Icon name={meta.icon} size={compact ? 16 : 18} />
      </View>
      <View style={styles.copyWrap}>
        <Text style={[styles.label, compact ? styles.labelCompact : styles.labelRegular, inverse && styles.labelInverse]}>
          {meta.label}
        </Text>
        <Text
          style={[
            styles.network,
            compact ? styles.networkCompact : styles.networkRegular,
            inverse && styles.networkInverse,
          ]}
        >
          {meta.network}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    borderWidth: 1,
    gap: spacing.sm,
  },
  containerRegular: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  containerCompact: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
  },
  containerDefault: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.default,
  },
  containerInverse: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(17,16,21,0.08)',
  },
  iconWrap: {
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  iconWrapRegular: {
    width: 28,
    height: 28,
  },
  iconWrapCompact: {
    width: 22,
    height: 22,
  },
  iconWrapInverse: {
    backgroundColor: 'rgba(17,16,21,0.08)',
  },
  copyWrap: {
    gap: 1,
  },
  label: {
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  labelRegular: {
    fontSize: fontSizes.sm,
  },
  labelCompact: {
    fontSize: 12,
  },
  labelInverse: {
    color: colors.bg.primary,
  },
  network: {
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  networkRegular: {
    fontSize: 11,
  },
  networkCompact: {
    fontSize: 10,
  },
  networkInverse: {
    color: 'rgba(17,16,21,0.72)',
  },
});
