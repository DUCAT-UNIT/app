/**
 * RestoreChoiceScreen - Choose how to restore wallet (seed phrase or passkey)
 */

import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import styles from '../../styles';

interface RestoreChoiceScreenProps {
  onSeedPhrase: () => void;
  onPasskey: () => void;
  onCancel: () => void;
  hasPasskeyRestore: boolean;
}

export default function RestoreChoiceScreen({
  onSeedPhrase,
  onPasskey,
  onCancel,
  hasPasskeyRestore,
}: RestoreChoiceScreenProps) {
  return (
    <View style={styles.welcomeContainer}>
      <View style={styles.walletInfo}>
        <Text style={styles.stepIndicator}>Restore Wallet</Text>
        <Text style={styles.label}>Choose how to restore your wallet:</Text>

        <TouchableOpacity style={styles.button} onPress={onSeedPhrase}>
          <Text style={styles.buttonText}>From Seed Phrase</Text>
        </TouchableOpacity>

        {hasPasskeyRestore && (
          <TouchableOpacity
            style={[styles.button, styles.passkeyButton]}
            onPress={onPasskey}
          >
            <Text style={styles.buttonText}>From Passkey</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onCancel}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
