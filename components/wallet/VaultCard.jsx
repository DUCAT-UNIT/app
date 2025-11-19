/**
 * VaultCard Component
 * Displays vault status and health information
 */

import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../icons';
import { COLORS } from '../../theme';

// Constants
const VAULT_LOGO_SIZE = 49; // 36 * 1.35 ≈ 49
const CURRENCY_ICON_SIZE = 10;
const DEBT_DECIMAL_PLACES = 2;
const COLLATERAL_DECIMAL_PLACES = 8;
const GRADIENT_START = { x: 0.5, y: 0 };
const GRADIENT_END = { x: 0.5, y: 1 };

export default function VaultCard({
  hasVault,
  vaultHealthColor,
  vaultHealthPercentage,
  vaultDebt,
  vaultCollateral,
  onVaultPress,
  onCreateVault,
  creatingVault,
  styles,
}) {
  return (
    <TouchableOpacity
      style={styles.vaultCard}
      onPress={hasVault ? onVaultPress : undefined}
      activeOpacity={hasVault ? 0.7 : 1}
      disabled={!hasVault}
    >
      <View style={styles.vaultIconContainer}>
        <Icon name="vault_logo" size={VAULT_LOGO_SIZE} color={COLORS.VERY_LIGHT_GRAY} />
        <View style={[styles.vaultStatusIndicator, { backgroundColor: vaultHealthColor }]} />
      </View>
      <View style={styles.vaultContentWrapper}>
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
                {vaultDebt.toLocaleString('en-US', {
                  minimumFractionDigits: DEBT_DECIMAL_PLACES,
                  maximumFractionDigits: DEBT_DECIMAL_PLACES,
                })}
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
                {vaultCollateral.toLocaleString('en-US', {
                  minimumFractionDigits: COLLATERAL_DECIMAL_PLACES,
                  maximumFractionDigits: COLLATERAL_DECIMAL_PLACES,
                })}
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
        >
          <TouchableOpacity
            style={styles.createVaultButton}
            onPress={onCreateVault}
            activeOpacity={0.8}
            disabled={creatingVault}
          >
            <Text style={styles.createVaultButtonText}>Create Vault</Text>
          </TouchableOpacity>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

VaultCard.propTypes = {
  hasVault: PropTypes.bool.isRequired,
  vaultHealthColor: PropTypes.string.isRequired,
  vaultHealthPercentage: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  vaultDebt: PropTypes.number.isRequired,
  vaultCollateral: PropTypes.number.isRequired,
  onVaultPress: PropTypes.func,
  onCreateVault: PropTypes.func.isRequired,
  creatingVault: PropTypes.bool.isRequired,
  styles: PropTypes.object.isRequired,
};
