/**
 * PasskeyMigrationModal - Prompts users to enable passkey after wallet import
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Device from 'expo-device';
import { COLORS } from '../theme';
import { addPasskeyToExistingWallet, isPasskeySupported } from '../services/passkeyService';

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
      console.error('Failed to enable passkey:', error);
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
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Enable Passkey Recovery?</Text>

          <Text style={styles.description}>
            Secure your wallet with passkey and back it up to iCloud for easy recovery across devices.
          </Text>

          <View style={styles.benefits}>
            <Text style={styles.benefit}>✓ Backup to iCloud</Text>
            <Text style={styles.benefit}>✓ Recover on any device</Text>
            <Text style={styles.benefit}>✓ Protected by Face ID/Touch ID</Text>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleEnablePasskey}
              disabled={isAdding}
            >
              {isAdding ? (
                <ActivityIndicator color={COLORS.TEXT} />
              ) : (
                <Text style={styles.primaryButtonText}>Enable Passkey</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleSkip}
              disabled={isAdding}
            >
              <Text style={styles.secondaryButtonText}>Skip for Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: COLORS.SUBTEXT,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefits: {
    marginBottom: 32,
  },
  benefit: {
    fontSize: 16,
    color: COLORS.TEXT,
    marginBottom: 12,
    paddingLeft: 8,
  },
  buttons: {
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  primaryButtonText: {
    color: COLORS.TEXT,
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.SUBTEXT,
  },
  secondaryButtonText: {
    color: COLORS.SUBTEXT,
    fontSize: 16,
    fontWeight: '500',
  },
});
