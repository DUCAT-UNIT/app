/**
 * PasskeyMigrationModal - Prompts users to enable passkey after wallet import
 */

import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import * as Device from 'expo-device';
import { COLORS } from '../theme';
import { addPasskeyToExistingWallet, isPasskeySupported } from '../services/passkey';
import { logger } from '../utils/logger';
import { useResponsive } from '../hooks/useResponsive';
import { spacing, radii, fontSizes } from '../styles/theme';
import styles from '../styles';

interface PasskeyMigrationModalProps {
  visible: boolean;
  onClose: () => void;
  onPasskeyEnabled?: () => void;
  mnemonic: string;
  currentPin: string;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function PasskeyMigrationModal({
  visible,
  onClose,
  onPasskeyEnabled,
  mnemonic,
  currentPin,
  showToast,
}: PasskeyMigrationModalProps) {
  const { s, sf } = useResponsive();
  const [isAdding, setIsAdding] = useState(false);

  const handleEnablePasskey = async () => {
    try {
      setIsAdding(true);

      // Small delay to let iOS properly prepare the passkey sheet presentation
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check if passkeys are supported
      const supported = await isPasskeySupported();
      if (!supported) {
        showToast('Passkeys are not supported on this device', 'error');
        onClose();
        return;
      }

      const deviceName = Device.deviceName || 'iPhone';
      const userName = `${deviceName}-DUCAT_APP`;
      const displayName = `${deviceName} - Ducat`;

      // Add passkey to existing wallet
      await addPasskeyToExistingWallet(mnemonic, userName, displayName, currentPin);

      showToast('Passkey enabled! Your wallet is now backed up to iCloud.', 'success');
      onClose();
      // Trigger biometric setup prompt after passkey is enabled
      onPasskeyEnabled?.();
    } catch (error: unknown) {
      logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'PasskeyMigrationModal', action: 'handleEnablePasskey' });
      showToast('Passkey setup cancelled', 'error');
      // Close modal on error (user cancelled or other failure)
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.biometricPromptModal, {
            borderRadius: s(radii.xxl),
            padding: s(spacing.xl),
            marginVertical: s(spacing.xl),
          }]}>
            <Text style={[styles.biometricPromptTitle, {
              fontSize: sf(fontSizes.xl),
              marginBottom: s(spacing.lg)
            }]}>
              Enable Passkey Recovery?
            </Text>

            <Text style={[styles.biometricPromptText, {
              fontSize: sf(fontSizes.md),
              marginBottom: s(25),
              lineHeight: sf(24)
            }]}>
              Secure your wallet with passkey and back it up to iCloud for easy recovery across devices.
            </Text>

            <View style={[styles.biometricPromptButtons, { gap: s(12) }]}>
              <TouchableOpacity
                style={[styles.biometricPromptButton, styles.biometricPromptButtonYes, {
                  paddingVertical: s(spacing.lg),
                  paddingHorizontal: s(20),
                  borderRadius: s(radii.lg),
                }]}
                onPress={handleEnablePasskey}
                disabled={isAdding}
              >
                {isAdding ? (
                  <ActivityIndicator color={COLORS.VERY_LIGHT_GRAY} />
                ) : (
                  <Text style={[styles.biometricPromptButtonText, { fontSize: sf(fontSizes.md) }]}>
                    Enable Passkey
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.biometricPromptButton, styles.biometricPromptButtonNo, {
                  paddingVertical: s(spacing.lg),
                  paddingHorizontal: s(20),
                  borderRadius: s(radii.lg),
                }]}
                onPress={handleSkip}
                disabled={isAdding}
              >
                <Text style={[styles.biometricPromptButtonTextNo, { fontSize: sf(fontSizes.md) }]}>
                  Skip for Now
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
