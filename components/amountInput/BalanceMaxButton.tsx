/**
 * BalanceMaxButton Component
 * Displays balance and MAX button for amount input screen
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../../theme';

interface BalanceMaxButtonProps {
  assetLabel: string;
  balance: number;
  assetType: 'btc' | 'usd' | string | null;
  onMaxPress: () => void;
  isCalculating: boolean;
  testID?: string;
}

export function BalanceMaxButton({
  assetLabel,
  balance,
  assetType,
  onMaxPress,
  isCalculating
}: BalanceMaxButtonProps) {
  return (
    <View style={styles.balanceRow}>
      <Text style={styles.balanceLabel}>
        {assetLabel} Balance:{' '}
        {assetType === 'btc'
          ? (balance || 0).toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 8,
            })
          : (balance || 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
      </Text>
      <Pressable
        style={styles.maxButton}
        onPress={onMaxPress}
        disabled={isCalculating}
      >
        {isCalculating ? (
          <ActivityIndicator size="small" color={COLORS.WHITE} />
        ) : (
          <Text style={styles.maxButtonText}>MAX</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  maxButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
  },
});
