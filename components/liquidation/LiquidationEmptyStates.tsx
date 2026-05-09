import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../icons';
import { colors, fonts, fontSizes } from '../../styles/theme';
import { useResponsive } from '../../hooks/useResponsive';

export type LiquidationEmptyVariant =
  | 'noVaults'
  | 'noVault'
  | 'lowCollateral'
  | 'loading'
  | 'error';

export interface LiquidationEmptyStatesProps {
  variant: LiquidationEmptyVariant;
  onBackToWallet?: () => void;
}

const VARIANT_CONFIG: Record<
  LiquidationEmptyVariant,
  { icon: string; iconColor: string; bgColor: string; title: string; subtitle: string }
> = {
  noVault: {
    icon: 'vault',
    iconColor: colors.text.secondary,
    bgColor: colors.bg.secondary,
    title: 'No Vault Found',
    subtitle:
      'You need an active vault to claim liquidations. Create a vault first, then come back to earn profit from undercollateralized vaults.',
  },
  noVaults: {
    icon: 'liquidations',
    iconColor: colors.text.secondary,
    bgColor: colors.bg.secondary,
    title: 'No Current Liquidations',
    subtitle:
      'There are no vaults in the liquidation pool at this time. All vaults are maintaining healthy collateral ratios.',
  },
  lowCollateral: {
    icon: 'vault',
    iconColor: colors.semantic.error,
    bgColor: colors.bg.errorTint,
    title: 'Vault Collateral Too Low',
    subtitle:
      "Your vault doesn't have enough available collateral to absorb liquidated debt. Deposit more BTC or repay some debt to free up capacity.",
  },
  loading: {
    icon: 'liquidations',
    iconColor: colors.text.secondary,
    bgColor: colors.bg.secondary,
    title: 'Loading Vaults...',
    subtitle: 'Fetching liquidatable vaults from the network.',
  },
  error: {
    icon: 'liquidations',
    iconColor: colors.semantic.error,
    bgColor: colors.bg.errorTint,
    title: 'Unable to Load Liquidations',
    subtitle:
      'The liquidation service did not respond in time. Keep this screen open and the app will retry automatically.',
  },
};

const LiquidationEmptyStates = React.memo(function LiquidationEmptyStates({
  variant,
  onBackToWallet,
}: LiquidationEmptyStatesProps): React.ReactElement {
  const { s } = useResponsive();
  const cfg = VARIANT_CONFIG[variant];

  return (
    <View style={styles.container}>
      <View style={[styles.icon, { backgroundColor: cfg.bgColor }]}>
        <Icon name={cfg.icon} size={s(48)} color={cfg.iconColor} />
      </View>
      <Text style={styles.title}>{cfg.title}</Text>
      <Text style={styles.subtitle}>{cfg.subtitle}</Text>
      {onBackToWallet && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to wallet"
          onPress={onBackToWallet}
          style={styles.backButton}
          testID="liquidation-empty-back-btn"
        >
          <Text style={styles.backButtonText}>Back to Wallet</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  backButton: {
    marginTop: 24,
    backgroundColor: colors.brand.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minWidth: 180,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bold,
    color: colors.text.white,
  },
});

export default LiquidationEmptyStates;
