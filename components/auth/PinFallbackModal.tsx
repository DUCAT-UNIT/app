import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, fontSizes, radii, spacing } from '../../styles/theme';
import { COLORS } from '../../theme';
import Icon from '../icons';

interface PinFallbackModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  error?: string | null;
  busy?: boolean;
  onSubmit: (pin: string) => void | Promise<void>;
  onCancel: () => void;
}

const DIGIT_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export default function PinFallbackModal({
  visible,
  title = 'Enter PIN',
  message = 'Face ID is unavailable. Enter your wallet PIN to continue.',
  error,
  busy = false,
  onSubmit,
  onCancel,
}: PinFallbackModalProps): React.JSX.Element | null {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!visible) {
      setPin('');
    }
  }, [visible]);

  const handleDigit = useCallback(
    (digit: string): void => {
      if (busy || pin.length >= 6) {
        return;
      }

      const nextPin = pin + digit;
      setPin(nextPin);

      if (nextPin.length === 6) {
        setPin('');
        void onSubmit(nextPin);
      }
    },
    [busy, onSubmit, pin]
  );

  const handleDelete = useCallback((): void => {
    if (!busy) {
      setPin((current) => current.slice(0, -1));
    }
  }, [busy]);

  const handleCancel = useCallback((): void => {
    if (!busy) {
      onCancel();
    }
  }, [busy, onCancel]);

  if (!visible) {
    return null;
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.backdrop} testID="pin-fallback-modal">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCancel}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel PIN entry"
              testID="pin-fallback-cancel"
            >
              <Icon name="close" size={18} color={COLORS.WHITE} />
            </TouchableOpacity>
          </View>

          <Text style={styles.message}>{message}</Text>

          <View style={styles.dots} accessibilityElementsHidden>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <View key={index} style={[styles.dot, index < pin.length && styles.dotFilled]} />
            ))}
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : (
            <View style={styles.errorSpacer} />
          )}

          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.text.white} />
              <Text style={styles.busyText}>Verifying...</Text>
            </View>
          ) : (
            <View style={styles.keypad}>
              {DIGIT_ROWS.map((row) => (
                <View key={row.join('')} style={styles.keypadRow}>
                  {row.map((digit) => (
                    <TouchableOpacity
                      key={digit}
                      style={styles.key}
                      onPress={() => handleDigit(digit)}
                      accessibilityRole="button"
                      accessibilityLabel={`PIN ${digit}`}
                      testID={`pin-fallback-key-${digit}`}
                    >
                      <Text style={styles.keyText}>{digit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              <View style={styles.keypadRow}>
                <View style={styles.key} />
                <TouchableOpacity
                  style={styles.key}
                  onPress={() => handleDigit('0')}
                  accessibilityRole="button"
                  accessibilityLabel="PIN 0"
                  testID="pin-fallback-key-0"
                >
                  <Text style={styles.keyText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.key}
                  onPress={handleDelete}
                  accessibilityRole="button"
                  accessibilityLabel="Delete PIN digit"
                  testID="pin-fallback-delete"
                >
                  <Icon name="delete" size={26} color={COLORS.WHITE} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: fontSizes.xl,
    fontFamily: fonts.bold,
    color: colors.text.primary,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.bg.tertiary,
  },
  message: {
    marginTop: spacing.sm,
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.tertiary,
  },
  dotFilled: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  error: {
    minHeight: 22,
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.semantic.error,
  },
  errorSpacer: {
    height: 22,
    marginTop: spacing.md,
  },
  busyRow: {
    height: 244,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  busyText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  keypad: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  key: {
    width: 68,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  keyText: {
    fontSize: 28,
    fontFamily: fonts.medium,
    color: colors.text.white,
  },
});
