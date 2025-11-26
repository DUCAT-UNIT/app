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
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconContainer}>
            <Icon name="unit_logo" size={48} color={COLORS.PRIMARY_BLUE} />
          </View>

          <Text style={styles.title}>Low Turbo Unit Balance</Text>

          <Text style={styles.message}>
            Your Turbo Unit balance is below the default amount. Turbo Unit allows you to operate instantly and privately through Turbo transactions.
          </Text>

          <View style={styles.balanceInfo}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Current Balance:</Text>
              <Text style={styles.balanceValue}>{currentBalance.toFixed(2)} UNIT</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Default Amount:</Text>
              <Text style={styles.balanceValue}>{defaultThreshold.toFixed(2)} UNIT</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Amount Needed:</Text>
              <Text style={[styles.balanceValue, styles.highlight]}>{amountNeeded.toFixed(2)} UNIT</Text>
            </View>
          </View>

          <Text style={styles.question}>Would you like to top up?</Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Not Now</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  message: {
    fontSize: 15,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  balanceInfo: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
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
  highlight: {
    color: COLORS.PRIMARY_BLUE,
  },
  question: {
    fontSize: 15,
    color: COLORS.WHITE,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.MID_DARK_GRAY,
    borderRadius: 10,
    paddingVertical: 14,
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
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Medium',
  },
});
