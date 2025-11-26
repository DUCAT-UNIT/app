/**
 * WalletCreatedIntro - Step 1: Wallet creation success intro
 */

import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import styles from '../../styles';

interface WalletCreatedIntroProps {
  onContinue: () => void;
  onCancel: () => void;
}

export default function WalletCreatedIntro({ onContinue, onCancel }: WalletCreatedIntroProps) {
  return (
    <View style={styles.walletInfo}>
      <Text style={styles.stepIndicator}>Step 1 of 4</Text>

      <View style={styles.introIconContainer}>
        <Text style={styles.introIcon}>✓</Text>
      </View>

      <Text style={styles.introTitle}>Wallet Created</Text>

      <Text style={styles.introText}>
        Your recovery phrase is the only way to restore your wallet. Keep it safe.
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoItem}>✓ Write it down</Text>
        <Text style={styles.infoItem}>✓ Store it safely</Text>
        <Text style={styles.infoItem}>✓ Never share it</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={onContinue}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={onCancel}
      >
        <Text style={styles.buttonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
