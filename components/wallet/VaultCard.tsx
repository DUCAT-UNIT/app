/**
 * VaultCard Component
 * Displays vault status and health information
 */

import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatBalance, formatFiat } from '../../utils/formatters';

// Constants
const VAULT_LOGO_SIZE = 28;
const CURRENCY_ICON_SIZE = 10;
const DEBT_DECIMAL_PLACES = 2;
const COLLATERAL_DECIMAL_PLACES = 8;
const GRADIENT_START = { x: 0.5, y: 0 };
const GRADIENT_END = { x: 0.5, y: 1 };

export interface VaultCardStyles {
  vaultCard: ViewStyle;
  vaultIconContainer: ViewStyle;
  vaultStatusIndicator: ViewStyle;
  vaultContentWrapper: ViewStyle;
  vaultHeader: ViewStyle;
  vaultHeaderLeft: ViewStyle;
  assetInfo: ViewStyle;
  vaultAssetName: TextStyle;
  assetValue: TextStyle;
  vaultDetailsContainer: ViewStyle;
  vaultDetailRow: ViewStyle;
  vaultLabel: TextStyle;
  vaultValueContainer: ViewStyle;
  assetAmountIcon: ViewStyle;
  assetAmount: TextStyle;
  vaultOverlay: ViewStyle;
  createVaultButton: ViewStyle;
  createVaultButtonText: TextStyle;
}

export interface VaultCardProps {
  hasVault: boolean;
  vaultHealthColor: string;
  vaultHealthPercentage: string | number;
  vaultDebt: number;
  vaultCollateral: number;
  onVaultPress?: () => void;
  onCreateVault: () => void;
  creatingVault: boolean;
  styles: VaultCardStyles;
  testID?: string;
}

export default memo(function VaultCard({
  hasVault,
  vaultHealthColor,
  vaultHealthPercentage,
  vaultDebt,
  vaultCollateral,
  onVaultPress,
  onCreateVault,
  creatingVault,
  styles,
}: VaultCardProps) {
  // Memoize formatted values to avoid recalculation on every render
  const formattedDebt = useMemo(
    () => formatFiat(vaultDebt, DEBT_DECIMAL_PLACES),
    [vaultDebt]
  );

  const formattedCollateral = useMemo(
    () => formatBalance(vaultCollateral, COLLATERAL_DECIMAL_PLACES),
    [vaultCollateral]
  );

  return (
    <TouchableOpacity
      style={styles.vaultCard}
      onPress={hasVault ? onVaultPress : undefined}
      activeOpacity={hasVault ? 0.7 : 1}
      disabled={!hasVault}
      accessibilityRole="button"
      accessibilityLabel={hasVault ? `Vault with ${vaultHealthPercentage}% health, ${formattedDebt} UNIT debt, ${formattedCollateral} BTC collateral` : "No vault created"}
      accessibilityHint={hasVault ? "Opens vault details" : "Create a vault to borrow UNIT"}
      accessibilityState={{ disabled: !hasVault }}
    >
      <View style={styles.vaultIconContainer} accessibilityElementsHidden>
        <Icon name="vault_logo" size={VAULT_LOGO_SIZE} color={COLORS.VERY_LIGHT_GRAY} />
        <View style={[styles.vaultStatusIndicator, { backgroundColor: vaultHealthColor }]} />
      </View>
      <View style={styles.vaultContentWrapper} accessibilityElementsHidden>
        <View style={styles.vaultHeader}>
          <View style={styles.vaultHeaderLeft}>
            <View style={styles.assetInfo}>
              <Text style={styles.vaultAssetName}>Vault</Text>
            </View>
          </View>
          <Text style={[styles.assetValue, { color: vaultHealthColor }]}>
            {vaultHealthPercentage}%
          </Text>
        </View>
        <View style={styles.vaultDetailsContainer}>
          <View style={styles.vaultDetailRow}>
            <Text style={styles.vaultLabel}>Overall Debt</Text>
            <View style={styles.vaultValueContainer}>
              <Icon
                name="unit_symbol"
                size={CURRENCY_ICON_SIZE}
                color={COLORS.SECONDARY_TEXT}
                style={styles.assetAmountIcon}
              />
              <Text style={styles.assetAmount}>
                {formattedDebt}
              </Text>
            </View>
          </View>
          <View style={styles.vaultDetailRow}>
            <Text style={styles.vaultLabel}>Total collateral</Text>
            <View style={styles.vaultValueContainer}>
              <Icon
                name="btc_symbol"
                size={CURRENCY_ICON_SIZE}
                color={COLORS.SECONDARY_TEXT}
                style={styles.assetAmountIcon}
              />
              <Text style={styles.assetAmount}>
                {formattedCollateral}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Create Vault Overlay - Only show when no vault exists */}
      {!hasVault && (
        <LinearGradient
          colors={[COLORS.OVERLAY_START, COLORS.OVERLAY_END]}
          style={styles.vaultOverlay}
          start={GRADIENT_START}
          end={GRADIENT_END}
          testID="vault-overlay"
        >
          <TouchableOpacity
            style={styles.createVaultButton}
            onPress={onCreateVault}
            activeOpacity={0.8}
            disabled={creatingVault}
            testID="create-vault-btn"
            accessibilityRole="button"
            accessibilityLabel="Create vault"
            accessibilityHint="Creates a new vault to borrow UNIT against your Bitcoin"
            accessibilityState={{ disabled: creatingVault }}
          >
            <Text style={styles.createVaultButtonText}>Create Vault</Text>
          </TouchableOpacity>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
});
