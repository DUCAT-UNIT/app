/**
 * PasskeyPinInput - Reusable PIN input component for passkey operations
 * Used for both passkey creation and restoration flows
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MutinynetBanner from './MutinynetBanner';
import ToastContainer from './ToastContainer';
import Icon from './icons';
import { COLORS } from '../theme';
import styles from '../styles';
import type { Toast } from '../contexts/NotificationContext';

interface PasskeyPinInputProps {
  title: string;
  subtitle: string;
  pin: string;
  setPin: (pin: string) => void;
  onPinComplete: (pin: string) => void;
  onCancel: () => void;
  toasts: Toast[];
}

export default function PasskeyPinInput({
  title,
  subtitle,
  pin,
  setPin,
  onPinComplete,
  onCancel,
  toasts,
}: PasskeyPinInputProps) {
  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      // Auto-submit when 6 digits entered
      if (newPin.length === 6) {
        onPinComplete(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <View style={localStyles.container}>
      <MutinynetBanner />

      {/* Cancel button - top right */}
      <TouchableOpacity
        style={localStyles.cancelButton}
        onPress={onCancel}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={localStyles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      <View style={localStyles.contentWrapper}>
        <View style={localStyles.passkeyPinContainer}>
          <Text style={styles.lockTitle}>{title}</Text>
          <Text style={localStyles.passkeyPinSubtitle}>{subtitle}</Text>

          <View style={styles.lockPinDots}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.lockPinDot,
                  i < pin.length && styles.lockPinDotFilled,
                ]}
              />
            ))}
          </View>

          <View style={styles.lockKeypad}>
            {[
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.lockKeypadRow}>
                {row.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.lockKey}
                    onPress={() => handleDigit(String(num))}
                  >
                    <Text style={styles.lockKeyText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.lockKeypadRow}>
              <View style={styles.lockKey} />
              <TouchableOpacity
                style={styles.lockKey}
                onPress={() => handleDigit('0')}
              >
                <Text style={styles.lockKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.lockKey}
                onPress={handleDelete}
              >
                <Icon name="delete" size={28} color={COLORS.WHITE} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
      <ToastContainer toasts={toasts} />
      <StatusBar style="light" />
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    paddingHorizontal: 0,
  },
  cancelButton: {
    position: 'absolute',
    top: 100,
    left: 20,
    padding: 12,
    zIndex: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  passkeyPinContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  passkeyPinSubtitle: {
    fontSize: 14,
    color: COLORS.LIGHT_GRAY,
    textAlign: 'center',
    marginBottom: 30,
    marginHorizontal: 20,
  },
});
