/**
 * VaultCard Component
 * Displays vault status and health information
 */

import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { formatBalance } from '../../utils/formatters';
import { formatVaultUsd } from '../../utils/vaultFaceValue';

// Constants
const VAULT_LOGO_SIZE = 28;
const CURRENCY_ICON_SIZE = 10;
const COLLATERAL_DECIMAL_PLACES = 8;
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
  emptyVaultContent: ViewStyle;
  emptyVaultSubtitle: TextStyle;
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
  isPendingVaultTx?: boolean;
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
  isPendingVaultTx = false,
  styles,
}: VaultCardProps) {
  const formattedCollateral = useMemo(
    () => formatBalance(vaultCollateral, COLLATERAL_DECIMAL_PLACES),
    [vaultCollateral]
  );
  const vaultHealthLabel = vaultHealthPercentage === Infinity ? '∞' : String(vaultHealthPercentage);

  if (!hasVault) {
    const createDisabled = creatingVault || isPendingVaultTx;
    const createLabel = createDisabled ? 'Creating...' : 'Create Vault';

    return (
      <TouchableOpacity
        style={styles.vaultCard}
        onPress={onCreateVault}
        activeOpacity={0.85}
        disabled={createDisabled}
        testID="vault-card"
        accessibilityRole="button"
        accessibilityLabel={createDisabled ? 'Creating vault' : 'Create vault'}
        accessibilityHint="Creates a new vault to borrow dollar-denominated liquidity against your Bitcoin"
        accessibilityState={{ disabled: createDisabled }}
      >
        <View style={styles.vaultIconContainer} accessibilityElementsHidden>
          <Icon name="vault_logo" size={VAULT_LOGO_SIZE} color={COLORS.VERY_LIGHT_GRAY} />
        </View>
        <View
          style={[styles.vaultContentWrapper, styles.emptyVaultContent]}
          accessibilityElementsHidden
        >
          <Text style={styles.vaultAssetName}>Vault</Text>
          <Text style={styles.emptyVaultSubtitle}>No active vault</Text>
        </View>
        <View
          style={[styles.createVaultButton, createDisabled && { opacity: 0.7 }]}
          testID={createDisabled ? 'creating-vault-status' : 'create-vault-btn'}
        >
          <Text style={styles.createVaultButtonText} numberOfLines={1}>
            {createLabel}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.vaultCard}
      onPress={onVaultPress}
      activeOpacity={0.7}
      testID="vault-card"
      accessibilityRole="button"
      accessibilityLabel={`Vault with ${vaultHealthLabel}% health, ${formatVaultUsd(vaultDebt)} debt, ${formattedCollateral} BTC collateral`}
      accessibilityHint="Opens vault details"
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
          <Text style={[styles.assetValue, { color: vaultHealthColor }]}>{vaultHealthLabel}%</Text>
        </View>
        <View style={styles.vaultDetailsContainer}>
          <View style={styles.vaultDetailRow}>
            <Text style={styles.vaultLabel}>Overall Debt</Text>
            <View style={styles.vaultValueContainer}>
              <Text style={styles.assetAmount}>{formatVaultUsd(vaultDebt)}</Text>
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
              <Text style={styles.assetAmount}>{formattedCollateral}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
