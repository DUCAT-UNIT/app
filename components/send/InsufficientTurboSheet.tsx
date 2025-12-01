/**
 * InsufficientTurboSheet Component
 * Shows options when user wants to use Turbo but has insufficient ecash balance
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet from '../common/BottomSheet';
import Icon from '../icons';
import { COLORS } from '../../theme';

interface InsufficientTurboSheetProps {
  visible: boolean;
  onClose: () => void;
  onUseTurbo: () => void;
  onSendNormally: () => void;
  requiredAmount: number;
  currentBalance: number;
}

export default function InsufficientTurboSheet({
  visible,
  onClose,
  onUseTurbo,
  onSendNormally,
  requiredAmount,
  currentBalance,
}: InsufficientTurboSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Insufficient Turbo Balance">
      <View style={styles.container}>
        <View style={styles.balanceInfo}>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Required:</Text>
            <Text style={styles.balanceValue}>{requiredAmount.toFixed(2)} UNIT</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Your Turbo Balance:</Text>
            <Text style={styles.balanceValue}>{currentBalance.toFixed(2)} UNIT</Text>
          </View>
        </View>

        <Text style={styles.description}>
          You don't have enough Turbo balance for this transaction. Choose how you'd like to proceed:
        </Text>

        {/* Use Turbo Option */}
        <TouchableOpacity
          style={styles.option}
          onPress={onUseTurbo}
          activeOpacity={0.7}
        >
          <View style={styles.optionHeader}>
            <Icon name="unit_logo" size={24} color={COLORS.PRIMARY_BLUE} />
            <Text style={styles.optionTitle}>Use Turbo</Text>
          </View>
          <Text style={styles.optionDescription}>
            Private & instant after confirmation. Requires waiting for on-chain confirmation to mint. User will have to claim the tokens on their side.
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Private</Text>
          </View>
        </TouchableOpacity>

        {/* Send Normally Option */}
        <TouchableOpacity
          style={styles.option}
          onPress={onSendNormally}
          activeOpacity={0.7}
        >
          <View style={styles.optionHeader}>
            <Icon name="bitcoin" size={24} color={COLORS.SECONDARY_TEXT} />
            <Text style={styles.optionTitle}>Send Normally</Text>
          </View>
          <Text style={styles.optionDescription}>
            Standard on-chain transaction. Also have to wait for an on-chain confirmation, not private.
          </Text>
          <View style={[styles.badge, styles.badgeSecondary]}>
            <Text style={styles.badgeText}>On-Chain</Text>
          </View>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  balanceInfo: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
  },
  balanceValue: {
    fontSize: 14,
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 22,
    marginBottom: 20,
  },
  option: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_COLOR,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.WHITE,
    marginLeft: 12,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  optionDescription: {
    fontSize: 14,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 20,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeSecondary: {
    backgroundColor: COLORS.MID_DARK_GRAY,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
});
