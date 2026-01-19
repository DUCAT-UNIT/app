/**
 * BiometricSetupModal - Prompts users to enable biometric authentication after wallet creation
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import { colors, spacing, fonts, fontSizes, radii } from '../styles/theme';
import { COLORS } from '../theme';

interface BiometricSetupModalProps {
  visible: boolean;
  onEnable: () => void;
  onSkip: () => void;
}

export default function BiometricSetupModal({
  visible,
  onEnable,
  onSkip,
}: BiometricSetupModalProps) {
  const { s, sf } = useResponsive();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.modal, {
            borderRadius: s(radii.xl),
            padding: s(spacing.xl),
            marginVertical: s(spacing.xl),
          }]}>
            <Text style={[styles.title, { fontSize: sf(fontSizes.lg), marginBottom: s(spacing.md) }]}>
              Biometric Authentication
            </Text>
            <Text style={[styles.text, { fontSize: sf(fontSizes.md), marginBottom: s(25), lineHeight: sf(22) }]}>
              Do you want to use biometric authentication (FaceID or TouchID) for quick access to your wallet?
            </Text>
            <View style={[styles.buttons, { gap: s(12) }]}>
              <TouchableOpacity
                style={[styles.button, styles.buttonYes, {
                  paddingVertical: s(spacing.md),
                  paddingHorizontal: s(spacing.lg),
                  borderRadius: s(radii.lg)
                }]}
                onPress={onEnable}
              >
                <Text style={[styles.buttonText, { fontSize: sf(fontSizes.md) }]}>Yes, Enable</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonNo, {
                  paddingVertical: s(spacing.md),
                  paddingHorizontal: s(spacing.lg),
                  borderRadius: s(radii.lg)
                }]}
                onPress={onSkip}
              >
                <Text style={[styles.buttonTextNo, { fontSize: sf(fontSizes.md) }]}>No, Thanks</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    backgroundColor: colors.bg.secondary,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontFamily: fonts.bold,
    fontWeight: 'bold' as const,
    color: colors.text.primary,
    textAlign: 'center',
  },
  text: {
    fontFamily: fonts.regular,
    color: colors.text.primary,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'column',
  },
  button: {
    alignItems: 'center',
  },
  buttonYes: {
    backgroundColor: colors.brand.primary,
  },
  buttonNo: {
    backgroundColor: COLORS.OFF_WHITE,
  },
  buttonText: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  buttonTextNo: {
    fontFamily: fonts.medium,
    fontWeight: '600' as const,
    color: COLORS.DARK_GRAY,
  },
});
