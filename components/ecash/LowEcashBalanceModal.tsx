/**
 * LowEcashBalanceModal Component
 * Prompts user to top up ecash when balance is low
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { COLORS } from '../../theme';
import Icon from '../icons';
import { formatUnitAmount } from '../../utils/formatters/amounts';

/**
 * TurboUnitIcon - Unit logo with lightning bolt emoji overlay
 */
function TurboUnitIcon({ size = 48 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Icon name="unit_logo" size={size} color={COLORS.PRIMARY_BLUE} />
      <Text style={{
        position: 'absolute',
        right: -12,
        bottom: -6,
        fontSize: size * 0.55,
      }}>⚡</Text>
    </View>
  );
}

interface LowEcashBalanceModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentBalance: number;
  defaultThreshold: number;
  amountNeeded: number;
}

export default function LowEcashBalanceModal({
  visible,
  onClose,
  onConfirm,
  currentBalance,
  defaultThreshold,
  amountNeeded,
}: LowEcashBalanceModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()} testID="low-ecash-modal">
          <View style={styles.iconContainer}>
            <TurboUnitIcon size={56} />
          </View>

          <Text style={styles.title}>Low Turbo UNIT Balance</Text>

          <Text style={styles.message}>
            Your Turbo UNIT balance is running low. Top up to continue enjoying instant transactions.
          </Text>

          <View style={styles.balanceInfo}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceValue}>{formatUnitAmount(currentBalance)} UNIT</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Default Amount</Text>
              <Text style={styles.balanceValue}>{formatUnitAmount(defaultThreshold)} UNIT</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Amount to Top Up</Text>
              <Text style={[styles.balanceValue, styles.highlight]}>{formatUnitAmount(amountNeeded)} UNIT</Text>
            </View>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText} testID="low-ecash-dismiss-btn">Not Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmButtonText}>Top Up</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modal: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  message: {
    fontSize: 16,
    color: COLORS.LIGHT_GRAY,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  balanceInfo: {
    backgroundColor: COLORS.DARK_BG,
    borderRadius: 14,
    padding: 18,
    marginBottom: 28,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.BORDER_COLOR,
    marginVertical: 12,
  },
  balanceLabel: {
    fontSize: 15,
    color: COLORS.LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  balanceValue: {
    fontSize: 15,
    color: COLORS.WHITE,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Medium',
  },
  highlight: {
    color: COLORS.PRIMARY_BLUE,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.MID_DARK_GRAY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Medium',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Medium',
  },
});
