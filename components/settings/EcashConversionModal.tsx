/**
 * EcashConversionModal Component
 * Confirms conversion of UNIT to ecash when threshold is increased
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

interface EcashConversionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amountToConvert: number;
  unitBalance: number;
  newThreshold: number;
}

export default function EcashConversionModal({
  visible,
  onClose,
  onConfirm,
  amountToConvert,
  unitBalance,
  newThreshold,
}: EcashConversionModalProps) {
  // Ensure we have valid numbers
  const safeAmountToConvert = Number(amountToConvert) || 0;
  const safeUnitBalance = Number(unitBalance) || 0;

  // Check if we're converting all remaining balance
  const isConvertingAll = safeAmountToConvert >= safeUnitBalance;

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

          <Text style={styles.title}>Convert to Turbo UNIT?</Text>

          {isConvertingAll ? (
            <Text style={styles.message}>
              This will transform the rest of your balance{' '}
              <Text style={styles.highlight}>
                ({safeUnitBalance.toFixed(2)} UNIT)
              </Text>
              {' '}to Turbo UNIT for simpler transacting.
            </Text>
          ) : (
            <Text style={styles.message}>
              This will convert{' '}
              <Text style={styles.highlight}>
                {safeAmountToConvert.toFixed(2)} UNIT
              </Text>
              {' '}out of{' '}
              <Text style={styles.highlight}>
                {safeUnitBalance.toFixed(2)} UNIT
              </Text>
              {' '}into Turbo UNIT for simpler transacting.
            </Text>
          )}

          <View style={styles.infoBox}>
            <Icon name="info" size={16} color={COLORS.SECONDARY_TEXT} />
            <Text style={styles.infoText}>
              Turbo UNIT enables instant payments for transactions under {newThreshold === Infinity ? 'any amount' : `${(newThreshold / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UNIT`}.
            </Text>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmButtonText}>Convert</Text>
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
    marginBottom: 16,
  },
  highlight: {
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.SECONDARY_TEXT,
    lineHeight: 18,
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
