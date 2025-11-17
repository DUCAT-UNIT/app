/**
 * PasskeyMigrationModal - Prompts users to enable passkey after wallet import
 */

import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Device from 'expo-device';
import { COLORS } from '../theme';
import { addPasskeyToExistingWallet, isPasskeySupported } from '../services/passkeyService';
import { logger } from '../utils/logger';
import styles from '../styles';

export default function PasskeyMigrationModal({
  visible,
  onClose,
  mnemonic,
  currentPin,
  showToast,
}) {
  const [isAdding, setIsAdding] = useState(false);

  const handleEnablePasskey = async () => {
    try {
      setIsAdding(true);

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
    } catch (error) {
      logger.error('Failed to enable passkey', { error: error.message });
      showToast(error.message || 'Failed to enable passkey', 'error');
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
        <View style={styles.biometricPromptModal}>
          <Text style={styles.biometricPromptTitle}>Enable Passkey Recovery?</Text>

          <Text style={styles.biometricPromptText}>
            Secure your wallet with passkey and back it up to iCloud for easy recovery across devices.
          </Text>

          <View style={styles.biometricPromptButtons}>
            <TouchableOpacity
              style={[styles.biometricPromptButton, styles.biometricPromptButtonYes]}
              onPress={handleEnablePasskey}
              disabled={isAdding}
            >
              {isAdding ? (
                <ActivityIndicator color={COLORS.VERY_LIGHT_GRAY} />
              ) : (
                <Text style={styles.biometricPromptButtonText}>Enable Passkey</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.biometricPromptButton, styles.biometricPromptButtonNo]}
              onPress={handleSkip}
              disabled={isAdding}
            >
              <Text style={styles.biometricPromptButtonTextNo}>Skip for Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
